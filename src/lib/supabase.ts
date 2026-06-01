import { createClient } from '@supabase/supabase-js';

// =============================================================================
//  Supabase Client — Wi-Care 雲端資料庫連線
//
//  金鑰由 .env 提供（不入 git）：
//    VITE_SUPABASE_URL       = https://<your-project>.supabase.co
//    VITE_SUPABASE_ANON_KEY  = <anon public key>
//
//  取得方式：Supabase Dashboard → Project Settings → API
// =============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 是否已設定 Supabase（未設定時前端會 fallback 回 localStorage，方便本機開發） */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // 不丟錯誤，僅警告——讓未設定金鑰的開發者仍能啟動前端
  console.warn(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 未設定，' +
    '資料層將 fallback 回 localStorage。請複製 .env.example 為 .env 並填入金鑰。'
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
