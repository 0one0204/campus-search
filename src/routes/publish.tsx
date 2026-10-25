import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Upload, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { compressImage, uploadItemImage, identifyItem } from '@/services/vision';
import { createItem, addItemImage } from '@/services/api';
import { supabase } from '@/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/publish')({
  component: PublishPage,
});

const CATEGORIES = ['电子产品', '证件', '书籍', '衣物', '其他'];

function PublishPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'lost' | 'found'>('lost');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [aiTags, setAiTags] = useState<Record<string, unknown>>({});
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [lostFoundTime, setLostFoundTime] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 3 - images.length;
    const toAdd = files.slice(0, remaining);

    for (const file of toAdd) {
      try {
        const compressed = await compressImage(file);
        setImages((prev) => [...prev, compressed]);
        
        const previewUrl = URL.createObjectURL(compressed);
        setImagePreviews((prev) => [...prev, previewUrl]);
      } catch (err) {
        toast.error(`图片 ${file.name} 处理失败`);
      }
    }

    // 上传第一张图片时触发 AI 识别
    if (images.length === 0 && toAdd.length > 0) {
      triggerAIIdentification(toAdd[0]);
    }
  }

  async function triggerAIIdentification(file: File) {
    setIdentifying(true);
    try {
      const compressed = await compressImage(file);
      const { publicUrl } = await uploadItemImage(compressed);
      const tags = await identifyItem(publicUrl);
      setAiTags(tags);
      
      // 自动填充表单
      if (tags.category && !category) {
        const catMap: Record<string, string> = {
          '电子产品': '电子产品',
          '证件': '证件',
          '书籍': '书籍',
          '衣物': '衣物',
        };
        const matchedCat = Object.entries(catMap).find(([key]) => 
          tags.category?.includes(key)
        );
        if (matchedCat) setCategory(matchedCat[1]);
      }
      if (tags.color && !description.includes('颜色')) {
        setDescription((prev) => prev ? `${prev}\n颜色：${tags.color}` : `颜色：${tags.color}`);
      }
      
      toast.success('AI 识别完成');
    } catch (err) {
      toast.error('AI 识别失败，请手动填写');
    } finally {
      setIdentifying(false);
    }
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error('请输入物品名称');
      return;
    }
    if (!location.trim()) {
      toast.error('请输入地点');
      return;
    }
    if (images.length === 0) {
      toast.error('请至少上传一张图片');
      return;
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      toast.error('请先登录');
      navigate({ to: '/login' });
      return;
    }

    setSubmitting(true);
    try {
      // 创建物品记录
      const item = await createItem({
        type: activeTab,
        title,
        description: description || undefined,
        category: category || undefined,
        location,
        lost_found_time: lostFoundTime || undefined,
        contact_info: contactInfo || undefined,
        ai_tags: Object.keys(aiTags).length > 0 ? aiTags : undefined,
      });

      // 上传图片
      for (let i = 0; i < images.length; i++) {
        const { publicUrl, storagePath } = await uploadItemImage(images[i]);
        await addItemImage(item.id, publicUrl, storagePath, i);
      }

      toast.success('发布成功');
      navigate({ to: '/' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">发布信息</h1>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* Type Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="lost">我丢了</TabsTrigger>
            <TabsTrigger value="found">我捡了</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Image Upload */}
        <div>
          <Label className="mb-2 block">物品图片（最多3张）</Label>
          <div className="grid grid-cols-3 gap-3">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground">点击上传</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
          {identifying && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 animate-pulse" />
              AI 识别中...
            </div>
          )}
          {Object.keys(aiTags).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(aiTags).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="text-xs">
                  {key}: {String(value)}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">物品名称 *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：黑色钱包、学生证"
            />
          </div>

          <div>
            <Label htmlFor="category">分类</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">详细描述</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述物品的特征、品牌、颜色等"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="location">地点 *</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={activeTab === 'lost' ? '丢失地点' : '拾到地点'}
            />
          </div>

          <div>
            <Label htmlFor="time">{activeTab === 'lost' ? '丢失时间' : '拾到时间'}</Label>
            <Input
              id="time"
              type="datetime-local"
              value={lostFoundTime}
              onChange={(e) => setLostFoundTime(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="contact">联系方式</Label>
            <Input
              id="contact"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="手机号或微信号"
            />
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full"
          size="lg"
        >
          {submitting ? '发布中...' : '发布'}
        </Button>
      </div>
    </div>
  );
}
