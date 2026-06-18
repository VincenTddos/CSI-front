// =============================================================================
//  sleepService — 睡眠品質 Lite（前端 TS 移植，輸入 = movement score 整夜時序）
//
//  這是 python/sleep_quality.py 的 TypeScript 對應實作：同一演算法、同一份門檻
//  （@/python/sleep_config.json），並以 tests/fixtures 與 Python 對拍保證數字一致。
//
//  資料來源：使用者上傳 core_bridge --record 產生的 {ts, score} jsonl（約 10 Hz）。
//  資料不足 / 找不到睡眠時段 → 回傳 null 欄位 + reason（confidence:'low'），
//  絕不捏造數字（對應全域規則 1）。純函式、無亂數。
// =============================================================================

import rawConfig from '@/python/sleep_config.json';

export interface SleepConfig {
  binSec: number;
  motionScoreThreshold: number;
  onsetQuietMotionFrac: number;
  onsetPersistMin: number;
  awakeningScoreThreshold: number;
  awakeningMinSec: number;
  awakeningMergeGapSec: number;
  restlessEnergyNorm: number;
  restlessWTime: number;
  restlessWEnergy: number;
  idealSleepMinLo: number;
  idealSleepMinHi: number;
  efficiencyTarget: number;
  awakeningPenalty: number;
  wDuration: number;
  wEfficiency: number;
  wRestlessness: number;
  wAwakenings: number;
  qualityLabels: Array<[number, string]>;
  minRecordMin: number;
}

export interface ScorePoint {
  ts: number; // epoch 秒
  score: number;
}

export interface AwakeningEvent {
  start: string;
  end: string;
  peak_score: number;
}

export interface ScoreSub {
  weight: number;
  sub: number;
}

export interface SleepReport {
  sleep_onset: string | null;
  wake_time: string | null;
  time_in_bed_min: number | null;
  total_sleep_min: number | null;
  restlessness_index: number | null;
  awakenings: number;
  awakening_events: AwakeningEvent[];
  sleep_score: number | null;
  score_breakdown: Record<string, ScoreSub>;
  quality_label: string | null;
  confidence: 'ok' | 'low';
  reason: string | null;
}

// --- 從共用 JSON 載入設定（與 Python SleepConfig.from_dict 對應） ---
export function loadSleepConfig(): SleepConfig {
  const d = rawConfig as Record<string, unknown>;
  return {
    binSec: Number(d.bin_sec),
    motionScoreThreshold: Number(d.motion_score_threshold),
    onsetQuietMotionFrac: Number(d.onset_quiet_motion_frac),
    onsetPersistMin: Number(d.onset_persist_min),
    awakeningScoreThreshold: Number(d.awakening_score_threshold),
    awakeningMinSec: Number(d.awakening_min_sec),
    awakeningMergeGapSec: Number(d.awakening_merge_gap_sec),
    restlessEnergyNorm: Number(d.restless_energy_norm),
    restlessWTime: Number(d.restless_w_time),
    restlessWEnergy: Number(d.restless_w_energy),
    idealSleepMinLo: Number(d.ideal_sleep_min_lo),
    idealSleepMinHi: Number(d.ideal_sleep_min_hi),
    efficiencyTarget: Number(d.efficiency_target),
    awakeningPenalty: Number(d.awakening_penalty),
    wDuration: Number(d.w_duration),
    wEfficiency: Number(d.w_efficiency),
    wRestlessness: Number(d.w_restlessness),
    wAwakenings: Number(d.w_awakenings),
    qualityLabels: (d.quality_labels as Array<[number, string]>).map(
      ([thr, label]) => [Number(thr), String(label)] as [number, string],
    ),
    minRecordMin: Number(d.min_record_min),
  };
}

const DEFAULT_CONFIG = loadSleepConfig();

// --------------------------------------------------------------------------- //
//  小工具（與 Python 版一一對應）
// --------------------------------------------------------------------------- //
function clip(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/** epoch 秒 → ISO8601（毫秒 + 'Z'），與 Python _iso()／JS toISOString() 對齊。 */
function isoFromEpoch(epochSec: number): string {
  return new Date(Math.round(epochSec * 1000)).toISOString();
}

function parseTs(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms / 1000;
  }
  return null;
}

/** 解析 core_bridge --record 的 jsonl 文字 → ScorePoint[]（壞行略過）。 */
export function parseRecordingJsonl(text: string): ScorePoint[] {
  const out: ScorePoint[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line) as { ts?: unknown; score?: unknown };
      const ts = parseTs(obj.ts);
      const score = typeof obj.score === 'number' ? obj.score : Number(obj.score);
      if (ts === null || !Number.isFinite(score)) continue;
      out.push({ ts, score });
    } catch {
      continue;
    }
  }
  return out;
}

function lowReport(reason: string): SleepReport {
  return {
    sleep_onset: null, wake_time: null, time_in_bed_min: null, total_sleep_min: null,
    restlessness_index: null, awakenings: 0, awakening_events: [], sleep_score: null,
    score_breakdown: {}, quality_label: null, confidence: 'low', reason,
  };
}

/** 連續安靜區塊（長度 >= minLen），回傳 [start, endExclusive]。 */
function quietBlocks(quiet: boolean[], minLen: number): Array<[number, number]> {
  const blocks: Array<[number, number]> = [];
  const n = quiet.length;
  let i = 0;
  while (i < n) {
    if (quiet[i]) {
      let j = i;
      while (j < n && quiet[j]) j += 1;
      if (j - i >= minLen) blocks.push([i, j]);
      i = j;
    } else {
      i += 1;
    }
  }
  return blocks;
}

interface Burst { start_ts: number; end_ts: number; peak_score: number; }

/** 動作爆發：score>thr 的原始區段，合併間隔<mergeGap，保留持續>=minSec 者。 */
function bursts(ts: number[], score: number[], thr: number,
                minSec: number, mergeGapSec: number): Burst[] {
  const n = score.length;
  const raw: Burst[] = [];
  let i = 0;
  while (i < n) {
    if (score[i] > thr) {
      let j = i;
      let peak = score[i];
      while (j < n && score[j] > thr) {
        if (score[j] > peak) peak = score[j];
        j += 1;
      }
      raw.push({ start_ts: ts[i], end_ts: ts[j - 1], peak_score: peak });
      i = j;
    } else {
      i += 1;
    }
  }

  const merged: Burst[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && seg.start_ts - last.end_ts < mergeGapSec) {
      last.end_ts = seg.end_ts;
      last.peak_score = Math.max(last.peak_score, seg.peak_score);
    } else {
      merged.push({ ...seg });
    }
  }
  return merged.filter((m) => m.end_ts - m.start_ts >= minSec);
}

function durationSub(totalSleepMin: number, cfg: SleepConfig): number {
  const lo = cfg.idealSleepMinLo;
  const hi = cfg.idealSleepMinHi;
  if (totalSleepMin >= lo && totalSleepMin <= hi) return 100.0;
  if (totalSleepMin < lo) return clip((totalSleepMin / lo) * 100.0, 0.0, 100.0);
  return clip(100.0 - ((totalSleepMin - hi) / hi) * 100.0, 0.0, 100.0);
}

function qualityLabel(score: number, cfg: SleepConfig): string {
  for (const [thr, label] of cfg.qualityLabels) {
    if (score >= thr) return label;
  }
  return cfg.qualityLabels[cfg.qualityLabels.length - 1][1];
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

// --------------------------------------------------------------------------- //
//  主分析（鏡射 python/sleep_quality.analyze_sleep）
// --------------------------------------------------------------------------- //
export function analyzeSleep(series: ScorePoint[], cfg: SleepConfig = DEFAULT_CONFIG): SleepReport {
  const n = series.length;
  if (n < 2) return lowReport('資料不足：樣本數過少');

  const ts = series.map((p) => p.ts);
  const score = series.map((p) => p.score);

  const spanMin = (ts[n - 1] - ts[0]) / 60.0;
  if (spanMin < cfg.minRecordMin) {
    return lowReport(`資料時長約 ${spanMin.toFixed(0)} 分鐘，低於最低需求 ${cfg.minRecordMin.toFixed(0)} 分鐘`);
  }

  // 1) 分箱：每箱 motion_frac
  const t0 = ts[0];
  const binSec = cfg.binSec;
  const nbins = Math.floor((ts[n - 1] - t0) / binSec) + 1;
  const counts = new Array<number>(nbins).fill(0);
  const motionFrac = new Array<number>(nbins).fill(0);
  for (let i = 0; i < n; i += 1) {
    let idx = Math.floor((ts[i] - t0) / binSec);
    if (idx < 0) idx = 0;
    if (idx > nbins - 1) idx = nbins - 1;
    counts[idx] += 1;
    if (score[i] > cfg.motionScoreThreshold) motionFrac[idx] += 1;
  }
  for (let b = 0; b < nbins; b += 1) {
    if (counts[b] > 0) motionFrac[b] /= counts[b];
  }

  // 2) 入睡 / 起床
  const persistBins = Math.max(1, Math.round((cfg.onsetPersistMin * 60.0) / binSec));
  const quiet = motionFrac.map((v) => v < cfg.onsetQuietMotionFrac);
  const blocks = quietBlocks(quiet, persistBins);
  if (blocks.length === 0) {
    return lowReport('未偵測到持續安靜時段（可能整夜未入睡、離床或訊號異常）');
  }

  const onsetTs = t0 + blocks[0][0] * binSec;
  const wakeTs = t0 + blocks[blocks.length - 1][1] * binSec;
  if (wakeTs <= onsetTs) return lowReport('睡眠時段無法界定（起床時間不晚於入睡時間）');
  const timeInBedMin = (wakeTs - onsetTs) / 60.0;

  // 3) 睡眠時段樣本
  const tsSleep: number[] = [];
  const sSleep: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (ts[i] >= onsetTs && ts[i] < wakeTs) {
      tsSleep.push(ts[i]);
      sSleep.push(score[i]);
    }
  }
  if (sSleep.length < 2) return lowReport('睡眠時段樣本不足');

  // 4) 夜醒次數
  const events = bursts(tsSleep, sSleep, cfg.awakeningScoreThreshold,
    cfg.awakeningMinSec, cfg.awakeningMergeGapSec);
  const awakenings = events.length;
  const awakeMin = events.reduce((acc, e) => acc + (e.end_ts - e.start_ts), 0) / 60.0;
  const totalSleepMin = Math.max(0.0, timeInBedMin - awakeMin);

  // 5) 躁動指數
  const motionTimeFrac = mean(sSleep.map((s) => (s > cfg.motionScoreThreshold ? 1 : 0)));
  const motionEnergy = Math.min(
    1.0,
    mean(sSleep.map((s) => Math.max(0.0, s - cfg.motionScoreThreshold))) / cfg.restlessEnergyNorm,
  );
  const restlessness = clip(
    cfg.restlessWTime * motionTimeFrac + cfg.restlessWEnergy * motionEnergy, 0.0, 1.0,
  );

  // 6) 綜合分數
  const durSub = durationSub(totalSleepMin, cfg);
  const eff = timeInBedMin > 0 ? totalSleepMin / timeInBedMin : 0.0;
  const effSub = clip((eff / cfg.efficiencyTarget) * 100.0, 0.0, 100.0);
  const restSub = clip((1.0 - restlessness) * 100.0, 0.0, 100.0);
  const awkSub = clip(100.0 - awakenings * cfg.awakeningPenalty, 0.0, 100.0);
  const rawScore = cfg.wDuration * durSub + cfg.wEfficiency * effSub
    + cfg.wRestlessness * restSub + cfg.wAwakenings * awkSub;
  const sleepScore = Math.round(clip(rawScore, 0.0, 100.0));

  const scoreBreakdown: Record<string, ScoreSub> = {
    duration: { weight: cfg.wDuration, sub: round(durSub, 2) },
    efficiency: { weight: cfg.wEfficiency, sub: round(effSub, 2) },
    restlessness: { weight: cfg.wRestlessness, sub: round(restSub, 2) },
    awakenings: { weight: cfg.wAwakenings, sub: round(awkSub, 2) },
  };

  return {
    sleep_onset: isoFromEpoch(onsetTs),
    wake_time: isoFromEpoch(wakeTs),
    time_in_bed_min: round(timeInBedMin, 2),
    total_sleep_min: round(totalSleepMin, 2),
    restlessness_index: round(restlessness, 4),
    awakenings,
    awakening_events: events.map((e) => ({
      start: isoFromEpoch(e.start_ts),
      end: isoFromEpoch(e.end_ts),
      peak_score: round(e.peak_score, 2),
    })),
    sleep_score: sleepScore,
    score_breakdown: scoreBreakdown,
    quality_label: qualityLabel(sleepScore, cfg),
    confidence: 'ok',
    reason: null,
  };
}

/** 從上傳的 jsonl 文字直接產生報告（前端便利函式）。 */
export function analyzeRecordingText(text: string, cfg: SleepConfig = DEFAULT_CONFIG): SleepReport {
  return analyzeSleep(parseRecordingJsonl(text), cfg);
}
