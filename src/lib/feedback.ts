// =============================================================================
//  feedback — 誤報回饋閉環的純邏輯：依各房間「確認/誤報」次數回推靈敏度調整方向。
//  從 FeedbackSensitivity 抽出以便單元測試。
// =============================================================================

export type SensitivityRec = 'lower' | 'keep' | 'raise';

/**
 * 依確認 / 誤報次數建議靈敏度調整：
 *  - 已處理 ≥2 且誤報率 ≥50% → 調低（提高閾值，減少干擾）
 *  - 確認 ≥2 且零誤報 → 略升（更早預警）
 *  - 其餘 → 維持
 */
export function recommendSensitivity(confirmed: number, falseAlarms: number): { rec: SensitivityRec; rationale: string } {
  const processed = confirmed + falseAlarms;
  const rate = processed > 0 ? falseAlarms / processed : 0;
  if (processed >= 2 && rate >= 0.5) {
    return { rec: 'lower', rationale: '誤報偏多，調低靈敏度（提高觸發閾值）可減少干擾' };
  }
  if (confirmed >= 2 && falseAlarms === 0) {
    return { rec: 'raise', rationale: '皆為真實事件且零誤報，可略升靈敏度更早預警' };
  }
  return { rec: 'keep', rationale: '誤報率在合理範圍，維持現有閾值' };
}
