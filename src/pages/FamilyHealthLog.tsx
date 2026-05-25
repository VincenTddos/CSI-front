import React, { useState, useEffect } from 'react';
import { RefreshCcw, HeartPulse, ClipboardList, Pill } from 'lucide-react';
import { mockPatients } from '../lib/mockData';
import { useUser } from '../contexts/UserContext';

const DAILY_STORAGE_KEY = 'csi_daily_health';
const CHECKUP_STORAGE_KEY = 'csi_routine_checkup';
const PATIENTS_STORAGE_KEY = 'csi_patients';

function loadSavedPatients() {
  const saved = localStorage.getItem(PATIENTS_STORAGE_KEY);
  if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
  return mockPatients;
}

function loadDailyRecords() {
  const saved = localStorage.getItem(DAILY_STORAGE_KEY);
  if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
  return [];
}

function loadCheckupRecords() {
  const saved = localStorage.getItem(CHECKUP_STORAGE_KEY);
  if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
  return [];
}

export function FamilyHealthLog() {
  const { user } = useUser();
  const [patients] = useState(loadSavedPatients);
  const [currentPatientIndex, setCurrentPatientIndex] = useState(0);

  const patient = patients[currentPatientIndex];

  const dailyRecords = loadDailyRecords();
  const checkupRecords = loadCheckupRecords();

  const dailyRecord = dailyRecords.find((r: any) => r.patientId === patient.id);
  const checkupRecord = checkupRecords.find((r: any) => r.patientId === patient.id);

  const handleSwitchPatient = () => {
    setCurrentPatientIndex((prev) => (prev + 1) % patients.length);
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'normal': return <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded text-sm">正常</span>;
      case 'warning': return <span className="text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded text-sm">留意</span>;
      case 'abnormal': return <span className="text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded text-sm">異常</span>;
      default: return <span className="text-slate-400 text-sm">未紀錄</span>;
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">健康日誌</h1>
        <p className="text-sm text-slate-500 mt-1">查看您家人的健康數據摘要（由醫護人員更新）</p>
      </div>

      <div className="flex-1 bg-[#F1F5F9] rounded-2xl border border-slate-200 shadow-inner p-8 overflow-y-auto max-w-4xl mx-auto w-full">

        {/* 個人資料頭部 */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-8">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-[#007AFF] text-2xl font-bold">
              {patient.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{patient.name} <span className="text-base font-normal text-slate-500">{patient.gender}</span></h2>
              <div className="mt-1 text-sm text-slate-600">
                生日 {patient.birthDate} ({patient.age}歲) ・ 房號 {patient.roomNumber}
              </div>
            </div>
          </div>
          <button
            onClick={handleSwitchPatient}
            className="flex items-center gap-2 px-3 py-2 bg-white text-slate-600 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <RefreshCcw className="w-4 h-4" /> 切換
          </button>
        </div>

        <div className="space-y-8">

          {/* 日常用藥 */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Pill className="w-4 h-4" /> 日常用藥
            </h3>
            {patient.medications.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {patient.medications.map((med: string, idx: number) => (
                  <span key={idx} className="bg-blue-50 text-[#007AFF] border border-blue-100 px-3 py-1.5 rounded-full text-sm font-medium">
                    {med}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">目前沒有用藥紀錄</p>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 每日健康 */}
            <section className="bg-white shadow-sm rounded-xl p-5 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-500" /> 每日健康
                </h3>
                {dailyRecord?.measureTime && (
                  <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                    更新：{dailyRecord.measureTime}
                  </span>
                )}
              </div>
              {dailyRecord && (dailyRecord.bloodPressureSys || dailyRecord.bloodOxygen) ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">血壓</span>
                    <span className="text-lg font-bold text-slate-800">
                      {dailyRecord.bloodPressureSys || '-'} / {dailyRecord.bloodPressureDia || '-'} <span className="text-xs font-normal text-slate-400">mmHg</span>
                    </span>
                  </div>
                  <hr className="border-slate-200/60"/>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">血氧</span>
                    <span className="text-lg font-bold text-slate-800">
                      {dailyRecord.bloodOxygen || '-'} <span className="text-xs font-normal text-slate-400">%</span>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm py-4 text-center">尚未有紀錄，請等待醫護人員更新</p>
              )}
            </section>

            {/* 日常檢查 */}
            <section className="bg-white shadow-sm rounded-xl p-5 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-500" /> 日常檢查
                </h3>
                {checkupRecord?.measureDate && (
                  <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                    更新：{checkupRecord.measureDate}
                  </span>
                )}
              </div>
              {checkupRecord && (checkupRecord.weight || checkupRecord.bloodSugar || checkupRecord.urineStatus || checkupRecord.stoolStatus) ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-500 block mb-0.5">體重</span>
                      <span className="text-lg font-bold text-slate-800">{checkupRecord.weight || '-'} <span className="text-xs font-normal text-slate-400">kg</span></span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block mb-0.5">血糖</span>
                      <span className="text-lg font-bold text-slate-800">{checkupRecord.bloodSugar || '-'} <span className="text-xs font-normal text-slate-400">mg/dL</span></span>
                    </div>
                  </div>
                  <hr className="border-slate-200/60"/>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">尿液</span>
                      {renderStatus(checkupRecord.urineStatus)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">糞便</span>
                      {renderStatus(checkupRecord.stoolStatus)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm py-4 text-center">尚未有紀錄，請等待醫護人員更新</p>
              )}
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
