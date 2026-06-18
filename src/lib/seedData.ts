// =============================================================================
//  seedData — 單一事實來源 (SSOT) 的示範種子資料
//  DataContext 首次初始化時載入。所有頁面共用同一份；記錄一律以 patientId 外鍵
//  指向住民，姓名/房號由 residents 即時推導，確保參照完整性與資料一致性。
// =============================================================================
import type { Patient, DailyVitals, CheckupVitals } from '../types';
import type { FallEventRow } from '../services/database.types';

/** 住民（被照護者）種子 — 全系統唯一的住民清單來源。 */
export const seedResidents: Patient[] = [
  { id: 'p001', name: '王小明', gender: '男', birthDate: '1952/03/15', age: 74, roomNumber: '606', contactName: '王大壯', contactPhone: '0912-345-678', medications: ['Aspirin', 'Metformin'], medicalHistory: ['高血壓', '糖尿病'], notes: '注意飲食控制' },
  { id: 'p002', name: '林美麗', gender: '女', birthDate: '1949/08/22', age: 77, roomNumber: '503', contactName: '林金雄', contactPhone: '0987-654-321', medications: ['Losartan', 'Amlodipine'], medicalHistory: ['高血壓'], notes: '有關節炎，行動不便' },
  { id: 'p003', name: '邱月雲', gender: '女', birthDate: '1956/12/05', age: 70, roomNumber: '611', contactName: '張建志', contactPhone: '0922-111-222', medications: ['Atorvastatin'], medicalHistory: ['高血脂'], notes: '睡眠質量差' },
  { id: 'p004', name: '洪建國', gender: '男', birthDate: '1946/05/10', age: 80, roomNumber: '502', contactName: '洪志明', contactPhone: '0933-444-555', medications: ['Digoxin', 'Furosemide'], medicalHistory: ['心臟病', '慢性腎衰竭'], notes: '需定時量血壓' },
  { id: 'p005', name: '李秀英', gender: '女', birthDate: '1946/01/01', age: 80, roomNumber: '510', contactName: '陳俊宏', contactPhone: '0966-777-888', medications: ['Acertil', 'Digoxin'], medicalHistory: ['心臟病', '高血壓'], notes: '' },
  { id: 'p006', name: '陳雅婷', gender: '女', birthDate: '1957/11/20', age: 69, roomNumber: '612', contactName: '陳冠宇', contactPhone: '0955-666-777', medications: [], medicalHistory: ['無特殊病史'], notes: '' },
  { id: 'p007', name: '黃福氣', gender: '男', birthDate: '1956/04/18', age: 70, roomNumber: '609', contactName: '黃招財', contactPhone: '0911-888-999', medications: ['Glibenclamide'], medicalHistory: ['糖尿病'], notes: '每天散步30分鐘' },
];

// 種子量測時間（相對今天，避免硬編死日期讓 demo 看起來過期）
function dateOffset(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
function dateTimeOffset(days: number, hhmm: string): string {
  return `${dateOffset(days)} ${hhmm}`;
}

/** 每日健康種子（patientId → 量測值）。 */
export const seedDailyHealth: Record<string, DailyVitals> = {
  p001: { bloodPressureSys: '135', bloodPressureDia: '85', bloodOxygen: '98', measureTime: dateTimeOffset(0, '08:30') },
  p002: { bloodPressureSys: '128', bloodPressureDia: '82', bloodOxygen: '97', measureTime: dateTimeOffset(0, '09:10') },
  p003: { bloodPressureSys: '142', bloodPressureDia: '88', bloodOxygen: '96', measureTime: dateTimeOffset(1, '08:50') },
  p004: { bloodPressureSys: '138', bloodPressureDia: '86', bloodOxygen: '95', measureTime: dateTimeOffset(0, '07:45') },
  p005: { bloodPressureSys: '145', bloodPressureDia: '90', bloodOxygen: '94', measureTime: dateTimeOffset(0, '09:00') },
  p006: { bloodPressureSys: '118', bloodPressureDia: '76', bloodOxygen: '99', measureTime: dateTimeOffset(2, '08:20') },
  p007: { bloodPressureSys: '130', bloodPressureDia: '80', bloodOxygen: '97', measureTime: dateTimeOffset(1, '08:35') },
};

/** 日常檢查種子（patientId → 量測值）。 */
export const seedCheckups: Record<string, CheckupVitals> = {
  p001: { weight: '68', bloodSugar: '105', urineStatus: 'normal', stoolStatus: 'normal', measureDate: dateOffset(0) },
  p002: { weight: '55', bloodSugar: '92', urineStatus: 'normal', stoolStatus: 'normal', measureDate: dateOffset(0) },
  p003: { weight: '60', bloodSugar: '98', urineStatus: 'normal', stoolStatus: 'warning', measureDate: dateOffset(1) },
  p004: { weight: '70', bloodSugar: '110', urineStatus: 'normal', stoolStatus: 'abnormal', measureDate: dateOffset(0) },
  p005: { weight: '52', bloodSugar: '95', urineStatus: 'warning', stoolStatus: 'normal', measureDate: dateOffset(0) },
  p006: { weight: '58', bloodSugar: '88', urineStatus: 'normal', stoolStatus: 'normal', measureDate: dateOffset(3) },
  p007: { weight: '75', bloodSugar: '120', urineStatus: 'abnormal', stoolStatus: 'warning', measureDate: dateOffset(2) },
};

function alertAt(daysAgo: number, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(Date.now() - daysAgo * 86400000);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/**
 * 警報種子 — 寫入 alertsService 的單一警報 store (csi_alerts_v2)。
 * resident_id 為指向住民的外鍵；混合狀態以便 demo 顯示誤報率與統計。
 */
export const seedAlerts: FallEventRow[] = [
  { id: 'seed-a1', device_id: null, resident_id: 'p001', movement_score: 88, location_x: 1.2, location_y: 2.4, event_type: '跌倒風險', confidence: 92, status: 'pending', feedback_note: null, acknowledged_by: null, detected_at: alertAt(0, '11:42') },
  { id: 'seed-a2', device_id: null, resident_id: 'p002', movement_score: 71, location_x: 0.8, location_y: 1.1, event_type: '異常震盪', confidence: 85, status: 'confirmed', feedback_note: null, acknowledged_by: null, detected_at: alertAt(1, '20:15') },
  { id: 'seed-a3', device_id: null, resident_id: 'p003', movement_score: 64, location_x: 2.1, location_y: 0.6, event_type: '跌倒風險', confidence: 78, status: 'false_alarm', feedback_note: '住民自行起身，非跌倒', acknowledged_by: null, detected_at: alertAt(1, '14:30') },
  { id: 'seed-a4', device_id: null, resident_id: 'p004', movement_score: 90, location_x: 1.5, location_y: 1.9, event_type: '異常震盪', confidence: 88, status: 'confirmed', feedback_note: null, acknowledged_by: null, detected_at: alertAt(2, '09:00') },
  { id: 'seed-a5', device_id: null, resident_id: 'p007', movement_score: 58, location_x: 0.4, location_y: 2.8, event_type: '跌倒風險', confidence: 71, status: 'false_alarm', feedback_note: null, acknowledged_by: null, detected_at: alertAt(3, '16:45') },
  { id: 'seed-a6', device_id: null, resident_id: 'p005', movement_score: 95, location_x: 1.0, location_y: 1.0, event_type: '長時間無活動', confidence: 95, status: 'pending', feedback_note: null, acknowledged_by: null, detected_at: alertAt(0, '03:12') },
];
