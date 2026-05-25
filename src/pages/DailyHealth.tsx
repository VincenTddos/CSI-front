import React, { useState, useEffect } from 'react';
import { Clock, Save, Check, X, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { mockPatients } from '../lib/mockData';
import { CheckupStatus, Patient } from '../types';
import { cn } from '../lib/utils';

const DAILY_STORAGE_KEY = 'csi_daily_health';
const CHECKUP_STORAGE_KEY = 'csi_routine_checkup';
const PATIENTS_STORAGE_KEY = 'csi_patients';

// ===== Shared types =====
interface DailyRecord {
  patientId: string;
  patientName: string;
  bloodPressureSys: string;
  bloodPressureDia: string;
  bloodOxygen: string;
  measureTime: string;
}

interface CheckupRecord {
  patientId: string;
  patientName: string;
  weight: string;
  bloodSugar: string;
  urineStatus: CheckupStatus;
  stoolStatus: CheckupStatus;
  measureDate: string;
}

// ===== Get current patient list (syncs with admin additions) =====
function getCurrentPatients(): Patient[] {
  const saved = localStorage.getItem(PATIENTS_STORAGE_KEY);
  if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
  return mockPatients;
}

// ===== localStorage helpers (merge with current patient list) =====
function loadDailyRecords(): DailyRecord[] {
  const patients = getCurrentPatients();
  const saved = localStorage.getItem(DAILY_STORAGE_KEY);
  const existing: DailyRecord[] = saved ? (JSON.parse(saved) || []) : [];

  // Ensure every patient has a record (handles newly added patients)
  return patients.map(p => {
    const found = existing.find(r => r.patientId === p.id);
    if (found) return { ...found, patientName: p.name }; // update name in case it changed
    return { patientId: p.id, patientName: p.name, bloodPressureSys: '', bloodPressureDia: '', bloodOxygen: '', measureTime: '' };
  });
}

function loadCheckupRecords(): CheckupRecord[] {
  const patients = getCurrentPatients();
  const saved = localStorage.getItem(CHECKUP_STORAGE_KEY);
  const existing: CheckupRecord[] = saved ? (JSON.parse(saved) || []) : [];

  return patients.map(p => {
    const found = existing.find(r => r.patientId === p.id);
    if (found) return { ...found, patientName: p.name };
    return { patientId: p.id, patientName: p.name, weight: '', bloodSugar: '', urineStatus: '' as CheckupStatus, stoolStatus: '' as CheckupStatus, measureDate: '' };
  });
}

// =============================================
//  每日健康 (血壓、血氧)
// =============================================
export function DailyHealth() {
  const [records, setRecords] = useState<DailyRecord[]>(loadDailyRecords);
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const handleInputChange = (id: string, field: string, value: string) => {
    setRecords(prev => prev.map(r =>
      r.patientId === id ? { ...r, [field]: value } : r
    ));
  };

  const setNow = (id: string) => {
    const now = new Date();
    const s = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    handleInputChange(id, 'measureTime', s);
  };

  const handleSave = () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(records));
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2500);
  };

  return (
    <div className="p-6 h-full flex flex-col bg-[#F8FAFC]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">每日健康紀錄</h1>
          <p className="text-sm text-slate-500 mt-1">請為每位受護者填入今日的血壓與血氧數值，填完後按右上角「儲存」。</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0066CC] transition-colors text-sm font-medium"
        >
          <Save className="w-4 h-4" /> 儲存
        </button>
      </div>

      {/* 操作說明 */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
        💡 提示：在每一列直接輸入數值。「now」按鈕會自動填入目前時間。所有資料會在按下「儲存」後保留。
      </div>

      {showSavedMsg && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm max-w-xs">
          <CheckCircle2 className="w-4 h-4" /> 紀錄已儲存
        </div>
      )}

      <div className="flex-1 bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="font-medium p-4 py-3 w-40">姓名</th>
                <th className="font-medium p-4 py-3">收縮壓 (mmHg)</th>
                <th className="font-medium p-4 py-3">舒張壓 (mmHg)</th>
                <th className="font-medium p-4 py-3">血氧 (%)</th>
                <th className="font-medium p-4 py-3 border-l border-slate-200 pl-6">測量時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(record => (
                <tr key={record.patientId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 py-3 text-sm font-medium text-slate-800">{record.patientName}</td>
                  <td className="p-4 py-3">
                    <input type="number" value={record.bloodPressureSys}
                      onChange={e => handleInputChange(record.patientId, 'bloodPressureSys', e.target.value)}
                      placeholder="120"
                      className="w-20 text-center border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                    />
                  </td>
                  <td className="p-4 py-3">
                    <input type="number" value={record.bloodPressureDia}
                      onChange={e => handleInputChange(record.patientId, 'bloodPressureDia', e.target.value)}
                      placeholder="80"
                      className="w-20 text-center border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                    />
                  </td>
                  <td className="p-4 py-3">
                    <input type="number" value={record.bloodOxygen}
                      onChange={e => handleInputChange(record.patientId, 'bloodOxygen', e.target.value)}
                      placeholder="98"
                      className="w-20 text-center border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                    />
                  </td>
                  <td className="p-4 py-3 border-l border-slate-200 pl-6">
                    <div className="flex items-center gap-2">
                      <input type="text" value={record.measureTime}
                        onChange={e => handleInputChange(record.patientId, 'measureTime', e.target.value)}
                        placeholder="YYYY/MM/DD HH:mm"
                        className="w-44 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] font-mono"
                      />
                      <button
                        onClick={() => setNow(record.patientId)}
                        className="text-xs font-medium text-[#007AFF] hover:bg-blue-50 px-2 py-1.5 rounded border border-blue-100 transition-colors flex items-center gap-1"
                      >
                        <Clock className="w-3.5 h-3.5" /> now
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =============================================
//  日常檢查 (體重、血糖、尿液、糞便)
// =============================================
export function RoutineCheckup() {
  const [records, setRecords] = useState<CheckupRecord[]>(loadCheckupRecords);
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const handleInputChange = (id: string, field: string, value: string | CheckupStatus) => {
    setRecords(prev => prev.map(r => {
      if (r.patientId === id) {
        let newDate = r.measureDate;
        if ((field === 'weight' || field === 'bloodSugar' || field.includes('Status')) && value !== '' && !newDate) {
          const now = new Date();
          newDate = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
        }
        return { ...r, [field]: value, measureDate: newDate };
      }
      return r;
    }));
  };

  const handleSave = () => {
    localStorage.setItem(CHECKUP_STORAGE_KEY, JSON.stringify(records));
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2500);
  };

  const StatusButton = ({ type, active, onClick, label }: {
    type: 'normal' | 'warning' | 'abnormal', active: boolean, onClick: () => void, label: string
  }) => (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "w-9 h-9 flex justify-center items-center rounded-lg border transition-all duration-150",
        type === 'normal' && active ? "border-green-500 bg-green-50 text-green-600" :
        type === 'normal' && !active ? "border-slate-200 bg-white text-slate-300 hover:border-green-300 hover:text-green-400" :
        type === 'warning' && active ? "border-amber-500 bg-amber-50 text-amber-500" :
        type === 'warning' && !active ? "border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:text-amber-400" :
        type === 'abnormal' && active ? "border-red-500 bg-red-50 text-red-500" :
        "border-slate-200 bg-white text-slate-300 hover:border-red-300 hover:text-red-400"
      )}
    >
      {type === 'normal' && <Check className="w-4 h-4" strokeWidth={3} />}
      {type === 'warning' && <TriangleAlert className="w-4 h-4" />}
      {type === 'abnormal' && <X className="w-4 h-4" strokeWidth={3} />}
    </button>
  );

  return (
    <div className="p-6 h-full flex flex-col bg-[#F8FAFC]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">日常檢查紀錄</h1>
          <p className="text-sm text-slate-500 mt-1">請為每位受護者填入體重、血糖，並點選尿液/糞便的狀態按鈕。</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0066CC] transition-colors text-sm font-medium"
        >
          <Save className="w-4 h-4" /> 儲存
        </button>
      </div>

      {/* 操作說明 */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
        💡 提示：尿液/糞便欄位的三個按鈕分別代表 ✓正常、⚠留意、✗異常，點擊即可切換。日期會在輸入資料時自動帶入今天。
      </div>

      {showSavedMsg && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm max-w-xs">
          <CheckCircle2 className="w-4 h-4" /> 紀錄已儲存
        </div>
      )}

      <div className="flex-1 bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="font-medium p-4 py-3 w-36">姓名</th>
                <th className="font-medium p-4 py-3">體重 (kg)</th>
                <th className="font-medium p-4 py-3">血糖 (mg/dL)</th>
                <th className="font-medium p-4 py-3">
                  <div>尿液</div>
                  <div className="text-[10px] font-normal normal-case tracking-normal text-slate-400 mt-0.5">✓正常 ⚠留意 ✗異常</div>
                </th>
                <th className="font-medium p-4 py-3">
                  <div>糞便</div>
                  <div className="text-[10px] font-normal normal-case tracking-normal text-slate-400 mt-0.5">✓正常 ⚠留意 ✗異常</div>
                </th>
                <th className="font-medium p-4 py-3 border-l border-slate-200 pl-6 text-right">測量日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(record => (
                <tr key={record.patientId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 py-3 text-sm font-medium text-slate-800">{record.patientName}</td>
                  <td className="p-4 py-3">
                    <input type="number" value={record.weight}
                      onChange={e => handleInputChange(record.patientId, 'weight', e.target.value)}
                      placeholder="65"
                      className="w-20 text-center border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                    />
                  </td>
                  <td className="p-4 py-3">
                    <input type="number" value={record.bloodSugar}
                      onChange={e => handleInputChange(record.patientId, 'bloodSugar', e.target.value)}
                      placeholder="100"
                      className="w-20 text-center border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                    />
                  </td>
                  <td className="p-4 py-3">
                    <div className="flex gap-1.5">
                      <StatusButton type="normal" label="正常" active={record.urineStatus === 'normal'}
                        onClick={() => handleInputChange(record.patientId, 'urineStatus', record.urineStatus === 'normal' ? '' : 'normal')} />
                      <StatusButton type="warning" label="留意" active={record.urineStatus === 'warning'}
                        onClick={() => handleInputChange(record.patientId, 'urineStatus', record.urineStatus === 'warning' ? '' : 'warning')} />
                      <StatusButton type="abnormal" label="異常" active={record.urineStatus === 'abnormal'}
                        onClick={() => handleInputChange(record.patientId, 'urineStatus', record.urineStatus === 'abnormal' ? '' : 'abnormal')} />
                    </div>
                  </td>
                  <td className="p-4 py-3">
                    <div className="flex gap-1.5">
                      <StatusButton type="normal" label="正常" active={record.stoolStatus === 'normal'}
                        onClick={() => handleInputChange(record.patientId, 'stoolStatus', record.stoolStatus === 'normal' ? '' : 'normal')} />
                      <StatusButton type="warning" label="留意" active={record.stoolStatus === 'warning'}
                        onClick={() => handleInputChange(record.patientId, 'stoolStatus', record.stoolStatus === 'warning' ? '' : 'warning')} />
                      <StatusButton type="abnormal" label="異常" active={record.stoolStatus === 'abnormal'}
                        onClick={() => handleInputChange(record.patientId, 'stoolStatus', record.stoolStatus === 'abnormal' ? '' : 'abnormal')} />
                    </div>
                  </td>
                  <td className="p-4 py-3 border-l border-slate-200 pl-6 text-right">
                    <input type="text" value={record.measureDate}
                      onChange={e => handleInputChange(record.patientId, 'measureDate', e.target.value)}
                      placeholder="自動帶入"
                      className="w-28 text-right border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] font-mono"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
