// =============================================================================
//  資料庫資料列型別 — 對應 supabase/migrations/0001_initial_schema.sql
//  （前端與 service 層共用，確保型別安全）
// =============================================================================

export type UserRole = 'developer' | 'medical' | 'family' | 'admin';
export type GenderType = '男' | '女';
export type DeviceStatus = 'online' | 'offline' | 'error';
export type AlertStatus = 'pending' | 'confirmed' | 'false_alarm';
export type CheckupStatus = 'normal' | 'abnormal' | 'warning' | '';

export interface RoomRow {
  id: string;
  name: string;
  width_m: number;
  height_m: number;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  real_name: string;
  role: UserRole;
  unit_code: string | null;
  family_code: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface DeviceRow {
  id: string;
  name: string;
  room_id: string | null;
  mac_address: string | null;
  firmware: string | null;
  status: DeviceStatus;
  last_seen_at: string | null;
  created_at: string;
}

export interface ResidentRow {
  id: string;
  name: string;
  gender: GenderType | null;
  birth_date: string | null;
  room_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  medications: string[];
  medical_history: string[];
  notes: string | null;
  family_user_id: string | null;
  created_at: string;
}

export interface FallEventRow {
  id: string;
  device_id: string | null;
  resident_id: string | null;
  movement_score: number | null;
  location_x: number | null;
  location_y: number | null;
  event_type: string;
  confidence: number | null;
  status: AlertStatus;
  feedback_note: string | null;
  acknowledged_by: string | null;
  detected_at: string;
}

export interface ActivitySummaryRow {
  id: string;
  device_id: string | null;
  resident_id: string | null;
  bucket_time: string;
  activity_level: string | null;
  avg_score: number | null;
  max_score: number | null;
  sample_count: number;
  created_at: string;
}

export interface DailyHealthRow {
  id: string;
  resident_id: string;
  record_date: string;
  record_time: string | null;
  bp_sys: number | null;
  bp_dia: number | null;
  blood_oxygen: number | null;
  recorded_by: string | null;
  created_at: string;
}

export interface RoutineCheckupRow {
  id: string;
  resident_id: string;
  record_date: string;
  weight: number | null;
  blood_sugar: number | null;
  urine_status: CheckupStatus;
  stool_status: CheckupStatus;
  recorded_by: string | null;
  created_at: string;
}

export interface DeviceSettingsRow {
  device_id: string;
  algorithm: string;
  threshold_mode: string;
  manual_threshold: number | null;
  sensitivity: number;
  line_notify_enabled: boolean;
  adaptive_filter: boolean;
  hampel_filter: boolean;
  smoothing: boolean;
  updated_at: string;
}

// ---- 分析檢視表 ----
export interface DailyFallStatRow {
  resident_id: string;
  day: string;
  total_events: number;
  confirmed_events: number;
  false_alarms: number;
  pending_events: number;
}

export interface DailyActivityRow {
  resident_id: string;
  day: string;
  avg_activity: number;
  peak_activity: number;
  total_samples: number;
}

export interface DeviceHealthRow {
  id: string;
  name: string;
  status: DeviceStatus;
  last_seen_at: string | null;
  is_live: boolean;
}
