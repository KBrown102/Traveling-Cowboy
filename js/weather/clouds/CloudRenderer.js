/**
 * CloudRenderer.js - 云层渲染引擎 v5（雾式柔变团·水汽流动感）
 *
 * ── 本版为什么重写 ──────────────────────────────
 * v4 用「贝塞尔曲线有机轮廓 + 实色填充」，虽有蓬松起伏，
 * 但本质还是"有清晰轮廓的形状"——人眼仍能看出边界。
 *
 * 用户洞察：云本就是水汽，没有规则形状；而雾气效果（柔和径向渐变团
 * + 缓慢呼吸 + 多团无规则融合）看起来最自然。故 v5 把云改成和雾同源：
 *
 *   - 每朵云 = 多个「雾式柔和渐变团」聚合（中心实、边缘透明，重叠融合
 *     成无规则云体，彻底没有硬边轮廓）
 *   - 团的坐标复用 v4 的隆起布局（积云底排 + 顶部小团 + 附著凸起），
 *     但只取其中心，不再描边
 *   - 每个团用 safeRadialGrad 画椭圆柔团（transform 压扁），中心浓边缘透
 *   - 缓慢「呼吸」：团半径随时间极慢脉动 + 团位置微飘 → 云在"吞吐"流动
 *   - 卷云保留纤维丝带（本就细，不适合团）
 *
 * 避开 v3 晃眼坑：渐变颜色 alpha 走平滑 currentAlpha（不每帧跳），
 * 呼吸极慢（~0.22/s，幅度 6%），所以不会出现光晕闪烁。
 *
 * 云的类型：cumulus（积云）/ stratus（层云）/ cirrus（卷云）
 * 层级：注册在 midground，始终在日月星辰之上。
 * 经典脚本模式：顶层函数挂全局。
 */

// ══════════════════════════════════════
// 云场状态（单例）
// ══════════════════════════════════════
let _cloudField = {
  inited: false,
  clouds: [],
  w: 1280, h: 720,
  lastScroll: 0,
};

// ══════════════════════════════════════
// 工具：确定性伪随机（同seed同结果）
// ══════════════════════════════════════
function _crHash(seed) {
  let h = seed | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  return (h >> 16) ^ h;
}
function _crRand(seed, lo, hi) { return lo + (_crHash(seed) & 0xffff) / 0xffff * (hi - lo); }

// ══════════════════════════════════════
// 初始化云场
// ══════════════════════════════════════
function initCloudField(w, h) {
  if (_cloudField.inited && _cloudField.w === w && _cloudField.h === h) return;
  _cloudField.w = w;
  _cloudField.h = h;
  _cloudField.inited = true;
  _cloudField.clouds = [];

  const N = Math.round(20 + w / 110);
  for (let i = 0; i < N; i++) {
    const high = Math.random() < 0.36;
    const cl = {
      layer: high ? 'high' : 'low',
      parallax: high ? 0.07 : 0.18,
      seed: Math.floor(Math.random() * 1e6),
      scale: 0.65 + Math.random() * 1.15,
      currentAlpha: 0,
      targetAlpha: 0,
      alphaSpeed: 0.7 + Math.random() * 1.0,
      breathPhase: Math.random() * 100,          // 呼吸相位（极慢脉动）
    };
    _initCloudShape(cl, h, true);
    cl.wx = Math.random() * w * 1.6;
    _cloudField.clouds.push(cl);
  }
}

function _initCloudShape(cl, h, initial) {
  if (cl.layer === 'high') {
    cl.y = h * (0.03 + Math.random() * 0.20);
    cl.kind = Math.random() < 0.72 ? 'cirrus' : 'stratus';
    cl.baseAlpha = 0.15 + Math.random() * 0.16;
  } else {
    cl.y = h * (0.26 + Math.random() * 0.26);
    cl.kind = Math.random() < 0.62 ? 'cumulus' : 'stratus';
    cl.baseAlpha = 0.24 + Math.random() * 0.24;
  }
  cl.threshold = 0.06 + Math.random() * 0.75;
  _regenShape(cl);
  if (initial) { cl.currentAlpha = 0; cl.targetAlpha = 0; }
}

/**
 * 生成云的「团中心」布局数据
 *   cumulus → cl.blobs=[{bumps:[{cx,cy,rw,rh}...]}], cl.accents=[{ox,oy,rw,rh}...]
 *   stratus → cl.blobs=[每行一个 {bumps:[...]}]
 *   cirrus  → cl.filaments=[{...}]（丝带，单独渲染）
 * bumps 的坐标即渐变团中心，rw/rh 即团的半宽/半高。
 */
function _regenShape(cl) {
  const s = cl.scale;
  const sd = cl.seed;

  if (cl.kind === 'cumulus') {
    cl.blobs = [_makeCumulusBlob(s, sd)];
    cl.accents = _makeCumulusAccents(s, sd + 100);
    cl.depthLayers = 2;
    cl.filaments = null;
  } else if (cl.kind === 'stratus') {
    cl.blobs = [];
    const rows = 2 + (_crHash(sd + 5) % 3);            // 2~4 行
    for (let r = 0; r < rows; r++) {
      cl.blobs.push(_makeStratusBlob(s, sd + r * 200, r));
    }
    cl.accents = [];
    cl.depthLayers = (rows <= 2) ? 2 : 3;
    cl.filaments = null;
  } else {
    const n = 3 + (_crHash(sd) % 4);
    cl.filaments = [];
    for (let i = 0; i < n; i++) {
      cl.filaments.push(_makeCirrusFilament(s, sd + i * 300, i, n));
    }
    cl.blobs = [];
    cl.accents = [];
    cl.depthLayers = 1;
  }
}

// ══════════════════════════════════════
// 布局生成器 —— 返回团中心坐标数组
// ══════════════════════════════════════
function _makeCumulusBlob(s, sd) {
  const baseW = s * _crRand(sd, 95, 175);
  const baseH = s * _crRand(sd + 1, 40, 70);

  const nBump = 4 + (_crHash(sd + 2) % 4);           // 4~7 个主隆起
  const bumps = [];
  for (let i = 0; i < nBump; i++) {
    const t = nBump > 1 ? i / (nBump - 1) : 0.5;
    const fx = t - 0.5;
    const centerBias = 1 - fx * fx * 2.5;
    const ew = Math.max(0.18, centerBias);
    bumps.push({
      cx: fx * baseW + _crRand(sd + 10 + i, -8, 8),
      cy: -_crRand(sd + 20 + i, 2, 12),
      rw: s * _crRand(sd + 30 + i, 16, 32) * ew,
      rh: s * _crRand(sd + 40 + i, 13, 26) * ew,
    });
  }
  // 顶部小凸起（附加在主体上方）
  const nTop = 2 + (_crHash(sd + 50) % 3);
  for (let i = 0; i < nTop; i++) {
    bumps.push({
      cx: _crRand(sd + 60 + i, -baseW * 0.35, baseW * 0.35),
      cy: -baseH * 0.55 - _crRand(sd + 70 + i, 4, 18),
      rw: s * _crRand(sd + 80 + i, 8, 18),
      rh: s * _crRand(sd + 90 + i, 6, 14),
    });
  }
  return { baseW, baseH, bumps, bottomY: s * 8 };
}

function _makeCumulusAccents(s, sd) {
  const n = 2 + (_crHash(sd) % 3);
  const acc = [];
  for (let i = 0; i < n; i++) {
    acc.push({
      ox: _crRand(sd + i, -40, 40),
      oy: -_crRand(sd + i + 10, 22, 38),
      rw: s * _crRand(sd + i + 20, 6, 14),
      rh: s * _crRand(sd + i + 30, 5, 11),
    });
  }
  return acc;
}

function _makeStratusBlob(s, sd, rowIndex) {
  const baseW = s * _crRand(sd, 220, 380);
  const baseH = s * _crRand(sd + 1, 22, 42);
  const nBump = 6 + (_crHash(sd + 2) % 6);              // 6~11 个平缓团
  const bumps = [];
  const rowOffY = -rowIndex * s * _crRand(sd + 3, 9, 16);
  for (let i = 0; i < nBump; i++) {
    const t = nBump > 1 ? i / (nBump - 1) : 0.5;
    const fx = t - 0.5;
    const ew = Math.max(0.12, 1 - fx * fx * 1.8);
    bumps.push({
      cx: fx * baseW + _crRand(sd + 10 + i, -12, 12),
      cy: rowOffY - _crRand(sd + 20 + i, 1, 7),
      rw: s * _crRand(sd + 30 + i, 14, 28) * ew,
      rh: s * _crRand(sd + 40 + i, 8, 17) * ew,
    });
  }
  return { baseW, baseH, bumps, bottomY: s * 5 + rowOffY };
}

function _makeCirrusFilament(s, sd, idx, total) {
  const len = s * _crRand(sd, 55, 120);
  const thick = s * _crRand(sd + 1, 1.0, 2.8);
  const amp = s * _crRand(sd + 2, 2, 7);
  const freq = 1.5 + _crRand(sd + 3, 0.8, 2.5);
  const oy = (idx - total / 2) * s * _crRand(sd + 4, 5, 10);
  const phase = _crHash(sd + 5) / 0x7fffffff * Math.PI * 2;
  const aMod = 0.45 + _crRand(sd + 6, 0, 0.55);
  return { len, thick, amp, freq, oy, phase, aMod };
}

// ══════════════════════════════════════
// 雾式柔变团绘制
// ══════════════════════════════════════
/**
 * 画一个椭圆柔变团（雾同源）：中心实、边缘透明，靠重叠融合成无规则云体。
 * @param {number} bx,by  团中心屏幕坐标
 * @param {number} rw,rh  半宽/半高
 * @param {number} alpha  团基础不透明度（稳定值，不每帧跳）
 * @param {number} breath 呼吸相位
 */
function _drawSoftBlob(ctx, bx, by, rw, rh, alpha, colFn, breath, seed) {
  rw = Math.max(3, rw);
  rh = Math.max(3, rh);
  // 呼吸：半径极慢脉动（幅度6%）
  const breathMul = 0.94 + 0.06 * Math.sin(breath * 0.6 + seed);
  const R = Math.max(rw, rh) * breathMul;
  // 团位置微飘（流动感）
  const drift = Math.sin(breath * 0.4 + seed * 1.7) * rh * 0.10;

  ctx.save();
  ctx.translate(bx, by + drift);
  ctx.scale(1, Math.max(0.32, rh / rw));     // 压扁成椭圆柔团
  const g = safeRadialGrad(ctx, 0, 0, 0, 0, 0, R);
  if (g) {
    g.addColorStop(0,    colFn(alpha));        // 中心（浓）
    g.addColorStop(0.55, colFn(alpha * 0.55)); // 中段
    g.addColorStop(1,    colFn(0));            // 边缘完全透明 → 无硬边
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ══════════════════════════════════════
// 渲染函数
// ══════════════════════════════════════
/**
 * 渲染一朵积云/层云（多层前后参差，每层=一组雾式柔变团）
 */
function _drawPuffyCloud(ctx, cl, csx, colFn, alpha) {
  if (!cl.blobs || !cl.blobs.length) return;
  const cy = cl.y;
  const depth = cl.depthLayers || 2;
  const breath = cl.breathPhase;

  for (let d = 0; d < depth; d++) {
    const t = depth > 1 ? d / (depth - 1) : 0;        // 0=后层, 1=前层
    const offx = (t - 0.5) * cl.scale * 30;           // 层间水平错落
    const offy = (t - 0.5) * cl.scale * 6;            // 层间垂直错落
    const sc = 1.16 - t * 0.24;                       // 后层大、前层稍小
    const la = alpha * (0.24 + t * 0.30);             // 后淡前浓（单层团，整体偏淡防过曝）
    if (la < 0.012) continue;

    // 主 blob 团
    for (const blob of cl.blobs) {
      for (let bi = 0; bi < blob.bumps.length; bi++) {
        const bp = blob.bumps[bi];
        const bx = csx + offx + bp.cx * sc;
        const by = cy + offy + bp.cy * sc;
        _drawSoftBlob(ctx, bx, by, bp.rw * sc, bp.rh * sc, la, colFn, breath, bp.cx * 0.1 + bi);
      }
    }
    // 附著小凸起（仅积云）
    if (cl.accents && cl.kind === 'cumulus') {
      for (let ai = 0; ai < cl.accents.length; ai++) {
        const acc = cl.accents[ai];
        const bx = csx + offx + acc.ox * sc;
        const by = cy + offy + acc.oy * sc;
        _drawSoftBlob(ctx, bx, by, acc.rw * sc, acc.rh * sc, la * 0.9, colFn, breath, acc.ox * 0.1 + ai + 50);
      }
    }
  }
}

/**
 * 渲染卷云丝带（正弦波动的细长贝塞尔带，保留纤薄感）
 */
function _drawCirrusCloud(ctx, cl, csx, colFn, alpha) {
  if (!cl.filaments || !cl.filaments.length) return;
  const cy = cl.y;
  const breath = cl.breathPhase;
  for (const fil of cl.filaments) {
    const a = alpha * fil.aMod * 0.80;
    if (a < 0.008) continue;
    const wob = Math.sin(breath * 0.3 + fil.phase) * fil.thick * 0.4;  // 丝带轻微飘
    ctx.fillStyle = colFn(a * 0.50);
    _traceFilamentPath(ctx, fil, csx, cy + wob, cl.scale * 1.15, a);
    ctx.fill();
    ctx.fillStyle = colFn(a);
    _traceFilamentPath(ctx, fil, csx, cy - wob, cl.scale * 0.92, a);
    ctx.fill();
  }
}

/**
 * 绘制卷云丝带路径（正弦波动的细长带）
 */
function _traceFilamentPath(ctx, fil, cx, cy, sc, alphaMult) {
  const sx = cx - fil.len * sc * 0.5;
  const ey = cx + fil.len * sc * 0.5;
  const py = cy + fil.oy * sc;
  const th = Math.max(0.6, fil.thick * sc);
  const am = fil.amp * sc;
  const fr = fil.freq;
  const ph = fil.phase;
  const seg = Math.ceil(fil.len * sc / 18);

  ctx.beginPath();
  ctx.moveTo(sx, py);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const xx = sx + (ey - sx) * t;
    const yy = py - Math.sin(t * fr * Math.PI * 2 + ph) * am;
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  for (let i = seg; i >= 0; i--) {
    const t = i / seg;
    const xx = sx + (ey - sx) * t;
    const yy = py - Math.sin(t * fr * Math.PI * 2 + ph) * am + th;
    ctx.lineTo(xx, yy);
  }
  ctx.closePath();
}

// ══════════════════════════════════════
// 每帧更新云场（由 WeatherSystem 调度）
// ══════════════════════════════════════
function updateCloudField(dt, wx) {
  if (!_cloudField.inited) initCloudField(wx.width, wx.height);
  _cloudField.lastScroll = wx.worldScroll;
  const w = wx.width, h = wx.height;

  for (const cl of _cloudField.clouds) {
    const drift = (cl.layer === 'high')
      ? 1.5 + wx.current.windSpeed * 0.10
      : 3.5 + wx.current.windSpeed * 0.40;
    cl.wx -= drift * dt;

    // 呼吸相位推进（极慢，约 0.22/s）
    cl.breathPhase = (cl.breathPhase || 0) + dt * 0.22;

    const csx = cl.wx - wx.worldScroll * cl.parallax;

    if (csx < -cl.scale * 320 - 80) {
      cl.wx = wx.worldScroll * cl.parallax + w + Math.random() * w * 0.6;
      _initCloudShape(cl, h, false);
    }

    const clz = typeof wx.cloudinessAt === 'function' ? wx.cloudinessAt(cl.wx) : 0.15;
    const patch = 0.65 + 0.35 * hashFloat(Math.floor(cl.wx * 0.013) + cl.seed);
    let a = (clz - cl.threshold) / 0.25;
    a = a < 0 ? 0 : (a > 1 ? 1 : a);
    cl.targetAlpha = a * cl.baseAlpha * patch;

    const diff = cl.targetAlpha - cl.currentAlpha;
    const maxChange = cl.alphaSpeed * dt;
    if (Math.abs(diff) <= maxChange) cl.currentAlpha = cl.targetAlpha;
    else cl.currentAlpha += Math.sign(diff) * maxChange;
  }
}

// ══════════════════════════════════════
// 主入口：渲染所有可见云
// ══════════════════════════════════════
function renderClouds(ctx, wx, c) {
  if (!_cloudField.inited) return;

  const day = c.time ? c.time.dayIntensity : 0.6;
  const overcast = c.weather ? c.weather.overcast : 0.1;
  const w = wx.width, h = wx.height;

  // 水汽色：白天偏亮白、夜里偏暗冷；阴天压灰
  const cr = Math.round(82 + (208 - 82) * day);
  const cg = Math.round(90 + (214 - 90) * day);
  const cb = Math.round(106 + (224 - 106) * day);
  const dim = 1 - overcast * 0.42;
  const R = Math.round(cr * dim), G = Math.round(cg * dim), B = Math.round(cb * dim);

  const colFn = (al) => `rgba(${R},${G},${B},${al.toFixed(3)})`;

  for (const cl of _cloudField.clouds) {
    const a = cl.currentAlpha * (0.5 + 0.5 * day);
    if (a < 0.015) continue;

    const csx = cl.wx - wx.worldScroll * cl.parallax;
    if (csx < -cl.scale * 340 || csx > w + cl.scale * 340) continue;

    if (cl.kind === 'cirrus') _drawCirrusCloud(ctx, cl, csx, colFn, a);
    else _drawPuffyCloud(ctx, cl, csx, colFn, a);
  }
}

// ══════════════════════════════════════
// 日月遮挡采样（供 SkyRenderer 使用）
// ══════════════════════════════════════
function sampleObscuration(screenX, screenY) {
  if (!_cloudField.inited) return 0;
  let sum = 0;
  for (const cl of _cloudField.clouds) {
    if (cl.currentAlpha < 0.05) continue;
    const csx = cl.wx - _cloudField.lastScroll * cl.parallax;
    const dx = Math.abs(screenX - csx);
    const dy = Math.abs(screenY - cl.y);
    const rx = cl.scale * 140;
    const ry = cl.scale * 55;
    if (dx < rx && dy < ry) {
      const close = (1 - dx / rx) * (1 - dy / ry);
      sum += cl.currentAlpha * close * 0.9;
    }
  }
  return sum > 0.92 ? 0.92 : sum;
}
