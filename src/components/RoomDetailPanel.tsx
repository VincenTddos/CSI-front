import React from 'react';
import { ArrowLeft, User, Phone, Wifi, Activity, HeartPulse, Pill, ClipboardList, FileText, Droplets, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Patient } from '../types';
import { RoomStatus } from './RoomGrid';
import { useNavigate } from 'react-router-dom';

interface RoomDetailPanelProps {
  room: RoomStatus;
  patient: Patient | null;
  onClose: () => void;
}

export function RoomDetailPanel({ room, patient, onClose }: RoomDetailPanelProps) {
  const navigate = useNavigate();

  const getStatusBadge = () => {
    switch (room.status) {
      case 'motion': return { label: '活動中', className: 'bg-green-100 text-green-700 border-green-200' };
      case 'idle': return { label: '靜止中', className: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'empty': return { label: '無人', className: 'bg-slate-100 text-slate-500 border-slate-200' };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="absolute inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute inset-0 bg-white rounded-2xl z-10 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2C363F] to-[#3A4651] px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <div>
              <h3 className="text-white font-bold text-sm">{room.name}</h3>
              <p className="text-slate-400 text-[10px]">Wi-Care 即時監測</p>
            </div>
          </div>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", badge.className)}>
            {badge.label}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Room & Resident Info */}
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-800">{room.name}</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              最後偵測：{room.lastActivity}
            </p>
            {patient ? (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#007AFF] text-sm font-bold">
                  {patient.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{patient.name}</p>
                  <p className="text-[10px] text-slate-500">{patient.gender}・{patient.age}歲・{patient.roomNumber} 號房</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-1">（未登記住民）</p>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full border", badge.className)}>
              {badge.label}
            </span>
            <span className="text-[10px] font-medium px-2 py-1 rounded-full border border-green-200 bg-green-50 text-green-700">
              設備已啟動
            </span>
            <span className="text-[10px] font-mono px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              {room.sensorName}
            </span>
          </div>

          {/* Sensor Details */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">感測器狀態</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-slate-500">Movement Score</p>
                <p className={cn("text-lg font-bold font-mono",
                  room.movementScore > 50 ? 'text-red-500' : room.movementScore > 20 ? 'text-amber-500' : 'text-green-600'
                )}>{room.movementScore}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">訊號強度</p>
                <p className="text-lg font-bold font-mono text-slate-700">{room.sensorSignal} <span className="text-xs text-slate-400">dBm</span></p>
              </div>
            </div>
            {/* Movement bar */}
            <div className="mt-2">
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-1000",
                  room.movementScore > 50 ? "bg-red-500" : room.movementScore > 20 ? "bg-amber-400" : "bg-green-500"
                )} style={{ width: `${room.movementScore}%` }} />
              </div>
            </div>
          </div>

          {/* Patient Details (if available) */}
          {patient && (
            <>
              {/* Medications */}
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Pill className="w-3 h-3" /> 日常用藥
                </h4>
                {patient.medications.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {patient.medications.map((med, i) => (
                      <span key={i} className="text-[10px] font-medium px-2 py-1 rounded-full bg-blue-50 text-[#007AFF] border border-blue-100">
                        {med}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400">尚無用藥紀錄</p>
                )}
              </div>

              {/* Medical History */}
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> 病史
                </h4>
                <p className="text-xs text-slate-700">
                  {patient.medicalHistory.length > 0 ? patient.medicalHistory.join('、') : '無特殊病史'}
                </p>
              </div>

              {/* Contact */}
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">聯絡人</h4>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-700">{patient.contactName}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" />{patient.contactPhone}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Quick Actions */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">快捷操作</h4>
            <div className="grid grid-cols-2 gap-2">
              {patient && (
                <button
                  onClick={() => navigate('/patients')}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-left"
                >
                  <User className="w-3.5 h-3.5 text-[#007AFF]" />
                  <span className="text-[11px] font-medium text-slate-700">編輯資料</span>
                </button>
              )}
              <button
                onClick={() => navigate('/daily-health')}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-left"
              >
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[11px] font-medium text-slate-700">生命徵象</span>
              </button>
              <button
                onClick={() => navigate('/routine-checkup')}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-left"
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-medium text-slate-700">日常檢查</span>
              </button>
              <button
                onClick={() => navigate('/health')}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-left"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-medium text-slate-700">健康報表</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="shrink-0 bg-gradient-to-r from-[#34C759] to-[#30D158] px-4 py-2 text-center">
          <p className="text-[10px] text-white font-medium">
            {room.name} 狀態{room.status === 'motion' ? '活動' : '正常'} — 最後偵測：{room.lastActivity} — Wi-Care 智慧監測系統持續守護中
          </p>
        </div>
      </div>
    </div>
  );
}
