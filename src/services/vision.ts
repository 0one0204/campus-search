import { supabase, supabaseUrl, projectUrlId } from '@/supabase/client';
import { decode } from 'base64-arraybuffer';

const BUCKET_ID = '317233d1-45b3-45b4-b8be-4cb229fca0d3';

/**
 * 智能压缩图片，确保符合 API 输入限制
 */
export async function compressImage(
  file: File,
  options?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    quality?: number;
    outputFormat?: 'image/jpeg' | 'image/webp';
  }
): Promise<File> {
  const {
    maxSizeMB = 1,
    maxWidthOrHeight = 8000,
    quality = 0.85,
    outputFormat = 'image/webp',
  } = options || {};

  const maxBytes = maxSizeMB * 1024 * 1024;

  if (file.size <= maxBytes) {
    const img = await loadImage(file);
    if (img.width <= maxWidthOrHeight && img.height <= maxWidthOrHeight) {
      return file;
    }
  }

  const img = await loadImage(file);
  let { width, height } = img;

  if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
    const scale = Math.min(maxWidthOrHeight / width, maxWidthOrHeight / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  let currentQuality = quality;
  while (currentQuality > 0.1) {
    const blob = await canvasToBlob(canvas, outputFormat, currentQuality);
    if (blob.size <= maxBytes) {
      const ext = outputFormat === 'image/webp' ? 'webp' : 'jpg';
      return new File([blob], `compressed.${ext}`, { type: outputFormat });
    }
    currentQuality -= 0.1;
  }

  const blob = await canvasToBlob(canvas, outputFormat, 0.1);
  const ext = outputFormat === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `compressed.${ext}`, { type: outputFormat });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      type, quality
    );
  });
}

/**
 * 上传图片到存储桶
 */
export async function uploadItemImage(file: File): Promise<{
  publicUrl: string;
  storagePath: string;
}> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storagePath = `uploads/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_ID)
    .upload(storagePath, decode(base64), { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET_ID).getPublicUrl(storagePath);

  return { publicUrl, storagePath };
}

type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image_url'; image_url: { url: string } };
type VisionContent = TextContent | ImageContent;
type VisionMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | VisionContent[];
};

/**
 * 流式调用 AI 视觉识别
 */
export async function requestVisionStream(
  messages: VisionMessage[],
  onChunk: (text: string) => void,
  options?: { signal?: AbortSignal }
) {
  const { signal } = options ?? {};

  const session = (await supabase.auth.getSession()).data.session;
  const authHeaders = session ? { Authorization: `Bearer ${session.access_token}` } : {};

  const response = await fetch(
    `${supabaseUrl}/functions/v1/ai-vision`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OneDay-App-Id': projectUrlId,
        ...authHeaders,
      },
      body: JSON.stringify({ messages, stream: true }),
      signal,
    }
  );
  if (!response.ok) throw new Error(`请求失败: ${response.status}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return fullText;

        try {
          const json = JSON.parse(payload);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // 忽略非法 JSON 行
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return fullText;
    throw err;
  }

  return fullText;
}

/**
 * 识别物品标签
 */
export async function identifyItem(imageUrl: string): Promise<{
  category?: string;
  color?: string;
  brand?: string;
  description?: string;
  tags?: string[];
}> {
  let result = '';
  await requestVisionStream(
    [{
      role: 'user',
      content: [
        { type: 'text', text: '请分析这张图片中的物品，提取以下信息并以JSON格式返回：category(类别，如电子产品/证件/书籍/衣物/其他)、color(主要颜色)、brand(品牌，如果可见)、description(简短描述)、tags(关键词数组)。只返回JSON，不要其他文字。' },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }],
    (chunk) => { result += chunk; }
  );

  try {
    // 尝试从结果中提取 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // 解析失败，返回空对象
  }

  return {};
}
