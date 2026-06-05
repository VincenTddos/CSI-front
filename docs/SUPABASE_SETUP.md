# Supabase 雲端資料庫 — 設定指南

本系統使用 **Supabase（受管 PostgreSQL）** 作為雲端資料庫與認證後端。
未設定金鑰時，前端會自動 fallback 回瀏覽器 localStorage（方便本機開發），
但**正式 demo 與多裝置資料請務必完成以下設定**。

---

## 1. 建立 Supabase 專案
1. 前往 https://supabase.com → 以 GitHub 或 Email 註冊登入
2. **New Project** → 填專案名稱（例：`wicare`）、設定資料庫密碼、選最近區域（如 `Northeast Asia (Tokyo)`）
3. 等待約 2 分鐘佈建完成

## 2. 套用資料庫 Schema（= ER 圖）
1. 左側選單 → **SQL Editor** → **New query**
2. 開啟本專案 [`supabase/migrations/0001_initial_schema.sql`](../supabase/migrations/0001_initial_schema.sql)，**全選複製**貼上
3. 按 **Run**。應顯示成功，並在 **Table Editor** 看到 9 張表與分析檢視表

> 已安裝 Supabase CLI 者，亦可在專案根目錄執行 `supabase db push`。

## 3. 關閉 Email 驗證（因使用「帳號」而非真實信箱）
本系統以「帳號」登入，內部對應為 `帳號@wicare.local` 的合成 Email。
1. 左側 → **Authentication** → **Providers** → **Email**
2. 關閉 **Confirm email**（否則合成信箱無法收驗證信而卡住）→ Save

> 若日後改用真實 Email 註冊，可重新開啟此選項。

## 4. （選用）啟用 Google 登入
1. **Authentication** → **Providers** → **Google** → 開啟
2. 貼上 Google Cloud Console 取得的 **Client ID / Client Secret**
   （Client ID 與前端 `.env` 的 `VITE_GOOGLE_CLIENT_ID` 相同）
3. Save

## 5. 取得金鑰並填入 `.env`
1. 左側 → **Project Settings** → **API**
2. 複製 **Project URL** 與 **anon public** 金鑰
3. 在專案根目錄複製 `.env.example` 為 `.env`，填入：

```dotenv
VITE_SUPABASE_URL="https://你的專案.supabase.co"
VITE_SUPABASE_ANON_KEY="貼上 anon public 金鑰"

# 後端 core_bridge.py 推送事件用（service_role 金鑰請勿放前端）
SUPABASE_URL="https://你的專案.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="貼上 service_role 金鑰（Project Settings → API）"
WICARE_DEVICE_ID="稍後在 devices 表建立後填入此裝置的 UUID"
```

4. 重啟 `npm run dev`，瀏覽器 Console 不再出現 `[Supabase] ... 未設定` 警告即代表連線成功。

## 6. 建立初始資料（房間 / 裝置）
於 **Table Editor** 手動新增，或在 **SQL Editor** 執行：

```sql
insert into public.rooms (name) values ('客廳'), ('臥室'), ('浴室');

insert into public.devices (name, room_id, status)
select '裝置-' || r.name, r.id, 'offline' from public.rooms r;

-- 取得裝置 UUID 後，填回各台 core_bridge 的 .env WICARE_DEVICE_ID
select id, name from public.devices;
```

## 6.5 套用角色權限升級（migration 0002）— 開發者最高權限
1. **SQL Editor** → 開啟 [`supabase/migrations/0002_roles_and_developer.sql`](../supabase/migrations/0002_roles_and_developer.sql)
2. **先單獨執行【第一段】** `alter type user_role add value ...`，按 Run
   （PostgreSQL 規定新 enum 值需先 commit）
3. **再執行【第二段】** 其餘所有 SQL（輔助函式、RLS、trigger、一次性提升）

此 migration 會：
- 新增 **`developer`（開發者）** 最高角色
- 讓開發者享 admin 級 RLS 權限（`is_admin()` / `is_staff()`）
- 註冊時自動指派角色：**開發者信箱 → developer**；其餘（含 Google 註冊）**預設 family 最低權限**
- **防自我提權**：一般使用者不可從前端改自己的 `role`
- 把白名單既有帳號一次性提升為 developer

> **開發者白名單**：同時存在於兩處，要保持一致——
> 前端 `src/lib/roles.ts` 的 `DEVELOPER_EMAILS`、
> 資料庫 `0002` 的 `public.developer_emails()` 函式。預設為 `vincent6244@gmail.com`。

## 7. 驗證
- 註冊一個帳號 → 在 **Authentication → Users** 看到新使用者、**profiles** 表出現對應資料列
- 登入後新增住民/健康記錄 → 對應表出現資料
- 登出清快取再登入 → 資料仍在（已脫離 localStorage）

---

### 疑難排解
| 症狀 | 原因 / 解法 |
|------|------------|
| 註冊後無法登入 | 未關閉 Confirm email（見步驟 3） |
| 前端一直 fallback localStorage | `.env` 未填或 `npm run dev` 未重啟 |
| 讀取資料為空但無錯誤 | RLS 生效中——確認該帳號 role 有權限（admin 最完整） |
| Google 登入失敗 | 未在 Supabase 啟用 Google provider，或 Client ID 不一致 |
