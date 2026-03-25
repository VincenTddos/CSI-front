import React from 'react';
import { 
  MonitorSmartphone, 
  KeyRound, 
  Users, 
  Activity, 
  BellRing, 
  FileText, 
  Settings,
  LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Page } from '../types';
import { useUser } from '../contexts/UserContext';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useUser();

  const menuItems = [
    { id: 'device', label: '設備管理', icon: MonitorSmartphone, roles: ['admin', 'medical'] },
    { id: 'personnel', label: '人員管理', icon: Users, roles: ['admin'] },
    { id: 'realtime', label: '即時監控', icon: Activity, roles: ['admin', 'medical', 'family'] },
    { id: 'alerts', label: '警報通知', icon: BellRing, roles: ['admin', 'medical', 'family'] },
    { id: 'health', label: '健康報表', icon: FileText, roles: ['admin', 'medical', 'family'] },
    { id: 'settings', label: '系統設定', icon: Settings, roles: ['admin', 'medical'] },
  ] as const;

  const filteredItems = menuItems.filter(item => 
    !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <aside className="w-64 bg-[#2C363F] text-slate-300 flex flex-col h-full shadow-xl z-10 shrink-0">
      <div className="p-6 border-b border-slate-700/50 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-slate-600 mb-4 overflow-hidden border-2 border-slate-500">
          <img 
            src={user?.avatar || "https://picsum.photos/seed/avatar1/150/150"} 
            alt="User Avatar" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="text-white font-medium text-lg tracking-wide">{user?.name}，您好</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
            user?.role === 'admin' ? "bg-red-500/20 text-red-400" :
            user?.role === 'medical' ? "bg-blue-500/20 text-blue-400" :
            "bg-green-500/20 text-green-400"
          )}>
            {user?.role === 'admin' ? '管理者' : user?.role === 'medical' ? '醫護人員' : '家屬'}
          </span>
          <button 
            onClick={logout}
            className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" /> 登出
          </button>
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Page)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 relative group",
                isActive 
                  ? "bg-[#1E252B] text-white shadow-inner" 
                  : "hover:bg-[#3A4651] hover:text-white"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[#007AFF] rounded-r-full" />
              )}
              <item.icon className={cn("w-5 h-5", isActive ? "text-[#007AFF]" : "text-slate-400 group-hover:text-slate-300")} />
              {item.label}
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-700/50">
        <div className="text-xs text-slate-500 text-center">
          智慧長照監控系統 v1.0
        </div>
      </div>
    </aside>
  );
}
