// =============================================================================
//  DataContext — 單一事實來源 (Single Source of Truth)
//  全系統的住民 / 每日健康 / 日常檢查資料都從這裡來，所有頁面共用同一份狀態。
//
//  設計要點：
//   • 單一 store：所有資料持久化在唯一一把 localStorage key（csi_wicare_data_v1）。
//   • 資料同步：context 在 App 根節點，同分頁所有頁面自動連動；跨分頁靠 storage 事件。
//   • 參照完整性：健康/檢查記錄與警報皆以 patientId 外鍵指向住民；刪除住民時連動清除。
//   • 資料一致性：姓名/房號一律由 residents 即時推導，記錄不反正規化儲存姓名。
// =============================================================================
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { Patient, DailyVitals, CheckupVitals } from '../types';
import { seedResidents, seedDailyHealth, seedCheckups } from '../lib/seedData';
import { seedAlertsIfEmpty, deleteAlertsByResident } from '../services/alertsService';

const STORE_KEY = 'csi_wicare_data_v1';

// 舊版分散的 key（一次性遷移用）
const LEGACY_PATIENTS = 'csi_patients';
const LEGACY_DAILY = 'csi_daily_health';
const LEGACY_CHECKUP = 'csi_routine_checkup';

interface PersistedData {
  residents: Patient[];
  dailyHealth: Record<string, DailyVitals>;
  checkups: Record<string, CheckupVitals>;
}

type ResidentsUpdater = Patient[] | ((prev: Patient[]) => Patient[]);

interface DataContextValue {
  residents: Patient[];
  dailyHealth: Record<string, DailyVitals>;
  checkups: Record<string, CheckupVitals>;
  getResident: (id: string) => Patient | undefined;
  // 住民 CRUD（皆維持參照完整性）
  addResident: (p: Patient) => void;
  updateResident: (id: string, patch: Partial<Patient>) => void;
  deleteResident: (id: string) => void;
  replaceResidents: (next: ResidentsUpdater) => void;
  // 健康 / 檢查記錄
  setDailyVitals: (patientId: string, vitals: DailyVitals) => void;
  setManyDailyVitals: (entries: Record<string, DailyVitals>) => void;
  setCheckupVitals: (patientId: string, vitals: CheckupVitals) => void;
  setManyCheckups: (entries: Record<string, CheckupVitals>) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// 舊版 csi_daily_health 記錄（含反正規化 patientName）→ 以 patientId 為 key 的 map
function migrateDailyArray(arr: any[]): Record<string, DailyVitals> {
  const out: Record<string, DailyVitals> = {};
  for (const r of arr) {
    if (!r?.patientId) continue;
    out[r.patientId] = {
      bloodPressureSys: String(r.bloodPressureSys ?? ''),
      bloodPressureDia: String(r.bloodPressureDia ?? ''),
      bloodOxygen: String(r.bloodOxygen ?? ''),
      measureTime: String(r.measureTime ?? ''),
    };
  }
  return out;
}

function migrateCheckupArray(arr: any[]): Record<string, CheckupVitals> {
  const out: Record<string, CheckupVitals> = {};
  for (const r of arr) {
    if (!r?.patientId) continue;
    out[r.patientId] = {
      weight: String(r.weight ?? ''),
      bloodSugar: String(r.bloodSugar ?? ''),
      urineStatus: r.urineStatus ?? '',
      stoolStatus: r.stoolStatus ?? '',
      measureDate: String(r.measureDate ?? ''),
    };
  }
  return out;
}

/** 初始載入：新 key 優先 → 舊 key 遷移 → 種子資料。 */
function loadInitial(): PersistedData {
  const existing = localStorage.getItem(STORE_KEY);
  if (existing) {
    const d = safeParse<Partial<PersistedData>>(existing, {});
    return {
      residents: d.residents ?? seedResidents,
      dailyHealth: d.dailyHealth ?? {},
      checkups: d.checkups ?? {},
    };
  }

  // 一次性遷移舊版分散資料；若舊版住民為空/缺失，整份退回種子，確保 demo 一定有資料。
  const legacyResidents = safeParse<Patient[]>(localStorage.getItem(LEGACY_PATIENTS), []);
  if (legacyResidents.length > 0) {
    return {
      residents: legacyResidents,
      dailyHealth: migrateDailyArray(safeParse<any[]>(localStorage.getItem(LEGACY_DAILY), [])),
      checkups: migrateCheckupArray(safeParse<any[]>(localStorage.getItem(LEGACY_CHECKUP), [])),
    };
  }

  return {
    residents: seedResidents,
    dailyHealth: seedDailyHealth,
    checkups: seedCheckups,
  };
}

/** 移除某住民時，連動清掉其健康/檢查記錄與警報（參照完整性）。 */
function pruneByResidents<T>(map: Record<string, T>, validIds: Set<string>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, v] of Object.entries(map)) if (validIds.has(id)) out[id] = v;
  return out;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PersistedData>(loadInitial);
  const skipPersist = useRef(false);

  // 首次啟動注入示範警報（單一警報 store）
  useEffect(() => { seedAlertsIfEmpty(); }, []);

  // 任一變更即持久化到唯一 store key
  useEffect(() => {
    if (skipPersist.current) { skipPersist.current = false; return; }
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }, [data]);

  // 跨分頁同步：其他分頁寫入同一 key 時，重新載入狀態（不回寫，避免迴圈）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORE_KEY || e.newValue == null) return;
      skipPersist.current = true;
      setData(safeParse<PersistedData>(e.newValue, data));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [data]);

  const getResident = useCallback(
    (id: string) => data.residents.find(r => r.id === id),
    [data.residents],
  );

  const replaceResidents = useCallback((next: ResidentsUpdater) => {
    setData(prev => {
      const residents = typeof next === 'function' ? next(prev.residents) : next;
      const validIds = new Set(residents.map(r => r.id));
      // 偵測被移除的住民 → 連動清除其警報
      for (const old of prev.residents) {
        if (!validIds.has(old.id)) deleteAlertsByResident(old.id);
      }
      return {
        residents,
        dailyHealth: pruneByResidents(prev.dailyHealth, validIds),
        checkups: pruneByResidents(prev.checkups, validIds),
      };
    });
  }, []);

  const addResident = useCallback((p: Patient) => {
    setData(prev => ({ ...prev, residents: [...prev.residents, p] }));
  }, []);

  const updateResident = useCallback((id: string, patch: Partial<Patient>) => {
    setData(prev => ({
      ...prev,
      residents: prev.residents.map(r => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const deleteResident = useCallback((id: string) => {
    deleteAlertsByResident(id); // 連動清除警報
    setData(prev => {
      const residents = prev.residents.filter(r => r.id !== id);
      const validIds = new Set(residents.map(r => r.id));
      return {
        residents,
        dailyHealth: pruneByResidents(prev.dailyHealth, validIds),
        checkups: pruneByResidents(prev.checkups, validIds),
      };
    });
  }, []);

  const setDailyVitals = useCallback((patientId: string, vitals: DailyVitals) => {
    setData(prev => ({ ...prev, dailyHealth: { ...prev.dailyHealth, [patientId]: vitals } }));
  }, []);

  const setManyDailyVitals = useCallback((entries: Record<string, DailyVitals>) => {
    setData(prev => ({ ...prev, dailyHealth: { ...prev.dailyHealth, ...entries } }));
  }, []);

  const setCheckupVitals = useCallback((patientId: string, vitals: CheckupVitals) => {
    setData(prev => ({ ...prev, checkups: { ...prev.checkups, [patientId]: vitals } }));
  }, []);

  const setManyCheckups = useCallback((entries: Record<string, CheckupVitals>) => {
    setData(prev => ({ ...prev, checkups: { ...prev.checkups, ...entries } }));
  }, []);

  const value: DataContextValue = {
    residents: data.residents,
    dailyHealth: data.dailyHealth,
    checkups: data.checkups,
    getResident,
    addResident,
    updateResident,
    deleteResident,
    replaceResidents,
    setDailyVitals,
    setManyDailyVitals,
    setCheckupVitals,
    setManyCheckups,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData 必須在 <DataProvider> 內使用');
  return ctx;
}
