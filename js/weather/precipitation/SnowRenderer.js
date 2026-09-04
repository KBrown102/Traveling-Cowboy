/**
 * SnowRenderer.js - 雪渲染模块
 *
 * 独立控制雪的视觉参数：
 *   - 缓降飘摆的雪花（大小/摇摆速度各异）
 *   - 近大远小的景深感
 *   - 柔和白色+轻微透明度变化
 *
 * 经典脚本模式：顶层函数挂全局。
 */

let _snowField = {
  inited: false,
  flakes: [],
  w: 1280, h: 720
};
const _SNOW_MAX = 180;

function initSnowField(w, h) {
  if (_snowField.inited && _snowField.w === w && _snowField.h === h) return;
  _snowField.w = w; _snowField.h = h; _snowField.inited = true;
  _snowField.flakes = Array.from({ length: _SNOW_MAX }, () => ({
    x: 0, y: 0, r: 0, vy: 0, sw: 0, ph: 0, alpha: 0, active: false
  }));
}

function updateSnowField(dt, wx, type, pi) {
  if (!_snowField.inited) initSnowField(wx.width, wx.height);
  const arr = _snowField.flakes, w = wx.width, h = wx.height;
  const count = (type === 'snow') ? Math.floor(arr.length * Math.min(1, pi * 1.3)) : 0;

  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (i < count) {
      if (!p.active || p.y > h + 20) {
        p.x = Math.random() * (w + 60) - 30;
        p.y = -Math.random() * 40;
        p.r = 0.8 + Math.random() * 2.8;       // 大小变化
        p.vy = 35 + Math.random() * 70;         // 下落速度慢
        p.sw = 0.4 + Math.random() * 1.2;       // 摆动频率
        p.ph = Math.random() * Math.PI * 2;      // 摆动相位
        p.alpha = 0.45 + Math.random() * 0.40;   // 不透明度
        p.active = true;
      }
      p.y += p.vy * dt;
    } else {
      p.active = false;
    }
  }
}

function renderSnow(ctx, pi, w, h) {
  if (!_snowField.inited || pi < 0.02) return;
  const tnow = performance.now() / 1000;

  for (const p of _snowField.flakes) {
    if (!p.active) continue;
    const sway = Math.sin(tnow * p.sw + p.ph) * p.sw * 10;

    // 每片雪花：核心 + 微光晕
    if (p.r > 2) {
      const gr = safeRadialGrad(ctx, p.x + sway, p.y, 0, p.x + sway, p.y, p.r * 2.5);
      if (gr) {
        gr.addColorStop(0, `rgba(240,246,255,${(p.alpha * 0.5).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(235,242,250,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(p.x + sway, p.y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = `rgba(238,245,255,${(p.alpha * (0.55 + 0.45 * pi)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x + sway, p.y, p.r * (0.7 + 0.3 * Math.abs(Math.sin(tnow * 0.8 + p.ph))), 0, Math.PI * 2);
    ctx.fill();
  }
}
