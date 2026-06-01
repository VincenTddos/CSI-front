// =============================================================================
//  exportService — 將資料匯出為 CSV / JSON 檔（瀏覽器下載）
//  供 SystemSettings 匯出按鈕與報表頁使用。
// =============================================================================

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 將物件陣列轉成 CSV 並下載 */
export function exportToCsv<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (rows.length === 0) {
    triggerDownload('﻿(no data)', filename, 'text/csv;charset=utf-8');
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ];
  // 加 BOM 讓 Excel 正確辨識 UTF-8 中文
  triggerDownload('﻿' + lines.join('\n'), filename, 'text/csv;charset=utf-8');
}

/** 將任意資料轉成 JSON 並下載 */
export function exportToJson(data: unknown, filename: string) {
  triggerDownload(JSON.stringify(data, null, 2), filename, 'application/json;charset=utf-8');
}

/** 產生帶時間戳的檔名，例如 wicare_alerts_20260601.csv */
export function timestampedName(prefix: string, ext: 'csv' | 'json') {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${prefix}_${stamp}.${ext}`;
}
