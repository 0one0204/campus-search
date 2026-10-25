import { Link, useLocation } from '@tanstack/react-router';
import { Home, PlusCircle, User } from 'lucide-react';

export function BottomNav() {
  const location = useLocation();
  const pathname = location.pathname;

  // 在登录页和发布页不显示底部导航
  if (pathname === '/login' || pathname === '/publish') {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-2 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        <Link to="/" className={`flex flex-col items-center gap-1 p-2 ${isActive('/') ? 'text-primary' : 'text-muted-foreground'}`}>
          <Home className="w-5 h-5" />
          <span className="text-xs">首页</span>
        </Link>
        <Link to="/publish" className={`flex flex-col items-center gap-1 p-2 ${isActive('/publish') ? 'text-primary' : 'text-muted-foreground'}`}>
          <PlusCircle className="w-5 h-5" />
          <span className="text-xs">发布</span>
        </Link>
        <Link to="/me" className={`flex flex-col items-center gap-1 p-2 ${isActive('/me') ? 'text-primary' : 'text-muted-foreground'}`}>
          <User className="w-5 h-5" />
          <span className="text-xs">我的</span>
        </Link>
      </div>
    </nav>
  );
}