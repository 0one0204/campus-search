import { supabase } from '@/supabase/client';

export type ItemType = 'lost' | 'found';
export type ItemStatus = 'pending' | 'contacted' | 'returned' | 'expired';

export interface Item {
  id: string;
  user_id: string;
  type: ItemType;
  status: ItemStatus;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  lost_found_time: string | null;
  contact_info: string | null;
  ai_tags: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ItemImage {
  id: string;
  item_id: string;
  image_url: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  item_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  item_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

/**
 * 获取物品列表（支持筛选）
 */
export async function getItems(options?: {
  type?: ItemType;
  category?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: Item[]; count: number }> {
  let query = supabase.from('items').select('*', { count: 'exact' });

  if (options?.type) {
    query = query.eq('type', options.type);
  }
  if (options?.category) {
    query = query.eq('category', options.category);
  }
  if (options?.keyword) {
    query = query.or(`title.ilike.%${options.keyword}%,description.ilike.%${options.keyword}%`);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.range(
      options.offset || 0,
      (options.offset || 0) + options.limit - 1
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { items: (data as Item[]) || [], count: count || 0 };
}

/**
 * 获取单个物品详情
 */
export async function getItemById(id: string): Promise<Item | null> {
  const { data, error } = await supabase
    .from('items')
    .select()
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Item | null;
}

/**
 * 获取物品的图片列表
 */
export async function getItemImages(itemId: string): Promise<ItemImage[]> {
  const { data, error } = await supabase
    .from('item_images')
    .select()
    .eq('item_id', itemId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data as ItemImage[]) || [];
}

/**
 * 创建物品
 */
export async function createItem(item: {
  type: ItemType;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  lost_found_time?: string;
  contact_info?: string;
  ai_tags?: Record<string, unknown>;
}): Promise<Item> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('请先登录');

  const { data, error } = await supabase
    .from('items')
    .insert({
      type: item.type,
      title: item.title,
      description: item.description || null,
      category: item.category || null,
      location: item.location || null,
      lost_found_time: item.lost_found_time || null,
      contact_info: item.contact_info || null,
      ai_tags: item.ai_tags || null,
      user_id: session.user.id,
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('创建失败');

  return data as Item;
}

/**
 * 添加物品图片
 */
export async function addItemImage(itemId: string, imageUrl: string, storagePath: string, sortOrder: number): Promise<ItemImage> {
  const { data, error } = await supabase
    .from('item_images')
    .insert({
      item_id: itemId,
      image_url: imageUrl,
      storage_path: storagePath,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('添加图片失败');

  return data as ItemImage;
}

/**
 * 更新物品状态
 */
export async function updateItemStatus(itemId: string, status: ItemStatus): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * 获取我的收藏
 */
export async function getMyFavorites(): Promise<Favorite[]> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('请先登录');

  const { data, error } = await supabase
    .from('favorites')
    .select()
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as Favorite[]) || [];
}

/**
 * 收藏物品
 */
export async function toggleFavorite(itemId: string): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('请先登录');

  // 先检查是否已收藏
  const { data: existing } = await supabase
    .from('favorites')
    .select()
    .eq('user_id', session.user.id)
    .eq('item_id', itemId)
    .maybeSingle();

  if (existing) {
    // 取消收藏
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', session.user.id)
      .eq('item_id', itemId);
    if (error) throw error;
  } else {
    // 添加收藏
    const { error } = await supabase
      .from('favorites')
      .insert({
        user_id: session.user.id,
        item_id: itemId,
      });
    if (error) throw error;
  }
}

/**
 * 获取我的消息
 */
export async function getMyMessages(): Promise<Message[]> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('请先登录');

  const { data, error } = await supabase
    .from('messages')
    .select()
    .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as Message[]) || [];
}

/**
 * 发送消息
 */
export async function sendMessage(receiverId: string, content: string, itemId?: string): Promise<Message> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('请先登录');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: session.user.id,
      receiver_id: receiverId,
      content,
      item_id: itemId || null,
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('发送失败');

  return data as Message;
}

/**
 * 标记消息为已读
 */
export async function markMessageAsRead(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('id', messageId);

  if (error) throw error;
}

/**
 * 获取我发布的物品
 */
export async function getMyItems(): Promise<Item[]> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('请先登录');

  const { data, error } = await supabase
    .from('items')
    .select()
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as Item[]) || [];
}
