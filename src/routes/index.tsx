import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getItems, type Item, type ItemType } from '@/services/api';
import { getItemImages } from '@/services/api';
import { toast } from 'sonner';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const CATEGORIES = ['全部', '电子产品', '证件', '书籍', '衣物', '其他'];

function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'lost' | 'found'>('all');
  const [category, setCategory] = useState<string>('全部');
  const [keyword, setKeyword] = useState('');
  const [itemImages, setItemImages] = useState<Record<string, string>>({});

  useEffect(() => {
    loadItems();
  }, [activeTab, category]);

  async function loadItems() {
    setLoading(true);
    try {
      const typeFilter = activeTab === 'all' ? undefined : (activeTab as ItemType);
      const categoryFilter = category === '全部' ? undefined : category;
      const { items: fetchedItems } = await getItems({
        type: typeFilter,
        category: categoryFilter,
        keyword: keyword || undefined,
        limit: 50,
      });
      setItems(fetchedItems);

      // 加载每个物品的第一张图片
      const imagesMap: Record<string, string> = {};
      for (const item of fetchedItems.slice(0, 10)) {
        const imgs = await getItemImages(item.id);
        if (imgs.length > 0) {
          imagesMap[item.id] = imgs[0].image_url;
        }
      }
      setItemImages(imagesMap);
    } catch (err) {
      toast.error('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    loadItems();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 flex">
          <h1 className="text-lg font-semibold text-foreground">校园失物招领</h1>
          <Link to="/publish">
            <Button size="sm" className="ml-auto">
              <Plus className="w-4 h-4 mr-1" />
              发布
            </Button>
          </Link>
        </div>
      </header>

      {/* Search & Filter */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="搜索物品名称或描述..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} size="sm">
            <Search className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="px-4">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="lost">失物</TabsTrigger>
          <TabsTrigger value="found">招领</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Items List */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">暂无物品</div>
        ) : (
          items.map((item) => (
            <Link key={item.id} to="/items/$id" params={{ id: item.id }}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                      {itemImages[item.id] ? (
                        <img src={itemImages[item.id]} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">无图片</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={item.type === 'lost' ? 'destructive' : 'default'} className="text-xs">
                          {item.type === 'lost' ? '失物' : '招领'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.category || '未分类'}</span>
                      </div>
                      <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                      <p className="text-sm text-muted-foreground truncate mt-1">{item.location || '地点未知'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.created_at).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
