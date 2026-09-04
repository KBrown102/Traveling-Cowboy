/**
 * FogRenderer.js - 雾渲染模块
 *
 * 独立控制雾的视觉参数：
 *   - 整体雾幕（线性渐变，压低对比度）
 *   - 漂移雾团（径向渐变大圆，缓慢漂移+呼吸缩放）
 *   - 雾的颜色随昼夜微调
 *
 * 经典脚本模式：顶层函数挂全局。
 */

let _fogField = {
  inited: false,
  blobs: [],     // 漂移雾团
  w: 1280, h: 720
};
const _FOG_MAX_BLOBS = 14;

function initFogField(w, h) {
  if (_fogField.inited && _fogField.w === w && _fogField.h === h) return;
  _fogField.w = w; _fogField.h = h; _fogField.inited = true;
  _fogField.blobs = Array.from({ length: _FOG_MAX_BLOBS }, () => ({
    x: 0, y: 0, r: 0, dx: 0, seed: 0, breathPhase: 0, active: false
  }));
}

function updateFogField(dt, wx, type, pi) {
  if (!_fogField.inited) initFogField(wx.width, wx.height);
  const arr = _fogField.blobs, w = wx.width, h = wx.height;
  const count = (type === 'fog') ? arr.length : 0;

  for (let i = 0; i < arr.length; i++) {
    const f = arr[i];
    f.breathPhase = (f.breathPhase || Math.random() * 100) + dt * 0.3;
    if (i < count) {
      if (!f.active) {
        f.active = true;
        f.x = Math.random() * w;
        f.y = h * (0.15 + Math.random() * 0.65);
        f.r = 140 + Math.random() * 200;
        f.dx = (Math.random() * 2 - 1) * 5;
        f.seed = Math.random() * 100;
        f.breathPhase = Math.random() * 100;
      }
      f.x += f.dx * dt;
      // 边界循环
      if (f.x < -f.r) { f.x = w + f.r; f.y = h * (0.15 + Math.random() * 0.65); }
      if (f.x > w + f.r) { f.x = -f.r; }
    } else {
      f.active = false;
    }
  }
}

function renderFog(ctx, wx, pi, w, h) {
  if (!_fogField.inited || pi < 0.02) return;
  const tnow = performance.now() / 1000;

  // ── 整体雾幕（全屏半透明覆盖）──
  const veil = safeLinearGrad(ctx, 0, 0, 0, h);
  if (veil) {
    // 上方更浓、地面稍淡（真实雾的分布）
    veil.addColorStop(0, `rgba(165,172,186,${(pi * 0.26).toFixed(3)})`);
    veil.addColorStop(0.45, `rgba(178,185,198,${(pi * 0.20).toFixed(3)})`);
    veil.addColorStop(0.8, `rgba(188,195,208,${(pi * 0.12).toFixed(3)})`);
    veil.addColorStop(1, `rgba(195,200,212,${(pi * 0.06).toFixed(3)})`);
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);
  }

  // ── 漂移雾团（带呼吸效果）──
  for (const f of _fogField.blobs) {
    if (!f.active) continue;
    // 呼吸缩放：半径缓慢脉动
    const breathMul = 0.88 + 0.12 * Math.sin(f.breathPhase);
    const fr = f.r * breathMul;

    const g = safeRadialGrad(ctx, f.x, f.y, 0, f.x, f.y, fr);
    if (!g) continue;
    g.addColorStop(0, `rgba(200,208,220,${(pi * 0.42).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(202,210,222,${(pi * 0.22).toFixed(3)})`);
    g.addColorStop(0.8, `rgba(205,213,225,${(pi * 0.08).toFixed(3)})`);
    g.addColorStop(1, 'rgba(208,216,228,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, fr, 0, Math.PI * 2);
    ctx.fill();
  }
}
