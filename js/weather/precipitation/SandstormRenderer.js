/**
 * SandstormRenderer.js - 沙暴渲染模块
 *
 * 独立控制沙暴的所有视觉参数：
 *   - 细碎尘粒（0.5~2px，暖金棕色调）
 *   - 水平线条风痕（快速掠过的半透明线段，模拟风的形状）
 *   - 近地密集/高空稀疏的真实分布
 *   - 风速联动：风越大，线条越长、粒子越快
 *
 * 经典脚本模式：顶层函数挂全局。
 */

// ══════════════════════════════════════
// 沙暴状态
// ══════════════════════════════════════
let _sandField = {
  inited: false,
  dusts: [],       // 细碎尘粒
  streaks: [],     // 风的线条
  w: 1280, h: 720
};

const _SAND_MAX_DUSTS = 280;
const _SAND_MAX_STREAKS = 60;

// ══════════════════════════════════════
// 初始化
// ══════════════════════════════════════
function initSandField(w, h) {
  if (_sandField.inited && _sandField.w === w && _sandField.h === h) return;
  _sandField.w = w;
  _sandField.h = h;
  _sandField.inited = true;

  // 尘粒池
  _sandField.dusts = Array.from({ length: _SAND_MAX_DUSTS }, () => ({
    x: 0, y: 0, r: 0,      // r = 0.5~2
    alpha: 0,
    speed: 0,               // 单独速度微调
    active: false
  }));

  // 风线池
  _sandField.streaks = Array.from({ length: _SAND_MAX_STREAKS }, () => ({
    x: 0, y: 0, len: 0, thick: 0, alpha: 0, speed: 0, active: false
  }));
}

// ══════════════════════════════════════
// 更新
// ══════════════════════════════════════
function updateSandField(dt, wx, type, pi) {
  if (!_sandField.inited) initSandField(wx.width, wx.height);
  const arr = _sandField.dusts;
  const strk = _sandField.streaks;
  const w = wx.width, h = wx.height;
  const wind = wx.current.windSpeed;

  const isSand = (type === 'sandstorm');
  const dustCount = isSand ? Math.floor(arr.length * Math.min(1, pi * 1.4)) : 0;
  const streakCount = isSand ? Math.floor(strk.length * Math.min(1, pi * 1.6)) : 0;

  // ── 尘粒 ──
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (i < dustCount) {
      if (!p.active || p.x < -20) {
        // 从右侧生成
        p.x = w + Math.random() * 80;
        p.y = h * (0.25 + Math.random() * 0.72);
        // ★ 细颗粒！0.5~2px（之前是 1~4px 太大）
        p.r = 0.4 + Math.random() * 1.6;
        // 近地更密集 → 大颗粒偏下
        if (p.y > h * 0.65) {
          p.r += Math.random() * 0.8;
        }
        p.alpha = 0.15 + Math.random() * 0.35;
        p.speed = 140 + wind * 1.2 + Math.random() * 80;
        p.active = true;
      }
      // 移动
      p.x -= p.speed * dt;
      // 微小上下飘动
      p.y += Math.sin(performance.now() / 400 + i) * (3 + wind * 0.05) * dt;
    } else {
      p.active = false;
    }
  }

  // ── 风线（★ 核心改进：用线条勾勒风的形状）──
  for (let i = 0; i < strk.length; i++) {
    const s = strk[i];
    if (i < streakCount) {
      if (!s.active || s.x < -s.len - 20) {
        s.x = w + Math.random() * 40;
        s.y = h * (0.15 + Math.random() * 0.75);
        // 线条参数：长度随风速变化
        const baseLen = 30 + wind * 0.8;
        s.len = baseLen * (0.5 + Math.random() * 1.0);  // 15~100+ px
        s.thick = 0.4 + Math.random() * 1.4;             // 细线为主
        s.alpha = 0.06 + Math.random() * 0.18;           // 半透明
        s.speed = 200 + wind * 1.8 + Math.random() * 120; // 比尘粒更快
        s.active = true;
      }
      s.x -= s.speed * dt;
      // 轻微波浪形摆动
      s.y += Math.sin(performance.now() / 250 + i * 1.7) * (2 + wind * 0.03) * dt;
    } else {
      s.active = false;
    }
  }
}

// ══════════════════════════════════════
// 绘制沙暴
// ══════════════════════════════════════
/**
 * 渲染沙暴（由 main.js 注册到 foreground 层）
 */
function renderSandstorm(ctx, wx, pi) {
  if (!_sandField.inited) return;
  if (pi < 0.02) return;

  const tnow = performance.now();

  // ── 1. 风线（先画，在底层）──
  ctx.lineCap = 'round';
  for (const s of _sandField.streaks) {
    if (!s.active || s.alpha < 0.01) continue;

    // 颜色：金棕色调，带透明度渐变（尾部更透明）
    const grad = safeLinearGrad(ctx, s.x - s.len, s.y, s.x, s.y);
    if (!grad) continue;
    // 头部稍亮、尾部渐隐
    grad.addColorStop(0, `rgba(210,180,120,0)`);
    grad.addColorStop(0.3, `rgba(210,180,120,${(s.alpha * 0.7).toFixed(3)})`);
    grad.addColorStop(0.7, `rgba(200,170,110,${(s.alpha * 0.9).toFixed(3)})`);
    grad.addColorStop(1, `rgba(190,160,100,${(s.alpha * 0.4).toFixed(3)})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = s.thick;
    ctx.beginPath();
    // 轻微曲线
    const cy = s.y + Math.sin(tnow / 300 + s.x * 0.01) * 2;
    ctx.moveTo(s.x - s.len, cy);
    ctx.quadraticCurveTo(s.x - s.len * 0.5, cy - 2, s.x, cy);
    ctx.stroke();
  }

  // ── 2. 尘粒（细碎点，在风线之上）──
  for (const p of _sandField.dusts) {
    if (!p.active) continue;
    // 颜色变化：随机偏暖金或棕
    const warmth = ((p.x | 0) ^ (p.y | 0)) & 1;
    let cr, cg, cb;
    if (warmth) {
      cr = 210; cg = 175; cb = 105;
    } else {
      cr = 195; cg = 160; cb = 95;
    }
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${(p.alpha * (0.5 + 0.5 * pi)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 3. 整体沙幕（已移除：尘粒+风线已足够表达沙暴，无需额外遮罩层）──
  //     原代码：近地浓度更高的渐变 fillRect 遮罩，会和 SkyRenderer 阴晴幕
  //     叠加导致右侧出现明显暗斑。如需微调氛围可降低阴晴幕强度。
}
