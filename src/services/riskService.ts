// =============================================================================
//  riskService — 規則式跌倒風險評分（全體住民可排行）
//  輸入：住民（DataContext）+ 警報事件（alertsService，含種子示範資料）。
//  ⚠️ 這是「規則式」評分，非機器學習模型；分數用於排序與提醒優先順序，
//     不作為醫療診斷。各加權因子皆可在下方表格調整。
// =============================================================================
import type { Patient } from '../types';
import type { FallEventRow } from './database.types';

export interface ResidentRisk {
  resident: Patient;
  score: number;            // 0–100
  level: '低' | '中' | '高';
  confirmedFalls: number;   // 近 14 天確認跌倒次數
  pending: number;          // 待處理警報
  falseAlarms: number;      // 誤報（不計入風險，僅供參考）
  lastEventAt: string | null;
  factors: string[];        // 人類可讀的風險因子
}

const DAY = 86400000;
const daysAgo = (iso: string) => (Date.now() - new Date(iso).getTime()) / DAY;

// 病史關鍵字 → 風險標籤與加權（命中即加分）
const RISK_HISTORY: Array<[RegExp, string, number]> = [
  [/心臟|心律|冠/, '心臟疾病', 6],
  [/中風|腦/, '腦中風病史', 7],
  [/腎/, '腎功能不全', 5],
  [/糖尿/, '糖尿病', 4],
  [/高血壓/, '高血壓', 4],
  [/關節|骨|帕金森|失智/, '行動/平衡障礙', 6],
];

/** 單一住民風險評分（規則式）。 */
export function computeResidentRisk(resident: Patient, alerts: FallEventRow[]): ResidentRisk {
  const mine = alerts.filter((a) => a.resident_id === resident.id);
  const recent = mine.filter((a) => daysAgo(a.detected_at) <= 14);
  const confirmedFalls = recent.filter((a) => a.status === 'confirmed').length;
  const pending = recent.filter((a) => a.status === 'pending').length;
  const falseAlarms = recent.filter((a) => a.status === 'false_alarm').length;
  const inactivity = recent.filter((a) => /無活動|靜止/.test(a.event_type)).length;
  const lastEventAt = mine.length
    ? mine.reduce((m, a) => (a.detected_at > m ? a.detected_at : m), mine[0].detected_at)
    : null;

  const factors: string[] = [];
  let score = 0;

  // ---- 事件型風險（近 14 天）----
  if (confirmedFalls > 0) {
    score += 28 + (confirmedFalls - 1) * 16;
    factors.push(`近 14 天確認跌倒 ${confirmedFalls} 次`);
  }
  if (pending > 0) {
    score += 12 * pending;
    factors.push(`待處理警報 ${pending} 件`);
  }
  if (inactivity > 0) {
    score += 10 * inactivity;
    factors.push(`異常靜止事件 ${inactivity} 次`);
  }
  // 近因加權（越近越危險）
  if (lastEventAt && daysAgo(lastEventAt) <= 1) {
    score += 12;
    factors.push('24 小時內有事件');
  } else if (lastEventAt && daysAgo(lastEventAt) <= 3) {
    score += 6;
  }

  // ---- 靜態體質風險（年齡 / 病史 / 備註）----
  if (resident.age >= 80) {
    score += 10;
    factors.push('高齡 ≥ 80');
  } else if (resident.age >= 75) {
    score += 5;
  }
  const hx = (resident.medicalHistory ?? []).join(' ');
  for (const [re, label, w] of RISK_HISTORY) {
    if (re.test(hx)) {
      score += w;
      factors.push(label);
    }
  }
  if (/行動不便|跌倒|睡眠/.test(resident.notes ?? '')) {
    score += 5;
    factors.push('備註提及行動/睡眠風險');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: ResidentRisk['level'] = score >= 60 ? '高' : score >= 30 ? '中' : '低';
  if (factors.length === 0) factors.push('近期無異常事件');

  return { resident, score, level, confirmedFalls, pending, falseAlarms, lastEventAt, factors };
}

/** 全體住民依風險分數由高到低排序。 */
export function rankResidentsByRisk(residents: Patient[], alerts: FallEventRow[]): ResidentRisk[] {
  return residents
    .map((r) => computeResidentRisk(r, alerts))
    .sort((a, b) => b.score - a.score);
}
