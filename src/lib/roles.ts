import { UserRole } from '../types';

// =============================================================================
//  角色與權限共用設定（供 UserContext / Sidebar 等使用）
// =============================================================================

// 開發者（最高權限）白名單 —— 只有這些身分會被指派 'developer' 角色。
// 要新增開發者，把信箱加進來即可。
export const DEVELOPER_EMAILS = ['vincent6244@gmail.com'];
export const DEVELOPER_USERNAMES = ['developer'];

// 管理者審核碼 —— 註冊「管理者」時需填入此碼才能通過審核（輕量審核機制）。
// 由開發者私下發給可信任的管理人員即可，避免任何人都能自行升級為管理者。
export const ADMIN_APPROVAL_CODE = 'WICARE-ADMIN-2025';

/** 驗證管理者審核碼是否正確（大小寫、前後空白不敏感） */
export function isValidAdminApprovalCode(code?: string | null): boolean {
  return (code ?? '').trim().toLowerCase() === ADMIN_APPROVAL_CODE.toLowerCase();
}

/** 依 Google 信箱或登入帳號判斷是否為開發者 */
export function isDeveloperIdentity(email?: string | null, username?: string | null): boolean {
  const e = (email ?? '').trim().toLowerCase();
  const u = (username ?? '').trim().toLowerCase();
  return (
    (!!e && DEVELOPER_EMAILS.map(x => x.toLowerCase()).includes(e)) ||
    (!!u && DEVELOPER_USERNAMES.map(x => x.toLowerCase()).includes(u))
  );
}

/** 角色中文標籤 */
export function roleLabel(role?: UserRole | null): string {
  switch (role) {
    case 'developer': return '開發者';
    case 'admin': return '管理者';
    case 'medical': return '醫護人員';
    case 'family': return '家屬';
    default: return role ?? '';
  }
}

/** 開發者可看到所有功能 */
export function canSeeAll(role?: UserRole | null): boolean {
  return role === 'developer';
}

/** 角色階層（數字越大權限越高），可用於比較 */
export const ROLE_RANK: Record<UserRole, number> = {
  family: 1,
  medical: 2,
  admin: 3,
  developer: 4,
};
