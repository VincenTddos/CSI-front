import { useCallback, useEffect, useState } from 'react';
import type { Patient } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { listResidents } from '../services/residentsService';
import { residentRowToPatient } from '../lib/mappers';
import { mockPatients } from '../lib/mockData';

const PATIENTS_STORAGE_KEY = 'csi_patients';

// 未連 Supabase 時：localStorage 的本機編輯優先，否則 demo 種子資料
function loadLocalPatients(): Patient[] {
  const saved = localStorage.getItem(PATIENTS_STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { /* ignore */ }
  }
  return mockPatients;
}

/**
 * 共用住民資料來源：已設定 Supabase → residents 表（map 成 Patient，附房名）；
 * 未設定 → localStorage / mockData。回傳載入三態，供各頁顯示 loading/error/empty。
 */
export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured) {
        setPatients(loadLocalPatients());
        return;
      }
      const [rows, roomsRes] = await Promise.all([
        listResidents(),
        supabase.from('rooms').select('id, name'),
      ]);
      const roomName = new Map<string, string>(
        (roomsRes.data ?? []).map((r: any) => [r.id, r.name]),
      );
      setPatients(rows.map(r => residentRowToPatient(r, r.room_id ? roomName.get(r.room_id) : undefined)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入住民資料失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { patients, loading, error, reload, setPatients };
}
