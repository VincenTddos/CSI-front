import React, { useState, useEffect } from 'react';
import { MapPin, User, Clock, Activity, Wifi, AlertTriangle, Moon, Footprints } from 'lucide-react';
import { cn } from '../lib/utils';

interface RoomStatus {
  id: string;
  name: string;
  floor: string;
  status: 'motion' | 'idle' | 'empty';
  lastActivity: string;
  movementScore: number;
  sensorName: string;
  sensorSignal: number;
  resident?: string;
}

function generateRooms(): RoomStatus[] {
  return [
    { id: 'r502', name: '502 號房', floor: '5F', status: 'motion', lastActivity: '剛剛', movementScore: 72, sensorName: 'CSI-Node-502', sensorSignal: -42, resident: '王伯伯' },
    { id: 'r503', name: '503 號房', floor: '5F', status: 'idle', lastActivity: '8 分鐘前', movementScore: 3, sensorName: 'CSI-Node-503', sensorSignal: -48, resident: '陳奶奶' },
    { id: 'r504', name: '504 號房', floor: '5F', status: 'empty', lastActivity: '2 小時前', movementScore: 0, sensorName: 'CSI-Node-504', sensorSignal: -55 },
    { id: 'r606', name: '606 號房', floor: '6F', status: 'motion', lastActivity: '剛剛', movementScore: 58, sensorName: 'CSI-Node-606', sensorSignal: -45, resident: '李伯伯' },
    { id: 'r607', name: '607 號房', floor: '6F', status: 'idle', lastActivity: '15 分鐘前', movementScore: 5, sensorName: 'CSI-Node-607', sensorSignal: -50, resident: '張奶奶' },
    { id: 'r608', name: '608 號房', floor: '6F', status: 'motion', lastActivity: '剛剛', movementScore: 45, sensorName: 'CSI-Node-608', sensorSignal: -47, resident: '林伯伯' },
    { id: 'r609', name: '609 號房', floor: '6F', status: 'empty', lastActivity: '1 小時前', movementScore: 0, sensorName: 'CSI-Node-609', sensorSignal: -90 },
    { id: 'r611', name: '611 號房', floor: '6F', status: 'idle', lastActivity: '22 分鐘前', movementScore: 2, sensorName: 'CSI-Node-611', sensorSignal: -52, resident: '黃爺爺' },
    { id: 'common5', name: '5F 交誼廳', floor: '5F', status: 'motion', lastActivity: '剛剛', movementScore: 85, sensorName: 'CSI-Node-5F-Common', sensorSignal: -38 },
    { id: 'common6', name: '6F 交誼廳', floor: '6F', status: 'idle', lastActivity: '35 分鐘前', movementScore: 1, sensorName: 'CSI-Node-6F-Common', sensorSignal: -44 },
  ];
}

export function RoomOccupancy() {
  const [rooms, setRooms] = useState(generateRooms);
  const [filterFloor, setFilterFloor] = useState<'all' | '5F' | '6F'>('all');

  // Simulate movement score updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRooms(prev => prev.map(r => {
        const delta = (Math.random() - 0.5) * 10;
        let newScore = Math.max(0, Math.min(100, r.movementScore + delta));
        let newStatus: RoomStatus['status'] = 'empty';
        if (newScore > 15) newStatus = 'motion';
        else if (newScore > 2) newStatus = 'idle';
        const newLastActivity = newStatus === 'motion' ? '剛剛' : r.lastActivity;
        return { ...r, movementScore: Math.round(newScore), status: newStatus, lastActivity: newLastActivity };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = rooms.filter(r => filterFloor === 'all' || r.floor === filterFloor);
  const motionCount = rooms.filter(r => r.status === 'motion').length;
  const idleCount = rooms.filter(r => r.status === 'idle').length;
  const emptyCount = rooms.filter(r => r.status === 'empty').length;

  const getStatusConfig = (status: RoomStatus['status']) => {
    switch (status) {
      case 'motion': return { label: '活動中', color: 'bg-green-500', textColor: 'text-green-600', bgColor: 'bg-green-50 border-green-100', icon: Footprints };
      case 'idle': return { label: '靜止中', color: 'bg-blue-400', textColor: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-100', icon: Moon };
      case 'empty': return { label: '無人', color: 'bg-slate-300', textColor: 'text-slate-400', bgColor: 'bg-slate-50 border-slate-100', icon: MapPin };
    }
  };

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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><Wifi className="w-5 h-5 text-slate-500" /></div>
          <div><p className="text-xs text-slate-500">總感測節點</p><p className="text-lg font-bold text-slate-800">{rooms.length}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-green-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><Footprints className="w-5 h-5 text-green-500" /></div>
          <div><p className="text-xs text-slate-500">活動中</p><p className="text-lg font-bold text-green-600">{motionCount}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Moon className="w-5 h-5 text-blue-400" /></div>
          <div><p className="text-xs text-slate-500">靜止 (有人)</p><p className="text-lg font-bold text-blue-600">{idleCount}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center"><MapPin className="w-5 h-5 text-slate-400" /></div>
          <div><p className="text-xs text-slate-500">無人</p><p className="text-lg font-bold text-slate-400">{emptyCount}</p></div>
        </div>
      </div>

      {/* Floor filter */}
      <div className="flex items-center gap-2">
        {(['all', '5F', '6F'] as const).map(floor => (
          <button key={floor} onClick={() => setFilterFloor(floor)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
              filterFloor === floor ? "bg-[#007AFF] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}>
            {floor === 'all' ? '全部樓層' : floor}
          </button>
        ))}
      </div>

      {/* Room Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(room => {
            const cfg = getStatusConfig(room.status);
            const Icon = cfg.icon;
            return (
              <div key={room.id} className={cn("bg-white rounded-xl border p-4 transition-all hover:shadow-md", cfg.bgColor)}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", cfg.color, room.status === 'motion' && "animate-pulse")} />
                    <h3 className="text-sm font-bold text-slate-800">{room.name}</h3>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{room.floor}</span>
                  </div>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", cfg.textColor, cfg.bgColor)}>
                    <Icon className="w-3 h-3 inline mr-0.5" />{cfg.label}
                  </span>
                </div>

                {room.resident && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
                    <User className="w-3 h-3 text-slate-400" /> {room.resident}
                  </div>
                )}

                {/* Movement Score Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-slate-400">Movement Score</span>
                    <span className="font-mono font-bold text-slate-700">{room.movementScore}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-1000",
                      room.movementScore > 50 ? "bg-green-500" : room.movementScore > 10 ? "bg-blue-400" : "bg-slate-300"
                    )} style={{ width: `${room.movementScore}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {room.lastActivity}</span>
                  <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> {room.sensorSignal} dBm</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
