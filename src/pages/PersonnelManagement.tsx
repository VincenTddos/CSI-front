import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Search, Filter, Edit2, Trash2,
  Shield, UserCheck, HeartPulse, Mail, Phone, MapPin,
  X, Check, AlertCircle, Contact, Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserRole, Patient } from '../types';
import { mockPatients } from '../lib/mockData';

const PATIENTS_STORAGE_KEY = 'csi_patients';
const PERSONNEL_STORAGE_KEY = 'csi_personnel';

// ===== Patient helpers =====
function loadPatients(): Patient[] {
  const saved = localStorage.getItem(PATIENTS_STORAGE_KEY);
  if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
  return mockPatients;
}

function savePatientsList(patients: Patient[]) {
  localStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(patients));
}

// ===== Personnel types =====
interface Personnel {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  lastActive: string;
  assignedTo?: string;
}

const defaultPersonnel: Personnel[] = [
  { id: '1', name: '陳大文', role: 'admin', email: 'admin@espectre.com', phone: '0912-345-678', status: 'active', lastActive: '10 分鐘前' },
  { id: '2', name: '林小美', role: 'medical', email: 'nurse.lin@hospital.com', phone: '0922-111-222', status: 'active', lastActive: '2 小時前', assignedTo: 'Room 204, 205' },
  { id: '3', name: '王志明', role: 'medical', email: 'dr.wang@hospital.com', phone: '0933-444-555', status: 'inactive', lastActive: '3 天前', assignedTo: 'Room 206' },
  { id: '4', name: '張淑芬', role: 'family', email: 'shufen@gmail.com', phone: '0955-666-777', status: 'active', lastActive: '1 小時前', assignedTo: '李老先生 (Room 204)' },
  { id: '5', name: '李建國', role: 'family', email: 'jianguo@gmail.com', phone: '0988-999-000', status: 'active', lastActive: '5 分鐘前', assignedTo: '李老先生 (Room 204)' }
];

function loadPersonnel(): Personnel[] {
  const saved = localStorage.getItem(PERSONNEL_STORAGE_KEY);
  if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
  return defaultPersonnel;
}

function savePersonnelList(list: Personnel[]) {
  localStorage.setItem(PERSONNEL_STORAGE_KEY, JSON.stringify(list));
}

function emptyPersonnel(): Personnel {
  return { id: 'u' + Date.now().toString(36), name: '', role: 'medical', email: '', phone: '', status: 'active', lastActive: '剛剛', assignedTo: '' };
}

type TabType = 'personnel' | 'patients';

// ===== Empty patient template =====
function emptyPatient(): Patient {
  return {
    id: 'p' + Date.now().toString(36),
    name: '', gender: '男', birthDate: '', age: 0,
    roomNumber: '', contactName: '', contactPhone: '',
    medications: [], medicalHistory: [], notes: ''
  };
}

export function PersonnelManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('personnel');

  // — Personnel state —
  const [personnelList, setPersonnelList] = useState<Personnel[]>(loadPersonnel);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  const [isNewPersonnel, setIsNewPersonnel] = useState(false);

  // — Patients state —
  const [patients, setPatients] = useState<Patient[]>(loadPatients);
  const [patientSearch, setPatientSearch] = useState('');
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newMed, setNewMed] = useState('');
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  // Sync to localStorage
  useEffect(() => { savePatientsList(patients); }, [patients]);
  useEffect(() => { savePersonnelList(personnelList); }, [personnelList]);

  // ===== Personnel logic =====
  const filteredPersonnel = personnelList.filter(p => {
    const matchesSearch = p.name.includes(searchTerm) || p.email.includes(searchTerm);
    const matchesRole = filterRole === 'all' || p.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const openAddPersonnel = () => {
    setEditingPersonnel(emptyPersonnel());
    setIsNewPersonnel(true);
    setIsPersonnelModalOpen(true);
  };

  const openEditPersonnel = (person: Personnel) => {
    setEditingPersonnel({ ...person });
    setIsNewPersonnel(false);
    setIsPersonnelModalOpen(true);
  };

  const deletePersonnel = (id: string) => {
    setPersonnelList(prev => prev.filter(p => p.id !== id));
  };

  const handleSavePersonnel = () => {
    if (!editingPersonnel || !editingPersonnel.name.trim()) return;
    if (isNewPersonnel) {
      setPersonnelList(prev => [...prev, editingPersonnel]);
    } else {
      setPersonnelList(prev => prev.map(p => p.id === editingPersonnel.id ? editingPersonnel : p));
    }
    setIsPersonnelModalOpen(false);
    setEditingPersonnel(null);
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2500);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin': return <span className="px-2 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center gap-1"><Shield className="w-3 h-3" /> 管理者</span>;
      case 'medical': return <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center gap-1"><HeartPulse className="w-3 h-3" /> 醫護人員</span>;
      case 'family': return <span className="px-2 py-1 rounded-full bg-green-100 text-green-600 text-[10px] font-bold flex items-center gap-1"><UserCheck className="w-3 h-3" /> 家屬</span>;
    }
  };

  // ===== Patient logic =====
  const filteredPatients = patients.filter(p =>
    p.name.includes(patientSearch) || p.roomNumber.includes(patientSearch)
  );

  const openAddPatient = () => {
    setEditingPatient(emptyPatient());
    setIsNewPatient(true);
    setIsPatientModalOpen(true);
    setNewMed('');
  };

  const openEditPatient = (patient: Patient) => {
    setEditingPatient({ ...patient });
    setIsNewPatient(false);
    setIsPatientModalOpen(true);
    setNewMed('');
  };

  const deletePatient = (id: string) => {
    setPatients(prev => prev.filter(p => p.id !== id));
  };

  const handleSavePatient = () => {
    if (!editingPatient || !editingPatient.name.trim()) return;
    if (isNewPatient) {
      setPatients(prev => [...prev, editingPatient]);
    } else {
      setPatients(prev => prev.map(p => p.id === editingPatient.id ? editingPatient : p));
    }
    setIsPatientModalOpen(false);
    setEditingPatient(null);
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2500);
  };

  const addMedToEditing = () => {
    if (newMed.trim() && editingPatient) {
      setEditingPatient({ ...editingPatient, medications: [...editingPatient.medications, newMed.trim()] });
      setNewMed('');
    }
  };

  const removeMedFromEditing = (idx: number) => {
    if (editingPatient) {
      const meds = [...editingPatient.medications];
      meds.splice(idx, 1);
      setEditingPatient({ ...editingPatient, medications: meds });
    }
  };

  return (
    <div className="h-full flex flex-col space-y-5">
      {/* 頂部標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">人員管理</h1>
          <p className="text-sm text-slate-500 mt-1">管理系統使用者與受護者資料（所有頁面資料同步）</p>
        </div>
      </div>

      {/* Tab 切換 */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('personnel')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === 'personnel' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Users className="w-4 h-4" /> 系統人員
        </button>
        <button
          onClick={() => setActiveTab('patients')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === 'patients' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Contact className="w-4 h-4" /> 受護者
        </button>
      </div>

      {/* 儲存成功提示 */}
      {showSavedMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm max-w-xs">
          ✓ 資料已儲存，所有頁面同步更新
        </div>
      )}

      {/* ========== 系統人員 Tab ========== */}
      {activeTab === 'personnel' && (
        <>
          {/* 統計 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Shield className="w-5 h-5 text-blue-500" /></div>
              <div><p className="text-xs text-slate-500">管理者</p><p className="text-lg font-bold text-slate-800">{personnelList.filter(p => p.role === 'admin').length}</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><HeartPulse className="w-5 h-5 text-emerald-500" /></div>
              <div><p className="text-xs text-slate-500">醫護人員</p><p className="text-lg font-bold text-slate-800">{personnelList.filter(p => p.role === 'medical').length}</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><UserCheck className="w-5 h-5 text-amber-500" /></div>
              <div><p className="text-xs text-slate-500">家屬成員</p><p className="text-lg font-bold text-slate-800">{personnelList.filter(p => p.role === 'family').length}</p></div>
            </div>
          </div>

          {/* 搜尋 & 篩選 & 新增按鈕 */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-100">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="搜尋姓名或電子郵件..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm" />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select value={filterRole} onChange={e => setFilterRole(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 outline-none">
                  <option value="all">所有角色</option>
                  <option value="admin">管理者</option>
                  <option value="medical">醫護人員</option>
                  <option value="family">家屬</option>
                </select>
              </div>
              <button onClick={openAddPersonnel}
                className="flex items-center gap-2 bg-[#007AFF] hover:bg-[#0066CC] text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                <UserPlus className="w-4 h-4" /> 新增人員
              </button>
            </div>
          </div>

          {/* 人員表格 */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">使用者</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">角色</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">聯絡資訊</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">負責對象</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">狀態</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPersonnel.map(person => (
                    <tr key={person.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold">
                            {person.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{person.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getRoleBadge(person.role)}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-xs text-slate-600"><Mail className="w-3 h-3 text-slate-400" /> {person.email}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-600"><Phone className="w-3 h-3 text-slate-400" /> {person.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">{person.assignedTo || '---'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full", person.status === 'active' ? "bg-emerald-500" : "bg-slate-300")} />
                          <span className={cn("text-[10px] font-bold", person.status === 'active' ? "text-emerald-600" : "text-slate-400")}>
                            {person.status === 'active' ? '在線' : '離線'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditPersonnel(person)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="編輯">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deletePersonnel(person.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="刪除">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPersonnel.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm">找不到符合的人員</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========== 受護者 Tab ========== */}
      {activeTab === 'patients' && (
        <>
          {/* 搜尋 + 新增按鈕 */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="搜尋姓名或房號..." value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm" />
            </div>
            <button
              onClick={openAddPatient}
              className="flex items-center gap-2 bg-[#007AFF] hover:bg-[#0066CC] text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> 新增受護者
            </button>
          </div>

          {/* 說明 */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
            💡 在這裡新增的受護者會自動同步到「受護者」清單、「每日健康」、「日常檢查」等頁面。
          </div>

          {/* 受護者表格 */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">姓名</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">性別</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">年齡</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">房間</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">用藥</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">聯絡人</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.map(patient => (
                    <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[#007AFF] text-xs font-bold">
                            {patient.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-slate-800">{patient.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{patient.gender}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{patient.age}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">{patient.roomNumber}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {patient.medications.length > 0 ? patient.medications.slice(0, 2).map((m, i) => (
                            <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{m}</span>
                          )) : <span className="text-xs text-slate-400">-</span>}
                          {patient.medications.length > 2 && <span className="text-[10px] text-slate-400">+{patient.medications.length - 2}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">{patient.contactName || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditPatient(patient)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="編輯">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deletePatient(patient.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="刪除">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPatients.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-sm">尚無受護者，請點擊「新增受護者」</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========== 新增/編輯受護者 Modal ========== */}
      {isPatientModalOpen && editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">{isNewPatient ? '新增受護者' : '編輯受護者資料'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isNewPatient ? '填寫基本資料後會自動同步到所有頁面' : `正在編輯 ${editingPatient.name} 的資料`}
                </p>
              </div>
              <button onClick={() => setIsPatientModalOpen(false)} className="p-1.5 rounded-full hover:bg-slate-200 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">姓名 *</label>
                  <input type="text" value={editingPatient.name}
                    onChange={e => setEditingPatient({...editingPatient, name: e.target.value})}
                    placeholder="請輸入姓名"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">性別</label>
                  <select value={editingPatient.gender}
                    onChange={e => setEditingPatient({...editingPatient, gender: e.target.value as '男'|'女'})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none">
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">生日</label>
                  <input type="text" value={editingPatient.birthDate}
                    onChange={e => setEditingPatient({...editingPatient, birthDate: e.target.value})}
                    placeholder="YYYY/MM/DD"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">年齡</label>
                  <input type="number" value={editingPatient.age || ''}
                    onChange={e => setEditingPatient({...editingPatient, age: parseInt(e.target.value) || 0})}
                    placeholder="例如：75"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">房間號碼</label>
                  <input type="text" value={editingPatient.roomNumber}
                    onChange={e => setEditingPatient({...editingPatient, roomNumber: e.target.value})}
                    placeholder="例如：606"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">聯絡人</label>
                  <input type="text" value={editingPatient.contactName}
                    onChange={e => setEditingPatient({...editingPatient, contactName: e.target.value})}
                    placeholder="家屬姓名"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">聯絡電話</label>
                  <input type="text" value={editingPatient.contactPhone}
                    onChange={e => setEditingPatient({...editingPatient, contactPhone: e.target.value})}
                    placeholder="09XX-XXX-XXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
                </div>
              </div>

              {/* 用藥 */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-medium text-slate-500 mb-2">日常用藥</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editingPatient.medications.map((med, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-full text-xs font-medium border border-blue-100">
                      {med}
                      <button onClick={() => removeMedFromEditing(idx)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" value={newMed}
                    onChange={e => setNewMed(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMedToEditing()}
                    placeholder="輸入藥物名稱，按 Enter 或「新增」"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
                  <button onClick={addMedToEditing} disabled={!newMed.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#007AFF] text-white rounded-lg text-xs font-medium hover:bg-[#0066CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <Plus className="w-3 h-3" /> 新增
                  </button>
                </div>
              </div>

              {/* 病史 */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-medium text-slate-500 mb-1">病史（逗號分隔）</label>
                <textarea value={editingPatient.medicalHistory.join(', ')}
                  onChange={e => setEditingPatient({...editingPatient, medicalHistory: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  placeholder="例如：高血壓, 糖尿病"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none min-h-[60px]" />
              </div>

              {/* 備註 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">備註</label>
                <input type="text" value={editingPatient.notes}
                  onChange={e => setEditingPatient({...editingPatient, notes: e.target.value})}
                  placeholder="其他注意事項"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsPatientModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50">
                取消
              </button>
              <button onClick={handleSavePatient} disabled={!editingPatient.name.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066CC] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> {isNewPatient ? '確認新增' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========== 新增/編輯系統人員 Modal ========== */}
      {isPersonnelModalOpen && editingPersonnel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">{isNewPersonnel ? '新增系統人員' : '編輯人員資料'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">填寫基本資訊與角色設定</p>
              </div>
              <button onClick={() => setIsPersonnelModalOpen(false)} className="p-1.5 rounded-full hover:bg-slate-200 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">姓名 *</label>
                  <input type="text" value={editingPersonnel.name}
                    onChange={e => setEditingPersonnel({...editingPersonnel, name: e.target.value})}
                    placeholder="請輸入姓名"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">角色</label>
                  <select value={editingPersonnel.role}
                    onChange={e => setEditingPersonnel({...editingPersonnel, role: e.target.value as UserRole})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none">
                    <option value="admin">管理者</option>
                    <option value="medical">醫護人員</option>
                    <option value="family">家屬</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">電子郵件</label>
                <input type="email" value={editingPersonnel.email}
                  onChange={e => setEditingPersonnel({...editingPersonnel, email: e.target.value})}
                  placeholder="example@email.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">聯絡電話</label>
                <input type="text" value={editingPersonnel.phone}
                  onChange={e => setEditingPersonnel({...editingPersonnel, phone: e.target.value})}
                  placeholder="09XX-XXX-XXX"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">狀態</label>
                <select value={editingPersonnel.status}
                  onChange={e => setEditingPersonnel({...editingPersonnel, status: e.target.value as 'active'|'inactive'})}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none">
                  <option value="active">在線</option>
                  <option value="inactive">離線</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">負責對象 / 區域</label>
                <input type="text" value={editingPersonnel.assignedTo || ''}
                  onChange={e => setEditingPersonnel({...editingPersonnel, assignedTo: e.target.value})}
                  placeholder="例如：Room 204 或 李老先生"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none" />
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsPersonnelModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50">
                取消
              </button>
              <button onClick={handleSavePersonnel} disabled={!editingPersonnel.name.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066CC] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> {isNewPersonnel ? '確認新增' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
