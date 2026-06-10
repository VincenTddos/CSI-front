// =============================================================================
//  mappers — 資料庫資料列 (snake_case) ↔ 前端型別 (camelCase) 轉換
// =============================================================================
import type { Patient } from '../types';
import type { ResidentRow } from '../services/database.types';

function ageFromBirthDate(birthDate: string | null): number {
  if (!birthDate) return 0;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(0, age);
}

/** residents 資料列 → 前端 Patient（roomName 可選，沒有則顯示房號 id 或「—」）。 */
export function residentRowToPatient(row: ResidentRow, roomName?: string): Patient {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender ?? '男',
    birthDate: (row.birth_date ?? '').replace(/-/g, '/'),
    age: ageFromBirthDate(row.birth_date),
    roomNumber: roomName ?? row.room_id ?? '—',
    contactName: row.contact_name ?? '',
    contactPhone: row.contact_phone ?? '',
    medications: row.medications ?? [],
    medicalHistory: row.medical_history ?? [],
    notes: row.notes ?? '',
  };
}
