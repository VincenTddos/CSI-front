export type UserRole = 'developer' | 'medical' | 'family' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  assignedRooms?: string[]; // For medical staff
  patientName?: string; // For family members
}

export interface CSIDataPacket {
  check: string;      // 例如 "CSI"
  mac: string;       // 設備 MAC
  len: number;       // 數據長度
  first: number;     // 第一個 byte
  data: number[];    // CSI 振幅數據 (通常 64 或 128 個數值)
  path: string;      // 路由路徑
}

export interface MovementData {
  score: number;     // 移動分數 (Movement Score)
  isMotion: boolean; // 是否偵測到活動
}

// 來自 core_bridge.py 的完整狀態封包
export interface CoreBridgePacket {
  status: 'online' | 'offline';
  data_source?: string;
  ai_analysis: {
    is_falling: boolean;
    movement_score: number;
    raw_movement_score?: number;
    movement_value?: number | null;
    movement_threshold?: number | null;
  };
  location: {
    raw_x: number | null;
    raw_y: number | null;
  };
  // CSI 連結即時資訊（Serial 模式由 ESPectre 韌體那行解析；無資料則為 null）
  csi_link?: {
    pkt_rate: number | null;  // 每秒 CSI 封包數
    channel: number | null;   // Wi-Fi 頻道
    rssi: number | null;      // 訊號強度 (dBm)
  };
  settings?: SystemSettingsState;
  timestamp: string; // ISO8601
}

export interface SystemSettingsState {
  algorithm: 'mvs' | 'ml';
  thresholdMode: 'auto' | 'min' | 'manual';
  manualThreshold: number | null;
  sensitivity: number;
  lineNotifyEnabled: boolean;
  lineToken?: string;       // LINE Messaging API channel access token（僅上行，不會被廣播回前端）
  lineUserId?: string;      // 推播接收者 userId（僅上行）
  adaptiveFilterEnabled: boolean;
  hampelFilterEnabled: boolean;
  smoothingEnabled: boolean;
  lastApplied?: string | null;
  bleWriteStatus?: string;
}

// core_bridge.py 對 settings_update 的回覆封包
export interface SettingsAckPacket {
  type: 'settings_ack';
  settings: SystemSettingsState;
  timestamp: string; // ISO8601
}

// Wi-Fi 三角定位座標
export interface LocationData {
  x: number | null;
  y: number | null;
  timestamp: string;
}

export interface Patient {
  id: string;
  name: string;
  gender: '男' | '女';
  birthDate: string; // YYYY/MM/DD
  age: number;
  roomNumber: string;
  contactName: string;
  contactPhone: string;
  medications: string[];
  medicalHistory: string[];
  notes: string;
}

export interface DailyHealthRecord {
  patientId: string;
  patientName: string;
  date: string; // YYYY/MM/DD
  time: string; // HH:mm
  bloodPressureSys: string | number;
  bloodPressureDia: string | number;
  bloodOxygen: string | number;
}

export type CheckupStatus = 'normal' | 'abnormal' | 'warning' | '';

export interface RoutineCheckupRecord {
  patientId: string;
  patientName: string;
  date: string; // YYYY/MM/DD
  weight: string | number;
  bloodSugar: string | number;
  urineStatus: CheckupStatus;
  stoolStatus: CheckupStatus;
}

// =============================================================================
//  SSOT 正規化記錄型別 — DataContext 內以 patientId 為外鍵存放，姓名/房號一律
//  由 residents 即時推導（不反正規化），確保參照完整性與資料一致性。
// =============================================================================

/** 每日健康量測（血壓 / 血氧）。以 patientId 對應，不含姓名。 */
export interface DailyVitals {
  bloodPressureSys: string;
  bloodPressureDia: string;
  bloodOxygen: string;
  measureTime: string; // YYYY/MM/DD HH:mm
}

/** 日常檢查（體重 / 血糖 / 排泄）。以 patientId 對應，不含姓名。 */
export interface CheckupVitals {
  weight: string;
  bloodSugar: string;
  urineStatus: CheckupStatus;
  stoolStatus: CheckupStatus;
  measureDate: string; // YYYY/MM/DD
}

export type Page = 
  | 'login' 
  | 'register' 
  | 'device' 
  | 'personnel' 
  | 'realtime' 
  | 'alerts' 
  | 'health' 
  | 'settings'
  | 'patients'
  | 'daily-health'
  | 'routine-checkup'
  | 'health-log'
  | 'occupancy'
  | 'overview';
