// =============================================================================
//  geminiService — 呼叫後端 /api/ai-analysis（Vite middleware 代理 Gemini）
//  注意：此 API 端點由 vite.config.ts 提供，需在 npm run dev 下運作，
//        並於 .env 設定 GEMINI_API_KEY。
// =============================================================================

export async function askGemini(prompt: string): Promise<string> {
  const response = await fetch('/api/ai-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `AI 服務回應失敗 (${response.status})`);
  }
  return result.text || '（AI 無回應）';
}

/** 照護週報資料摘要（餵給 AI 的結構化輸入） */
export interface CareReportInput {
  residentName: string;
  periodLabel: string;            // 例：'2026/05/30 – 06/05'
  fallTotal: number;
  fallConfirmed: number;
  fallFalseAlarm: number;
  avgActivity: number;            // 平均活動分數
  nightActivityEvents: number;    // 夜間（00-06）活動次數
  longInactiveHours: number;      // 日間最長靜止時數
  activityTrend: 'up' | 'down' | 'flat';
  latestBp?: string;              // '120/80'
  latestSpo2?: number;
  latestWeight?: number;
  latestBloodSugar?: number;
  riskLevel: '低' | '中' | '高';
}

/** 組裝照護週報 prompt 並呼叫 AI */
export async function generateCareReport(input: CareReportInput): Promise<string> {
  const trendText = { up: '上升', down: '下降', flat: '持平' }[input.activityTrend];
  const prompt = `
你是一位專業的長期照護分析師。請根據以下「${input.residentName}」於 ${input.periodLabel} 的監測數據，
撰寫一份給家屬與照護人員看的照護摘要報告。

【跌倒事件】總計 ${input.fallTotal} 次（確認 ${input.fallConfirmed} 次、誤報 ${input.fallFalseAlarm} 次）
【活動量】平均活動分數 ${input.avgActivity}，整體趨勢「${trendText}」
【作息】夜間(00–06時)活動 ${input.nightActivityEvents} 次；日間最長靜止約 ${input.longInactiveHours} 小時
【健康數值】血壓 ${input.latestBp ?? '無資料'}、血氧 ${input.latestSpo2 ?? '無資料'}%、體重 ${input.latestWeight ?? '無資料'}kg、血糖 ${input.latestBloodSugar ?? '無資料'}mg/dL
【系統風險評級】${input.riskLevel}風險

請用繁體中文輸出，分成以下四段（用標題）：
1. 本週總結（2-3 句白話摘要）
2. 需要注意的徵兆（條列，若無則說明狀況穩定）
3. 給照護人員的建議（條列，具體可行）
4. 給家屬的一句安心話

語氣專業但溫暖，避免醫療診斷字眼，以「觀察與建議」為主。
`.trim();
  return askGemini(prompt);
}
