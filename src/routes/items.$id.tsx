
 import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, MessageCircle, Phone, MapPin, Calendar, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getItemById, getItemImages, getItems, toggleFavorite, sendMessage, type Item } from '@/services/api';
import { supabase } from '@/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/items_/$id')({
  component: ItemDetailPage,
});

function ItemDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [images, setImages] = useState<{ image_url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [matches, setMatches] = useState<Item[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    loadItem();
    checkAuth();
  }, [id]);

  async function checkAuth() {
    const session = (await supabase.auth.getSession()).data.session;
    setCurrentUser(session?.user.id || null);
  }

  async function loadItem() {
    try {
      const fetchedItem = await getItemById(id);
      if (!fetchedItem) {
        toast.error('物品不存在');
        navigate({ to: '/' });
        return;
      }
      setItem(fetchedItem);

      const imgs = await getItemImages(id);
      setImages(imgs);

      // 加载相似物品匹配
      if (fetchedItem.ai_tags) {
        const similarItems = await getItems({
          type: fetchedItem.type === 'lost' ? 'found' : 'lost',
          limit: 5,
        });
        setMatches(similarItems.items.filter(i => i.id !== id));
      }

      // 检查是否已收藏
      if (fetchedItem) {
        const favorites = await supabase
          .from('favorites')
          .select()
          .eq('item_id', id);
        const session = (await supabase.auth.getSession()).data.session;
        if (session && favorites.data?.some((f: any) => f.user_id === session.user.id)) {
          setIsFavorited(true);
        }
      }
    } catch (err) {
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFavorite() {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      toast.error('请先登录');
      navigate({ to: '/login' });
      return;
    }

    try {
      await toggleFavorite(id);
      setIsFavorited(!isFavorited);
      toast.success(isFavorited ? '已取消收藏' : '已收藏');
    } catch (err) {
      toast.error('操作失败');
    }
  }

  async function handleContact() {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      toast.error('请先登录');
      navigate({ to: '/login' });
      return;
    }

    if (!item) return;

    try {
      await sendMessage(item.user_id, `你好，我对你的${item.type === 'lost' ? '失物' : '招领'}"${item.title}"感兴趣`, item.id);
      toast.success('消息已发送');
    } catch (err) {
      toast.error('发送失败');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold text-foreground">物品详情</h1>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Image Gallery */}
        <div className="space-y-2">
          {images.length > 0 ? (
            <div className="rounded-lg overflow-hidden bg-muted aspect-video">
              <img src={images[0].image_url} alt={item.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="rounded-lg bg-muted aspect-video flex items-center justify-center text-muted-foreground">
              暂无图片
            </div>
          )}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.slice(1).map((img, idx) => (
                <div key={idx} className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Title & Status */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={item.type === 'lost' ? 'destructive' : 'default'}>
              {item.type === 'lost' ? '失物' : '招领'}
            </Badge>
            <Badge variant="outline">{item.status === 'pending' ? '待认领' : item.status === 'contacted' ? '已联系' : item.status === 'returned' ? '已归还' : '已过期'}</Badge>
          </div>
          <h2 className="text-xl font-semibold text-foreground">{item.title}</h2>
        </div>

        {/* Info Cards */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {item.category && (
              <div className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">分类：</span>
                <span>{item.category}</span>
              </div>
            )}
            {item.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">地点：</span>
                <span>{item.location}</span>
              </div>
            )}
            {item.lost_found_time && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">时间：</span>
                <span>{new Date(item.lost_found_time).toLocaleString('zh-CN')}</span>
              </div>
            )}
            {item.description && (
              <div className="text-sm">
                <span className="text-muted-foreground">描述：</span>
                <p className="mt-1 text-foreground">{item.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Tags */}
        {item.ai_tags && Object.keys(item.ai_tags).length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">AI 识别标签</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(item.ai_tags).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        {item.contact_info && currentUser && currentUser !== item.user_id && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">联系方式</h3>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{item.contact_info}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {currentUser && currentUser !== item.user_id && item.status === 'pending' && (
          <div className="flex gap-3">
            <Button onClick={handleToggleFavorite} variant="outline" className="flex-1">
              <Heart className={`w-4 h-4 mr-2 ${isFavorited ? 'fill-destructive text-destructive' : ''}`} />
              {isFavorited ? '已收藏' : '收藏'}
            </Button>
            <Button onClick={handleContact} className="flex-1">
              <MessageCircle className="w-4 h-4 mr-2" />
              联系我
            </Button>
          </div>
        )}

        {/* Similar Items */}
        {matches.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">可能匹配的物品</h3>
            <div className="space-y-2">
              {matches.map((match) => (
                <Link key={match.id} to="/items/$id" params={{ id: match.id }}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {/* 简化：不加载匹配项图片 */}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{match.title}</h4>
                        <p className="text-xs text-muted-foreground">{match.location || '地点未知'}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">相似</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
