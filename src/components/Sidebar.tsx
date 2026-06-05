import React from 'react';
import {
  MonitorSmartphone,
  KeyRound,
  Users,
  Activity,
  BellRing,
  FileText,
  Settings,
  LogOut,
  HeartPulse,
  ClipboardList,
  Contact,
  BookHeart,
  BarChart3,
  Radio,
  LayoutGrid,
  ShieldCheck,
  Building2,
  Crown,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import { UserRole } from '../types';
import { canSeeAll } from '../lib/roles';

import { useLocation, useNavigate } from 'react-router-dom';

const ROLES: { id: UserRole; label: string; icon: React.ElementType; color: string; badge: string }[] = [
  { id: 'developer', label: '開發者',   icon: Crown,       color: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
  { id: 'medical',   label: '醫護人員', icon: HeartPulse,  color: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-400' },
  { id: 'family',    label: '家屬',     icon: Building2,   color: 'text-green-400',  badge: 'bg-green-500/20 text-green-400' },
  { id: 'admin',     label: '管理者',   icon: ShieldCheck, color: 'text-red-400',    badge: 'bg-red-500/20 text-red-400' },
];

export function Sidebar() {
  const { user, logout } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  // Parse current route to match item type
  const currentPage = location.pathname.substring(1) || 'realtime';

  const menuItems = [
    { id: 'realtime', label: '監控面板', icon: Activity, roles: ['admin', 'medical', 'family'] },
    { id: 'patients', label: '受護者', icon: Contact, roles: ['admin', 'medical'] },
    { id: 'health-log', label: '健康日誌', icon: BookHeart, roles: ['family'] },
    { id: 'device', label: '區域管理', icon: MonitorSmartphone, roles: ['admin', 'medical', 'family'] },
    { id: 'occupancy', label: '房間佔用', icon: LayoutGrid, roles: ['admin', 'medical'] },
    { id: 'subcarrier', label: '子載波分析', icon: Radio, roles: ['admin'] },
    { id: 'daily-health', label: '每日健康', icon: HeartPulse, roles: ['admin', 'medical'] },
    { id: 'routine-checkup', label: '日常檢查', icon: ClipboardList, roles: ['admin', 'medical'] },
    { id: 'personnel', label: '人員管理', icon: Users, roles: ['admin'] },
    { id: 'health', label: '健康報表', icon: BarChart3, roles: ['admin', 'medical', 'family'] },
    { id: 'analytics', label: '管理報表', icon: BarChart3, roles: ['admin', 'medical', 'family'] },
    { id: 'alerts', label: '警報通知', icon: BellRing, roles: ['admin', 'medical', 'family'] },
    { id: 'settings', label: '系統設定', icon: Settings, roles: ['admin', 'medical'] },
  ] as const;

  const filteredItems = menuItems.filter(item =>
    !item.roles ||
    (user && (canSeeAll(user.role) || (item.roles as readonly string[]).includes(user.role)))
  );

  const currentRole = ROLES.find(r => r.id === user?.role);

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

        {/* 角色標籤（純顯示，不可切換） */}
        <div className="mt-1">
          <span
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
              currentRole?.badge ?? 'bg-slate-500/20 text-slate-400',
            )}
          >
            {currentRole?.icon && <currentRole.icon className="w-3 h-3" />}
            {currentRole?.label ?? user?.role}
          </span>
        </div>

        {/* 登出按鈕 */}
        <button
          onClick={logout}
          className="mt-3 text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> 登出帳號
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(`/${item.id}`)}
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
