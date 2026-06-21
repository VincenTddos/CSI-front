// =============================================================================
//  trackingViz — 動線/熱力圖的視覺常數與顏色（純函式，無 React）。
// =============================================================================

/** 停留熱力圖網格（約 0.5m/格，對應 6×5m 房間）。 */
export const HEAT_GX = 12;
export const HEAT_GY = 10;

/** 熱力圖單格顏色：t=0..1（綠→黃→紅），低值近透明。 */
export function heatCellColor(t: number): string {
  if (t <= 0) return 'transparent';
  const r = t < 0.5 ? Math.round(34 + t * 2 * (245 - 34)) : 245;
  const g = t < 0.5 ? 197 : Math.round(197 - (t - 0.5) * 2 * (197 - 68));
  return `rgba(${r},${g},68,${0.1 + t * 0.55})`;
}
