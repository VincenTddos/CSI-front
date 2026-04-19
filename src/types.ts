export type UserRole = 'medical' | 'family' | 'admin';

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
  ai_analysis: {
    is_falling: boolean;
    movement_score: number;
  };
  location: {
    raw_x: number | null;
    raw_y: number | null;
  };
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
  | 'subcarrier'
  | 'occupancy';
