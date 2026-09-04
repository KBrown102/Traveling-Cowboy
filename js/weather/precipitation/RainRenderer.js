/**
 * RainRenderer.js - 雨渲染模块
 *
 * 独立控制雨的视觉参数：
 *   - 斜落雨线（随风偏移）
 *   - 密度/速度/长度随降水强度变化
 *   - 轻微颜色变化（冷灰蓝调）
 *
 * 经典脚本模式：顶层函数挂全局。
 */

let _rainField = {
  inited: false,
  drops: [],
  w: 1280, h: 720
};
const _RAIN_MAX = 260;

function initRainField(w, h) {
  if (_rainField.inited && _rainField.w === w && _rainField.h === h) return;
  _rainField.w = w; _rainField.h = h; _rainField.inited = true;
  _rainField.drops = Array.from({ length: _RAIN_MAX }, () => ({
    x: 0, y: 0, len: 0, vy: 0, vx: 0, alpha: 0, active: false
  }));
}

function updateRainField(dt, wx, type, pi) {
  if (!_rainField.inited) initRainField(wx.width, wx.height);
  const arr = _rainField.drops, w = wx.width, h = wx.height;
  const wind = wx.current.windSpeed;
  const count = (type === 'rain') ? Math.floor(arr.length * Math.min(1, pi * 1.4)) : 0;

  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (i < count) {
      if (!p.active || p.y > h + 30) {
        p.x = Math.random() * (w + 100) - 50;
        p.y = -Math.random() * 60;
        p.len = 10 + Math.random() * 20;
        p.vy = 500 + Math.random() * 340;
        p.vx = -(28 + wind * 0.9) * (0.5 + Math.random() * 0.6);
        p.alpha = 0.25 + Math.random() * 0.30;
        p.active = true;
      }
      p.y += p.vy * dt;
      p.x += p.vx * dt;
    } else {
      p.active = false;
    }
  }
}

function renderRain(ctx, pi) {
  if (!_rainField.inited || pi < 0.02) return;

  // 用路径批量绘制所有雨线（比逐条 stroke 快）
  ctx.lineCap = 'round';
  for (const p of _rainField.drops) {
    if (!p.active) continue;
    ctx.strokeStyle = `rgba(175,195,225,${(p.alpha * (0.7 + 0.3 * pi)).toFixed(3)})`;
    ctx.lineWidth = 1.0 + (p.alpha > 0.4 ? 0.3 : 0);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // 雨线末端位置（考虑 vx 方向）
    ctx.lineTo(p.x + p.vx * 0.018, p.y - p.len);
    ctx.stroke();
  }
}
