import React from 'react';
import { RoomGrid } from '../components/RoomGrid';

export function RoomOccupancy() {
  return (
    <div className="h-full flex flex-col space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">房間佔用總覽</h1>
          <p className="text-sm text-slate-500 mt-1">即時顯示各感測區域的佔用狀態與活動強度</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-100 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-slate-600 font-medium">即時更新中</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <RoomGrid />
      </div>
    </div>
  );
}
