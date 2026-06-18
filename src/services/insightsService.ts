import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CareReportInput } from './geminiService';
import { listAlerts } from './alertsService';

// =============================================================================
//  insightsService — 行為/作息分析、健康風險評分（資料來源：Supabase）
//  將「資料」轉成「管理洞察」，供智慧照護分析頁與 AI 週報使用。
// =============================================================================

const DAY = 86400000;
const sinceIso = (days: number) => new Date(Date.now() - days * DAY).toISOString();

interface ActRow { bucket_time: string; avg_score: number | null; max_score: number | null }

// 模擬模式：以 residentId 為種子產生穩定的逐時活動（夜間低、日間高），讓熱力圖/行為旗標有資料
function synthActivity(residentId: string | undefined, days: number): ActRow[] {
  const seed = (residentId ?? 'all').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rows: ActRow[] = [];
  const now = new Date();
  for (let d = days - 1; d >= 0; d--) {
    for (let h = 0; h < 24; h++) {
      const t = new Date(now);
      t.setDate(now.getDate() - d);
      t.setHours(h, 0, 0, 0);
      const dayShape = h >= 7 && h <= 21 ? 1 : 0.15;       // 作息：日間活躍、夜間靜止
      const wave = Math.abs(Math.sin((seed + d * 24 + h) * 0.7));
      const base = 8 + dayShape * 55 * wave;
      rows.push({ bucket_time: t.toISOString(), avg_score: Math.round(base), max_score: Math.round(base + 10 + wave * 25) });
    }
  }
  return rows;
}

async function fetchActivity(residentId?: string, days = 7): Promise<ActRow[]> {
  if (!isSupabaseConfigured) return synthActivity(residentId, days);
  let q = supabase.from('activity_summaries')
    .select('bucket_time, avg_score, max_score, resident_id')
    .gte('bucket_time', sinceIso(days))
    .order('bucket_time', { ascending: true });
  if (residentId) q = q.eq('resident_id', residentId);
  const { data, error } = await q;
  if (error) { console.warn('[insights] activity', error.message); return []; }
  return (data ?? []) as ActRow[];
}

/** 24 小時 × N 天 活動熱力圖（每格平均活動分數） */
export interface HeatRow { date: string; hours: number[] }
export async function getActivityHeatmap(residentId?: string, days = 7): Promise<HeatRow[]> {
  const rows = await fetchActivity(residentId, days);
  const map = new Map<string, { sum: number[]; cnt: number[] }>();
  for (const r of rows) {
    const d = new Date(r.bucket_time);
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, { sum: Array(24).fill(0), cnt: Array(24).fill(0) });
    const slot = map.get(key)!;
    const h = d.getHours();
    slot.sum[h] += r.avg_score ?? 0;
    slot.cnt[h] += 1;
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, s]) => ({ date, hours: s.sum.map((v, i) => (s.cnt[i] ? Math.round(v / s.cnt[i]) : 0)) }));
}

/** 行為旗標：夜間活動、日間久靜、趨勢、平均活動 */
export interface BehaviorFlags {
  avgActivity: number;
  nightActivity: number;       // 00–06 時活動分數偏高的次數
  longInactiveHours: number;   // 日間(08–20)連續低活動最長時數
  trend: 'up' | 'down' | 'flat';
  hasData: boolean;
}
export async function getBehaviorFlags(residentId?: string, days = 7): Promise<BehaviorFlags> {
  const rows = await fetchActivity(residentId, days);
  if (rows.length === 0) {
    return { avgActivity: 0, nightActivity: 0, longInactiveHours: 0, trend: 'flat', hasData: false };
  }
  const scores = rows.map(r => r.avg_score ?? 0);
  const avgActivity = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // 夜間活動（00–06 時 且 分數 > 25）
  const nightActivity = rows.filter(r => {
    const h = new Date(r.bucket_time).getHours();
    return h >= 0 && h < 6 && (r.avg_score ?? 0) > 25;
  }).length;

  // 日間最長低活動（08–20 時，分數 < 5 視為靜止）連續分鐘 → 換算小時
  let maxIdle = 0, cur = 0;
  for (const r of rows) {
    const h = new Date(r.bucket_time).getHours();
    if (h >= 8 && h < 20) {
      if ((r.avg_score ?? 0) < 5) { cur += 1; maxIdle = Math.max(maxIdle, cur); }
      else cur = 0;
    }
  }
  const longInactiveHours = Math.round((maxIdle / 60) * 10) / 10;

  // 趨勢：前半 vs 後半 平均
  const mid = Math.floor(scores.length / 2);
  const first = scores.slice(0, mid);
  const second = scores.slice(mid);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const diff = avg(second) - avg(first);
  const trend: BehaviorFlags['trend'] = diff > 3 ? 'up' : diff < -3 ? 'down' : 'flat';

  return { avgActivity, nightActivity, longInactiveHours, trend, hasData: true };
}

/** 健康風險評分（0–100）+ 等級 + 因子明細 */
export interface RiskFactor { label: string; severity: 'good' | 'warn' | 'bad' }
export interface RiskAssessment {
  score: number;
  level: '低' | '中' | '高';
  factors: RiskFactor[];
}
export async function getRiskAssessment(residentId?: string, days = 7): Promise<RiskAssessment> {
  const factors: RiskFactor[] = [];
  let score = 0;

  // 跌倒事件
  let confirmedFalls = 0;
  if (isSupabaseConfigured) {
    let fq = supabase.from('fall_events').select('status, detected_at').gte('detected_at', sinceIso(days));
    if (residentId) fq = fq.eq('resident_id', residentId);
    const { data } = await fq;
    confirmedFalls = (data ?? []).filter(f => f.status === 'confirmed').length;
  } else {
    // 模擬模式：由單一警報 store 統計確認跌倒
    const since = sinceIso(days);
    const alerts = await listAlerts(1000);
    confirmedFalls = alerts.filter(a =>
      a.status === 'confirmed' && a.detected_at >= since && (!residentId || a.resident_id === residentId),
    ).length;
  }
  if (confirmedFalls > 0) { score += Math.min(40, confirmedFalls * 25); factors.push({ label: `本週 ${confirmedFalls} 次確認跌倒`, severity: 'bad' }); }
  else factors.push({ label: '本週無確認跌倒', severity: 'good' });

  // 行為
  const b = await getBehaviorFlags(residentId, days);
  if (b.nightActivity >= 3) { score += 15; factors.push({ label: `夜間頻繁活動（${b.nightActivity} 次）`, severity: 'warn' }); }
  if (b.longInactiveHours >= 4) { score += 15; factors.push({ label: `日間長時間靜止（約 ${b.longInactiveHours} 小時）`, severity: 'warn' }); }
  if (b.trend === 'down') { score += 15; factors.push({ label: '活動量呈下降趨勢', severity: 'warn' }); }
  else if (b.trend === 'up') factors.push({ label: '活動量穩定或上升', severity: 'good' });

  // 健康數值（最新一筆）
  if (isSupabaseConfigured) {
    let hq = supabase.from('daily_health_records').select('bp_sys, blood_oxygen, record_date').order('record_date', { ascending: false }).limit(1);
    if (residentId) hq = hq.eq('resident_id', residentId);
    const { data } = await hq;
    const h = data?.[0];
    if (h) {
      if (h.blood_oxygen != null && h.blood_oxygen < 95) { score += 15; factors.push({ label: `血氧偏低（${h.blood_oxygen}%）`, severity: 'bad' }); }
      if (h.bp_sys != null && h.bp_sys >= 140) { score += 10; factors.push({ label: `收縮壓偏高（${h.bp_sys}）`, severity: 'warn' }); }
    }
  }

  score = Math.max(0, Math.min(100, score));
  const level: RiskAssessment['level'] = score < 30 ? '低' : score < 60 ? '中' : '高';
  return { score, level, factors };
}

/** 組裝 AI 週報所需的輸入 */
export async function buildCareReportInput(residentId: string | undefined, residentName: string, days = 7): Promise<CareReportInput> {
  const [b, risk] = await Promise.all([getBehaviorFlags(residentId, days), getRiskAssessment(residentId, days)]);

  let fallTotal = 0, fallConfirmed = 0, fallFalse = 0;
  let bp: string | undefined, spo2: number | undefined, weight: number | undefined, sugar: number | undefined;

  if (isSupabaseConfigured) {
    let fq = supabase.from('fall_events').select('status').gte('detected_at', sinceIso(days));
    if (residentId) fq = fq.eq('resident_id', residentId);
    const { data: falls } = await fq;
    fallTotal = falls?.length ?? 0;
    fallConfirmed = (falls ?? []).filter(f => f.status === 'confirmed').length;
    fallFalse = (falls ?? []).filter(f => f.status === 'false_alarm').length;

    let hq = supabase.from('daily_health_records').select('bp_sys, bp_dia, blood_oxygen, record_date').order('record_date', { ascending: false }).limit(1);
    if (residentId) hq = hq.eq('resident_id', residentId);
    const { data: hr } = await hq;
    if (hr?.[0]) {
      if (hr[0].bp_sys && hr[0].bp_dia) bp = `${hr[0].bp_sys}/${hr[0].bp_dia}`;
      spo2 = hr[0].blood_oxygen ?? undefined;
    }
    let cq = supabase.from('routine_checkups').select('weight, blood_sugar, record_date').order('record_date', { ascending: false }).limit(1);
    if (residentId) cq = cq.eq('resident_id', residentId);
    const { data: cr } = await cq;
    if (cr?.[0]) { weight = cr[0].weight ?? undefined; sugar = cr[0].blood_sugar ?? undefined; }
  } else {
    // 模擬模式：跌倒統計來自單一警報 store（健康數值由 AI 週報文字側略過）
    const since = sinceIso(days);
    const alerts = (await listAlerts(1000)).filter(a => a.detected_at >= since && (!residentId || a.resident_id === residentId));
    fallTotal = alerts.length;
    fallConfirmed = alerts.filter(a => a.status === 'confirmed').length;
    fallFalse = alerts.filter(a => a.status === 'false_alarm').length;
  }

  const end = new Date();
  const startD = new Date(Date.now() - days * DAY);
  const fmt = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

  return {
    residentName,
    periodLabel: `${fmt(startD)} – ${fmt(end)}`,
    fallTotal, fallConfirmed, fallFalseAlarm: fallFalse,
    avgActivity: b.avgActivity,
    nightActivityEvents: b.nightActivity,
    longInactiveHours: b.longInactiveHours,
    activityTrend: b.trend,
    latestBp: bp, latestSpo2: spo2, latestWeight: weight, latestBloodSugar: sugar,
    riskLevel: risk.level,
  };
}
