// 本地產生的「縮寫頭像」(initials avatar)，回傳 data URI SVG。
// 取代外部 picsum.photos：避免 demo 時無網路或該服務掛掉造成整排破圖，
// 同時不洩漏使用者名稱到第三方服務。

const PALETTE = [
  '#2563eb', '#0891b2', '#059669', '#7c3aed',
  '#db2777', '#ea580c', '#ca8a04', '#475569',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initialsOf(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  // 中文取最後一字；英文取前兩個單字字首
  if (/[一-龥]/.test(trimmed)) {
    return trimmed.slice(-2);
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** 依名稱產生穩定的縮寫頭像 data URI（可直接放進 <img src>）。 */
export function initialsAvatar(name: string, size = 150): string {
  const initials = initialsOf(name);
  const bg = PALETTE[hashString(name || '?') % PALETTE.length];
  const fontSize = Math.round(size * (initials.length > 1 ? 0.4 : 0.5));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="100%" height="100%" fill="${bg}"/>` +
    `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" ` +
    `font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" ` +
    `font-size="${fontSize}" font-weight="600" fill="#ffffff">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
