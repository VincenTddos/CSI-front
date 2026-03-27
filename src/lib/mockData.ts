import { Patient, DailyHealthRecord, RoutineCheckupRecord } from '../types';

export const mockPatients: Patient[] = [
  {
    id: 'p001',
    name: '王小明',
    gender: '男',
    birthDate: '1952/03/15',
    age: 74,
    roomNumber: '606',
    contactName: '王大壯',
    contactPhone: '0912-345-678',
    medications: ['Aspirin', 'Metformin'],
    medicalHistory: ['高血壓', '糖尿病'],
    notes: '注意飲食控制'
  },
  {
    id: 'p002',
    name: '林美麗',
    gender: '女',
    birthDate: '1949/08/22',
    age: 77,
    roomNumber: '503',
    contactName: '林金雄',
    contactPhone: '0987-654-321',
    medications: ['Losartan', 'Amlodipine'],
    medicalHistory: ['高血壓'],
    notes: '有關節炎，行動不便'
  },
  {
    id: 'p003',
    name: '邱月雲',
    gender: '女',
    birthDate: '1956/12/05',
    age: 70,
    roomNumber: '611',
    contactName: '張建志',
    contactPhone: '0922-111-222',
    medications: ['Atorvastatin'],
    medicalHistory: ['高血脂'],
    notes: '睡眠質量差'
  },
  {
    id: 'p004',
    name: '洪建國',
    gender: '男',
    birthDate: '1946/05/10',
    age: 80,
    roomNumber: '502',
    contactName: '洪志明',
    contactPhone: '0933-444-555',
    medications: ['Digoxin', 'Furosemide'],
    medicalHistory: ['心臟病', '慢性腎衰竭'],
    notes: '需定時量血壓'
  },
  {
    id: 'p005',
    name: '李XX',
    gender: '女',
    birthDate: '1946/01/01',
    age: 80,
    roomNumber: '510',
    contactName: '陳00',
    contactPhone: '09XX-XXX-XXX',
    medications: ['Acertil', 'Digoxin'],
    medicalHistory: ['心臟病', '高血壓'],
    notes: ''
  },
  {
    id: 'p006',
    name: '陳雅婷',
    gender: '女',
    birthDate: '1957/11/20',
    age: 69,
    roomNumber: '612',
    contactName: '陳冠宇',
    contactPhone: '0955-666-777',
    medications: [],
    medicalHistory: ['無特殊病史'],
    notes: ''
  },
  {
    id: 'p007',
    name: '黃福氣',
    gender: '男',
    birthDate: '1956/04/18',
    age: 70,
    roomNumber: '609',
    contactName: '黃招財',
    contactPhone: '0911-888-999',
    medications: ['Glibenclamide'],
    medicalHistory: ['糖尿病'],
    notes: '每天散步30分鐘'
  }
];

export const mockDailyHealth: DailyHealthRecord[] = [
  {
    patientId: 'p001',
    patientName: '王小明',
    date: '2026/03/27',
    time: '08:30',
    bloodPressureSys: 135,
    bloodPressureDia: 85,
    bloodOxygen: 98
  },
  {
    patientId: 'p005',
    patientName: '李XX',
    date: '2026/03/27',
    time: '09:00',
    bloodPressureSys: 140,
    bloodPressureDia: 90,
    bloodOxygen: 95
  }
];

export const mockRoutineCheckup: RoutineCheckupRecord[] = [
  {
    patientId: 'p001',
    patientName: '王小明',
    date: '2026/03/27',
    weight: 68,
    bloodSugar: 105,
    urineStatus: 'normal',
    stoolStatus: 'normal'
  },
  {
    patientId: 'p002',
    patientName: '林美麗',
    date: '2026/03/27',
    weight: 55,
    bloodSugar: 92,
    urineStatus: 'normal',
    stoolStatus: 'normal'
  },
  {
    patientId: 'p003',
    patientName: '邱月雲',
    date: '2026/03/26',
    weight: 60,
    bloodSugar: 98,
    urineStatus: 'normal',
    stoolStatus: 'warning'
  },
  {
    patientId: 'p004',
    patientName: '洪建國',
    date: '2026/03/27',
    weight: 70,
    bloodSugar: 110,
    urineStatus: 'normal',
    stoolStatus: 'abnormal'
  },
  {
    patientId: 'p005',
    patientName: '李XX',
    date: '2026/03/27',
    weight: 52,
    bloodSugar: 95,
    urineStatus: 'warning',
    stoolStatus: 'normal'
  },
  {
    patientId: 'p006',
    patientName: '陳雅婷',
    date: '2026/03/25',
    weight: 58,
    bloodSugar: 88,
    urineStatus: 'abnormal',
    stoolStatus: 'normal'
  },
  {
    patientId: 'p007',
    patientName: '黃福氣',
    date: '2026/03/26',
    weight: 75,
    bloodSugar: 120,
    urineStatus: 'abnormal',
    stoolStatus: 'warning'
  }
];
