/**
 * BirdsRenderer.js - 飞鸟装饰系统
 *
 * 定位：天空中的「活物装饰」，和云 / 石 / 植物同一家族——让场景更生动一点点。
 * 这不是复杂生态，就是偶尔掠过的一两只、或一小群飞鸟剪影。
 *
 * 关键规则（呼应黑名单 #3 + 用户要求）：
 *   - 恶劣天气(雨/雪/沙暴) + 重阴(overcast≥0.75) + 深夜 必须隐藏飞鸟
 *   - 频率「综合考虑所有装饰物」：天空已有云在占位，飞鸟必须很稀疏，避免拥挤
 *       · 同屏硬上限 BIRD_MAX_ON_SCREEN（只有几只）
 *       · 生成间隔受「云量拥挤度 × 场景亲密度」调制（云越多 / 越不亲鸟的场景 → 越稀）
 *       · 全局 visibility 逐帧 lerp 平滑淡入淡出（不硬切，呼应之前阴晴连续化诉求）
 *
 * 鸟的形态：远处小剪影，双翼用 quadraticCurveTo 画成海鸥式「M」形，翅膀随时间上下扇动。
 *
 * 层级：注册在 midground（云之后），飞鸟在云前方、清晰可见。
 * 经典脚本模式：顶层函数挂全局。
 */

// ══════════════════════════════════════
// 飞鸟场状态（单例）
// ══════════════════════════════════════
let _birdField = {
  inited: false,
  birds: [],
  w: 1280, h: 720,
  spawnTimer: 4,        // 距离下一次生成尝试的秒数
  visibility: 0,        // 全局可见度（平滑）：0=完全隐藏 1=完全可见
  lastScroll: 0,
};

// 同屏飞鸟硬上限（稀疏！）
const BIRD_MAX_ON_SCREEN = 6;
// 基础生成间隔（秒）：晴朗开阔天空里，每隔这么久考虑生成一群
const BIRD_BASE_SPAWN = 9;

// 场景亲密度：不同地貌鸟的多少不同（海岸多海鸥、沙漠/戈壁少）
const BIRD_AFFINITY = {
  coast: 1.35,
  plains: 1.0, grassland: 1.0, suburb: 0.95,
  oasis: 0.9, village: 0.85, farmland: 0.9, castle: 0.8,
  city: 0.6,
  mountains: 0.7, tundra: 0.5,
  desert: 0.4, gobi: 0.4,
};
function sceneBirdAffinity(id) {
  if (!id) return 0.9;
  for (const k in BIRD_AFFINITY) if (id.indexOf(k) >= 0) return BIRD_AFFINITY[k];
  return 0.9;
}

function _bLerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

// ══════════════════════════════════════
// 初始化
// ══════════════════════════════════════
function initBirdField(w, h) {
  if (_birdField.inited && _birdField.w === w && _birdField.h === h) return;
  _birdField.w = w; _birdField.h = h; _birdField.inited = true;
  _birdField.birds = [];
  _birdField.spawnTimer = 3 + Math.random() * 5;
}

// 估算当前屏幕上「可见云」数量，作为天空拥挤度参考（云越多，鸟越稀）
function _skyCrowding() {
  if (typeof _cloudField === 'undefined' || !_cloudField.clouds) return 0;
  let vis = 0;
  for (const cl of _cloudField.clouds) {
    if (cl.currentAlpha > 0.12) vis++;
  }
  return vis;
}

// ══════════════════════════════════════
// 每帧更新（由 WeatherSystem.update 调用，传入 timeData 供深夜判定）
// ══════════════════════════════════════
function updateBirdField(dt, weather, timeData, scene) {
  if (!_birdField.inited) initBirdField(weather.width, weather.height);
  _birdField.lastScroll = weather.worldScroll;
  const w = weather.width, h = weather.height;

  const wState = weather.current;
  const night = timeData ? timeData.nightIntensity : 0;

  // 目标可见度：恶劣天气 / 重阴 / 深夜 → 0；否则 1
  const severe = weather.isSevere();
  const heavyOvercast = wState.overcast >= 0.75;
  const deepNight = night > 0.7;
  const target = (severe || heavyOvercast || deepNight) ? 0 : 1;

  // 平滑过渡（防硬切）
  const k = Math.min(1, dt * 1.8);
  _birdField.visibility += (target - _birdField.visibility) * k;
  if (_birdField.visibility < 0.01) _birdField.visibility = 0;

  // 更新现有飞鸟（扇翅 + 平移 + 轻微上下浮动）
  for (const b of _birdField.birds) {
    b.flapPhase += b.flapSpeed * dt;
    b.x += b.vx * dt;
    b.y += Math.sin(b.flapPhase * 0.5 + b.bobSeed) * b.bobAmp * dt;
  }
  // 回收飞出屏幕的
  _birdField.birds = _birdField.birds.filter(b =>
    b.x > -80 - b.size * 4 && b.x < w + 80 + b.size * 4
  );

  // 生成新群（仅当可见度够高、且未超上限）
  _birdField.spawnTimer -= dt;
  if (_birdField.spawnTimer <= 0) {
    _birdField.spawnTimer = _nextSpawnInterval(weather, timeData, scene);
    if (_birdField.visibility > 0.4 && _birdField.birds.length < BIRD_MAX_ON_SCREEN) {
      _spawnFlock(weather, scene);
    }
  }
}

// 综合频率计算：基础间隔 ÷ (天空开放度 × 场景亲密度)，再叠随机
function _nextSpawnInterval(weather, timeData, scene) {
  const wState = weather.current;
  const crowd = _skyCrowding();
  const cloudOpen = 1 - Math.min(1, wState.cloudiness * 0.7);   // 云越多，开放度越低
  const aff = sceneBirdAffinity(scene ? scene.id : null);      // 场景亲密度
  let interval = BIRD_BASE_SPAWN / Math.max(0.15, cloudOpen * aff);
  interval *= 0.8 + Math.random() * 0.8;                         // ±20% 随机
  return interval;
}

// 生成一群飞鸟（单只 / 松散 V 字 / 横列）
function _spawnFlock(weather, scene) {
  const w = weather.width, h = weather.height;
  const dir = Math.random() < 0.5 ? 1 : -1;                    // 飞行方向
  const baseY = h * (0.06 + Math.random() * 0.46);             // 天空上半部分
  const baseSize = 3 + Math.random() * 4.5;
  const wind = weather.current.windSpeed || 8;
  const baseSpeed = (22 + Math.random() * 30) + wind * 0.15;   // 受风轻微影响

  // 群大小：强烈偏向小群（不拥挤）
  const roll = Math.random();
  let n = 1;
  if (roll > 0.55) n = 2 + Math.floor(Math.random() * 2);      // 2~3
  if (roll > 0.82) n = 4 + Math.floor(Math.random() * 3);      // 4~6
  n = Math.min(n, BIRD_MAX_ON_SCREEN - _birdField.birds.length);
  if (n <= 0) return;

  const form = n === 1 ? 'single' : (Math.random() < 0.6 ? 'vee' : 'line');

  for (let i = 0; i < n; i++) {
    let ox = 0, oy = 0;
    if (form === 'vee') {
      // 领头在队首，其余沿飞行反方向拖出 V 字
      const rank = i === 0 ? 0 : Math.ceil(i / 2);
      const side = i === 0 ? 0 : (i % 2 === 0 ? 1 : -1);
      ox = -dir * rank * (16 + Math.random() * 10);
      oy = rank * (9 + Math.random() * 7) * (side === 0 ? 0 : 1);
      if (side < 0) oy = -oy;
    } else if (form === 'line') {
      ox = (i - (n - 1) / 2) * (20 + Math.random() * 10);
      oy = (Math.random() - 0.5) * 14;
    }

    const startX = dir > 0
      ? -60 - Math.abs(ox) - Math.random() * 40
      : w + 60 + Math.abs(ox) + Math.random() * 40;

    _birdField.birds.push({
      x: startX,
      y: baseY + oy,
      vx: dir * baseSpeed * (0.9 + Math.random() * 0.25),
      size: baseSize * (0.85 + Math.random() * 0.4),
      flapPhase: Math.random() * Math.PI * 2,
      flapSpeed: 6 + Math.random() * 5,
      bobAmp: 6 + Math.random() * 8,
      bobSeed: Math.random() * 10,
      seed: Math.floor(Math.random() * 1e6),
    });
  }
}

// ══════════════════════════════════════
// 主入口：渲染所有飞鸟（注册在 midground，云之后）
// ══════════════════════════════════════
function renderBirds(ctx, c) {
  if (!_birdField.inited) initBirdField(c.width, c.height);
  const { width, height, time, weather } = c;
  const vis = _birdField.visibility;
  if (vis < 0.02) return;

  // 鸟色：暗剪影，白天近黑、黄昏略暖暗；阴天里稍淡
  const day = time ? time.dayIntensity : 0.5;
  const cr = Math.round(_bLerp(14, 8, day));
  const cg = Math.round(_bLerp(14, 8, day));
  const cb = Math.round(_bLerp(22, 16, day));
  const overcast = weather ? (weather.overcast || 0) : 0;
  const alphaScale = (1 - overcast * 0.35) * vis;

  const color = `rgb(${cr},${cg},${cb})`;

  for (const b of _birdField.birds) {
    _drawBird(ctx, b, alphaScale, color);
  }
}

// 单只飞鸟剪影：海鸥式「M」形（双翼 quadraticCurveTo + 底部回连线成实心）
function _drawBird(ctx, b, alpha, color) {
  const s = b.size;
  if (s <= 0) return;
  const flap = Math.sin(b.flapPhase);            // -1..1
  const wingLift = s * (0.30 + 0.70 * flap);    // 翼尖抬升量（扇动）
  const span = s * 1.7;
  const a = alpha;
  if (a < 0.02) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(b.x - span * 0.5, b.y - wingLift);
  ctx.quadraticCurveTo(b.x - span * 0.20, b.y + s * 0.10, b.x, b.y);
  ctx.quadraticCurveTo(b.x + span * 0.20, b.y + s * 0.10, b.x + span * 0.5, b.y - wingLift);
  ctx.quadraticCurveTo(b.x, b.y + s * 0.28, b.x - span * 0.5, b.y - wingLift);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
