import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Shield, 
  UserCheck, 
  HeartPulse,
  Mail,
  Phone,
  MapPin,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserRole } from '../types';

interface Personnel {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  lastActive: string;
  avatar: string;
  assignedTo?: string; // For family (patient name) or medical (rooms)
}

const mockPersonnel: Personnel[] = [
  {
    id: '1',
    name: '陳大文',
    role: 'admin',
    email: 'admin@espectre.com',
    phone: '0912-345-678',
    status: 'active',
    lastActive: '10 分鐘前',
    avatar: 'https://picsum.photos/seed/admin/100/100'
  },
  {
    id: '2',
    name: '林小美',
    role: 'medical',
    email: 'nurse.lin@hospital.com',
    phone: '0922-111-222',
    status: 'active',
    lastActive: '2 小時前',
    avatar: 'https://picsum.photos/seed/nurse1/100/100',
    assignedTo: 'Room 204, 205'
  },
  {
    id: '3',
    name: '王志明',
    role: 'medical',
    email: 'dr.wang@hospital.com',
    phone: '0933-444-555',
    status: 'inactive',
    lastActive: '3 天前',
    avatar: 'https://picsum.photos/seed/doctor1/100/100',
    assignedTo: 'Room 206'
  },
  {
    id: '4',
    name: '張淑芬',
    role: 'family',
    email: 'shufen@gmail.com',
    phone: '0955-666-777',
    status: 'active',
    lastActive: '1 小時前',
    avatar: 'https://picsum.photos/seed/family1/100/100',
    assignedTo: '李老先生 (Room 204)'
  },
  {
    id: '5',
    name: '李建國',
    role: 'family',
    email: 'jianguo@gmail.com',
    phone: '0988-999-000',
    status: 'active',
    lastActive: '5 分鐘前',
    avatar: 'https://picsum.photos/seed/family2/100/100',
    assignedTo: '李老先生 (Room 204)'
  }
];

export function PersonnelManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Personnel | null>(null);

  const filteredPersonnel = mockPersonnel.filter(p => {
    const matchesSearch = p.name.includes(searchTerm) || p.email.includes(searchTerm);
    const matchesRole = filterRole === 'all' || p.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center gap-1"><Shield className="w-3 h-3" /> 管理者</span>;
      case 'medical':
        return <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center gap-1"><HeartPulse className="w-3 h-3" /> 醫護人員</span>;
      case 'family':
        return <span className="px-2 py-1 rounded-full bg-green-100 text-green-600 text-[10px] font-bold flex items-center gap-1"><UserCheck className="w-3 h-3" /> 家屬</span>;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">人員管理</h1>
          <p className="text-slate-500 text-sm mt-1">管理系統使用者權限與家屬綁定</p>
        </div>
        <button 
          onClick={() => {
            setSelectedUser(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-[#007AFF] hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span className="text-sm font-bold">新增人員</span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <Shield className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">管理者</p>
            <p className="text-xl font-bold text-slate-800">1</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
            <HeartPulse className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">醫護人員</p>
            <p className="text-xl font-bold text-slate-800">2</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">家屬成員</p>
            <p className="text-xl font-bold text-slate-800">2</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="搜尋姓名或電子郵件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none"
          >
            <option value="all">所有角色</option>
            <option value="admin">管理者</option>
            <option value="medical">醫護人員</option>
            <option value="family">家屬</option>
          </select>
        </div>
      </div>

      {/* Personnel Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">使用者</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">角色</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">聯絡資訊</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">負責對象 / 區域</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">狀態</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPersonnel.map((person) => (
                <tr key={person.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={person.avatar} 
                        alt={person.name} 
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{person.name}</p>
                        <p className="text-[10px] text-slate-400">ID: {person.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getRoleBadge(person.role)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {person.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {person.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-600 font-medium">
                      {person.assignedTo || '---'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          person.status === 'active' ? "bg-emerald-500" : "bg-slate-300"
                        )} />
                        <span className={cn(
                          "text-[10px] font-bold uppercase",
                          person.status === 'active' ? "text-emerald-600" : "text-slate-400"
                        )}>
                          {person.status === 'active' ? '在線' : '離線'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">最後活動: {person.lastActive}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setSelectedUser(person);
                          setIsModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                        title="編輯"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredPersonnel.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-800 font-bold">找不到相關人員</h3>
            <p className="text-slate-500 text-sm mt-1">請嘗試更換關鍵字或篩選條件</p>
          </div>
        )}
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2C363F] flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-[#007AFF]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedUser ? '編輯人員資料' : '新增人員'}</h3>
                  <p className="text-xs text-slate-500">填寫基本資訊與權限設定</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">姓名</label>
                  <input 
                    type="text" 
                    defaultValue={selectedUser?.name}
                    placeholder="請輸入姓名"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">角色權限</label>
                  <select 
                    defaultValue={selectedUser?.role || 'medical'}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                  >
                    <option value="admin">管理者</option>
                    <option value="medical">醫護人員</option>
                    <option value="family">家屬</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">電子郵件</label>
                  <input 
                    type="email" 
                    defaultValue={selectedUser?.email}
                    placeholder="example@email.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">聯絡電話</label>
                  <input 
                    type="tel" 
                    defaultValue={selectedUser?.phone}
                    placeholder="09xx-xxx-xxx"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                  />
                </div>
              </div>

              {/* Assignment Section */}
              <div className="pt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  負責對象 / 區域設定
                </h4>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    根據角色不同，您可以設定此人員負責的病房區域（醫護）或綁定的長者對象（家屬）。
                  </p>
                  <input 
                    type="text" 
                    defaultValue={selectedUser?.assignedTo}
                    placeholder="例如：Room 204 或 李老先生"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                  />
                </div>
              </div>

              {/* Security Warning */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h5 className="text-xs font-bold text-amber-800">安全提示</h5>
                  <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                    新增人員後，系統將發送邀請函至其電子郵件。請確保電子郵件正確無誤，以避免資訊外洩。
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
              >
                取消
              </button>
              <button 
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#007AFF] text-white font-bold text-sm hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {selectedUser ? '儲存變更' : '確認新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
