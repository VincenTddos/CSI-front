import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, Phone, X, Plus, ArrowLeft, Pencil, Save } from 'lucide-react';
import { Page, Patient } from '../types';
import { mockPatients } from '../lib/mockData';

const STORAGE_KEY = 'csi_patients';

function loadPatients(): Patient[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { /* ignore */ }
  }
  return mockPatients;
}

function savePatients(patients: Patient[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

import { useNavigate } from 'react-router-dom';

export function CareRecipients() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [patients, setPatients] = useState<Patient[]>(loadPatients);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Detail View State
  const [editData, setEditData] = useState<Patient | null>(null);
  const [newMedication, setNewMedication] = useState('');
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  // Persist patients whenever they change
  useEffect(() => {
    savePatients(patients);
  }, [patients]);

  const handleSelectPatient = (patient: Patient) => {
    // always get latest from state
    const latest = patients.find(p => p.id === patient.id) || patient;
    setSelectedPatient(latest);
    setEditData({ ...latest });
    setIsEditing(false);
  };

  const handleSave = () => {
    if (editData) {
      const updated = patients.map(p => p.id === editData.id ? editData : p);
      setPatients(updated);
      setSelectedPatient(editData);
      setIsEditing(false);
      setShowSavedMsg(true);
      setTimeout(() => setShowSavedMsg(false), 2500);
    }
  };

  const cancelEdit = () => {
    setEditData(selectedPatient ? { ...selectedPatient } : null);
    setIsEditing(false);
    setNewMedication('');
  };

  const addMedication = () => {
    if (newMedication.trim() && editData) {
      setEditData({
        ...editData,
        medications: [...editData.medications, newMedication.trim()]
      });
      setNewMedication('');
    }
  };

  const removeMedication = (index: number) => {
    if (editData) {
      const newMeds = [...editData.medications];
      newMeds.splice(index, 1);
      setEditData({ ...editData, medications: newMeds });
    }
  };

  const filteredPatients = patients.filter(p =>
    p.name.includes(searchTerm) || p.roomNumber.includes(searchTerm)
  );

  // ========== 詳細頁面 ==========
  if (selectedPatient && editData) {
    return (
      <div className="p-6 h-full flex flex-col bg-[#F8FAFC]">
        {/* 頂部操作列 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedPatient(null); setIsEditing(false); }}
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              title="返回列表"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{selectedPatient.name} 的個人資料</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {isEditing ? '正在編輯 — 修改完成後請按「儲存」' : '點擊「編輯」可修改資料或新增用藥'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0066CC] transition-colors text-sm font-medium"
              >
                <Pencil className="w-4 h-4" /> 編輯資料
              </button>
            ) : (
              <>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0066CC] transition-colors text-sm font-medium"
                >
                  <Save className="w-4 h-4" /> 儲存
                </button>
              </>
            )}
          </div>
        </div>

        {/* 儲存成功提示 */}
        {showSavedMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm max-w-xs">
            ✓ 資料已儲存
          </div>
        )}

        {/* 主要內容區 */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* 基本資料 */}
            <section>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">基本資料</h2>
              <div className="grid grid-cols-2 gap-x-12 gap-y-5">
                {/* 姓名 */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">姓名</label>
                  {isEditing ? (
                    <input type="text" value={editData.name}
                      onChange={e => setEditData({...editData, name: e.target.value})}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50"
                    />
                  ) : (
                    <p className="text-slate-800 font-medium">{editData.name}</p>
                  )}
                </div>
                {/* 性別 */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">性別</label>
                  {isEditing ? (
                    <select value={editData.gender}
                      onChange={e => setEditData({...editData, gender: e.target.value as '男'|'女'})}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50"
                    >
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  ) : (
                    <p className="text-slate-800">{editData.gender}</p>
                  )}
                </div>
                {/* 生日 */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">生日</label>
                  {isEditing ? (
                    <input type="text" value={editData.birthDate}
                      onChange={e => setEditData({...editData, birthDate: e.target.value})}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50"
                      placeholder="YYYY/MM/DD"
                    />
                  ) : (
                    <p className="text-slate-800">{editData.birthDate} ({editData.age}歲)</p>
                  )}
                </div>
                {/* 房間 */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">房間</label>
                  {isEditing ? (
                    <input type="text" value={editData.roomNumber}
                      onChange={e => setEditData({...editData, roomNumber: e.target.value})}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50"
                    />
                  ) : (
                    <p className="text-slate-800">{editData.roomNumber}</p>
                  )}
                </div>
                {/* 聯絡人 */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">聯絡人</label>
                  {isEditing ? (
                    <input type="text" value={editData.contactName}
                      onChange={e => setEditData({...editData, contactName: e.target.value})}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50"
                    />
                  ) : (
                    <p className="text-slate-800">{editData.contactName}</p>
                  )}
                </div>
                {/* 電話 */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">電話</label>
                  {isEditing ? (
                    <input type="text" value={editData.contactPhone}
                      onChange={e => setEditData({...editData, contactPhone: e.target.value})}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50"
                    />
                  ) : (
                    <p className="text-slate-800 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {editData.contactPhone}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 日常用藥 */}
            <section>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">日常用藥</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {editData.medications.length > 0 ? editData.medications.map((med, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-blue-50 text-[#007AFF] px-3 py-1.5 rounded-full text-sm font-medium border border-blue-100">
                    {med}
                    {isEditing && (
                      <button onClick={() => removeMedication(idx)} className="hover:text-red-500 transition-colors ml-1" title="移除此藥">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )) : (
                  <span className="text-slate-400 text-sm">尚無用藥紀錄</span>
                )}
              </div>

              {/* 新增用藥區塊 */}
              {isEditing && (
                <div className="mt-2">
                  <p className="text-xs text-slate-500 mb-2">輸入藥物名稱後按「新增」或 Enter 鍵加入</p>
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 max-w-md">
                    <input
                      type="text"
                      value={newMedication}
                      onChange={e => setNewMedication(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addMedication()}
                      placeholder="例如：Aspirin、Metformin..."
                      className="bg-transparent border-none focus:outline-none focus:ring-0 flex-1 px-2 text-sm"
                    />
                    <button
                      onClick={addMedication}
                      disabled={!newMedication.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#007AFF] text-white rounded-md hover:bg-[#0066CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" /> 新增
                    </button>
                  </div>
                </div>
              )}
            </section>

            <hr className="border-slate-100" />

            {/* 病史 */}
            <section>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">病史</h2>
              {isEditing ? (
                <div>
                  <p className="text-xs text-slate-500 mb-2">多筆病史請以逗號分隔，例如：高血壓, 糖尿病</p>
                  <textarea
                    value={editData.medicalHistory.join(', ')}
                    onChange={e => setEditData({...editData, medicalHistory: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 min-h-[80px]"
                    placeholder="輸入病史..."
                  />
                </div>
              ) : (
                <p className="text-slate-800">
                  {editData.medicalHistory.length > 0 ? editData.medicalHistory.join('、') : '無特殊病史'}
                </p>
              )}
            </section>

            {/* 快捷導覽 */}
            {!isEditing && (
              <>
                <hr className="border-slate-100" />
                <section>
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">快速前往</h2>
                  <div className="flex gap-4">
                    <button
                      onClick={() => navigate('/daily-health')}
                      className="px-5 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-left"
                    >
                      <span className="text-[#007AFF] font-bold block">每日健康</span>
                      <span className="text-slate-500 text-xs">血壓、血氧紀錄</span>
                    </button>
                    <button
                      onClick={() => navigate('/routine-checkup')}
                      className="px-5 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-left"
                    >
                      <span className="text-[#007AFF] font-bold block">日常檢查</span>
                      <span className="text-slate-500 text-xs">體重、血糖、排泄狀態</span>
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========== 列表頁面 ==========
  return (
    <div className="p-6 h-full flex flex-col bg-[#F8FAFC]">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">受護者管理</h1>
        <p className="text-sm text-slate-500 mt-1">點擊任一位受護者可查看或編輯其個人資料與用藥紀錄</p>
      </div>

      {/* 搜尋列 */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋姓名或房號..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] bg-white"
          />
        </div>
      </div>

      {/* 表格 */}
      <div className="flex-1 bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="font-medium p-4 py-3">姓名</th>
                <th className="font-medium p-4 py-3">性別</th>
                <th className="font-medium p-4 py-3">年齡</th>
                <th className="font-medium p-4 py-3">房間</th>
                <th className="font-medium p-4 py-3">備註</th>
                <th className="font-medium p-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                  onClick={() => handleSelectPatient(patient)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#007AFF] text-sm font-bold">
                        {patient.name.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-800 text-sm">{patient.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 text-sm">{patient.gender}</td>
                  <td className="p-4 text-slate-600 text-sm">{patient.age}</td>
                  <td className="p-4 text-slate-600 text-sm font-medium">{patient.roomNumber}</td>
                  <td className="p-4 text-slate-500 text-sm truncate max-w-[200px]">
                    {patient.notes || '-'}
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-xs text-slate-400 group-hover:text-[#007AFF] transition-colors flex items-center justify-end gap-1">
                      查看 <ChevronRight className="w-4 h-4" />
                    </span>
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                    找不到符合的受護者
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
