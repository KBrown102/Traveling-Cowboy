/**
 * ColorUtils.js - 颜色工具函数集（修复NaN崩溃版）
 *
 * 关键修复：
 *   adjustBright() 现在兼容 #rrggbb 和 rgb(r,g,b) 两种输入格式
 *   所有输出值带 isFinite 保护，防止 NaN 传入 Canvas API
 */
// ══════════════════════════════════════
// 安全的渐变创建包装（防止 NaN 崩溃）
// ══════════════════════════════════════

function safeRadialGrad(ctx, x0, y0, r0, x1, y1, r1) {
  if (!isFinite(x0) || !isFinite(y0) || !isFinite(r0) ||
      !isFinite(x1) || !isFinite(y1) || !isFinite(r1)) {
    return null;
  }
  r0 = Math.max(0, r0); r1 = Math.max(0, r1);
  try { return ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); }
  catch(e) { return null; }
}

function safeLinearGrad(ctx, x0, y0, x1, y1) {
  if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return null;
  try { return ctx.createLinearGradient(x0, y0, x1, y1); }
  catch(e) { return null; }
}

// ══════════════════════════════════════
// 颜色操作（全部带 NaN 保护）
// ══════════════════════════════════════

/** 调整亮度 factor>1变亮 <1变暗 · 兼容 #hex 和 rgb() 格式 */
function adjustBright(hexColor, factor) {
  let r, g, b;
  if (String(hexColor).startsWith('rgb(')) {
    const m = String(hexColor).match(/\d+/g);
    if (!m || m.length < 3) return hexColor;
    r = clamp(Math.round(+m[0] * factor));
    g = clamp(Math.round(+m[1] * factor));
    b = clamp(Math.round(+m[2] * factor));
  } else {
    const hex = String(hexColor).replace('#', '');
    r = clamp(Math.round(parseInt(hex.substr(0, 2), 16) * factor));
    g = clamp(Math.round(parseInt(hex.substr(2, 2), 16) * factor));
    b = clamp(Math.round(parseInt(hex.substr(4, 2), 16) * factor));
  }
  if (!isFinite(r)) r = 0;
  if (!isFinite(g)) g = 0;
  if (!isFinite(b)) b = 0;
  return `rgb(${r},${g},${b})`;
}

/** #hex → {r,g,b} */
function hexToRGB(hex) {
  hex = String(hex).replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return {
    r: parseInt(hex.substr(0, 2), 16) || 0,
    g: parseInt(hex.substr(2, 2), 16) || 0,
    b: parseInt(hex.substr(4, 2), 16) || 0
  };
}

/** 两色插值 → 返回 rgb(r,g,b) 字符串 */
function lerpColor(c1, c2, t) {
  const a = hexToRGB(c1.startsWith('rgb') ? rgbStrToHex(c1) : c1);
  const b = hexToRGB(c2.startsWith('rgb') ? rgbStrToHex(c2) : c2);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

/** rgb(r,g,b) → #rrggbb */
function rgbStrToHex(rgb) {
  const m = String(rgb).match(/\d+/g);
  if (!m || m.length < 3) return '000000';
  return (+m[0]).toString(16).padStart(2,'0') +
         (+m[1]).toString(16).padStart(2,'0') +
         (+m[2]).toString(16).padStart(2,'0');
}

function clamp(v) { return Math.max(0, Math.min(255, v)); }

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** 高质量哈希随机（用于星空等需要真随机的场景）*/
function hashFloat(seed) {
  let h = seed >>> 0;
  h = (h ^ (h >>> 16)) * 0x45d9f3b | 0;
  h = (h ^ (h >>> 15)) * 0xc6ba279d | 0;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
