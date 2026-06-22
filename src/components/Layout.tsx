import React, { Suspense, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Outlet, useNavigate } from 'react-router-dom';
import { WifiOff, ChevronRight, X, Menu, Activity } from 'lucide-react';
import { getOfflineDevices } from '../lib/demoDevices';

interface LayoutProps {
  children?: React.ReactNode;
}

/** 全站感測器離線告警橫幅：任一裝置心跳逾期即提示，點擊前往區域管理。 */
function OfflineDevicesBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const offline = getOfflineDevices();
  if (dismissed || offline.length === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
        <WifiOff className="h-4 w-4 text-amber-600" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-800">
          {offline.length} 台感測器離線
        </p>
        <p className="truncate text-xs text-amber-600">
          {offline.map((d) => `${d.room}（${d.lastSeenMin} 分鐘無回報）`).join('、')}——該區域暫時無法偵測
        </p>
      </div>
      <button
        onClick={() => navigate('/device')}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600"
      >
        前往查看 <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => setDismissed(true)} className="shrink-0 rounded-md p-1 text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-600" title="本次隱藏">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[#E8E1D5] text-slate-800 font-sans overflow-hidden">
      {/* 手機抽屜背景遮罩（點擊關閉） */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} aria-hidden />
      )}

      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* 手機頂欄：漢堡選單 + 品牌（桌機隱藏，側欄已常駐） */}
        <header className="md:hidden flex items-center gap-3 h-14 px-4 bg-[#2C363F] text-white shrink-0 shadow">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="開啟選單"
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#007AFF] rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-wide">Wi-Care</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto h-full">
            <OfflineDevicesBanner />
            {/* 受保護頁面的 lazy 載入邊界：切換頁面時側邊欄保留、僅內容區顯示載入指示 */}
            <Suspense fallback={
              <div className="min-h-[50vh] w-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <Outlet />
            </Suspense>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
