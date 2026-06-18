import { useCallback } from 'react';
import { useData } from '../contexts/DataContext';

/**
 * 共用住民資料來源（相容舊介面）。
 * 實際資料由 DataContext（單一事實來源）提供，所有頁面共用同一份狀態，
 * 任一頁面新增/編輯/刪除都會即時反映到其他頁面。
 */
export function usePatients() {
  const { residents, replaceResidents } = useData();
  // SSOT 為記憶體中的 context 狀態，永遠是最新，無需非同步重載。
  const reload = useCallback(() => {}, []);

  return {
    patients: residents,
    loading: false,
    error: null as string | null,
    reload,
    setPatients: replaceResidents,
  };
}
