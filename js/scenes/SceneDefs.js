/**
 * SceneDefs.js - 场景定义数据（息壤风格·深色调版）
 * 每个场景：名称、地面颜色、远山层级颜色、地形风格、天气概率、停留昼夜倍数
 *
 * ⚠️ 天空颜色已全局化（见下方 SKY_KEYFRAMES），不再跟随场景——
 *    场景自带 sky 字段仅为保留备用，后续拆分场景文件时清理，请勿再用于取色。
 *
 * 配色原则：
 * - 夜间以深靛蓝/墨紫为基调
 * - 黎明/黄昏用暖橙金色过渡（由大气辉光单独叠加）
 * - 白天用柔和的暗调蓝（非亮青）
 * - 剪影统一使用极暗色 #0a0a12
 */

// 6个昼夜关键帧
function sky(dawn, morning, noon, afternoon, dusk, night) {
  return { dawn, morning, noon, afternoon, dusk, night };
}

/**
 * ══════════════════════════════════════
 * 全局天空配色（与场景无关！）
 * ════════════════════════════════════
 * 设计原则（用户明确要求的「基础规则」）：
 *   天空颜色只由「太阳高度角(昼夜)」+「天气」决定，与脚下是什么场景无关。
 *   绿洲不该让天变绿、海岸不该让天变蓝——那种大色块是错的。
 *   黎明/黄昏的暖色由大气散射辉光(drawAtmosphericGlow)单独叠加。
 */

// 关键帧锚点：progress → 颜色（0=深夜, 0.5=正午, 1.0=深夜循环）
const SKY_KEYFRAMES = [
  { p: 0.00, c: '#0a0e1c' }, // 深夜：近黑墨蓝
  { p: 0.20, c: '#243049' }, // 黎明：深蓝（日出暖辉另叠）
  { p: 0.35, c: '#34507e' }, // 早晨：柔和蓝
  { p: 0.50, c: '#3e5a8c' }, // 正午：清澈蓝（暗调治愈风，非亮青）
  { p: 0.65, c: '#35527e' }, // 下午：蓝
  { p: 0.78, c: '#1e2a48' }, // 黄昏：深蓝（落日暖辉另叠）
  { p: 0.90, c: '#0a0e1c' }, // 入夜：回到近黑
  { p: 1.00, c: '#0a0e1c' }  // 深夜（循环）
];

/**
 * 天气对天空的染色：云/雨/雪/沙暴/雾让天空偏离「纯蓝天」
 * @returns rgb 字符串（已混入天气色）
 */
function weatherTint(baseColor, weatherType) {
  const presets = {
    clear:     null,
    cloudy:    { c: '#4a4f5a', k: 0.40 }, // 灰化、降饱和
    rain:      { c: '#222a33', k: 0.50 }, // 压暗、阴沉
    snow:      { c: '#9aa6b4', k: 0.35 }, // 提亮、冷白
    sandstorm: { c: '#8a7048', k: 0.45 }, // 沙尘昏黄
    fog:       { c: '#6b7280', k: 0.50 }  // 灰白、低对比
  };
  const p = presets[weatherType];
  if (!p) return baseColor;
  return lerpColor(baseColor, p.c, p.k);
}

/**
 * 获取全局天空颜色（仅与昼夜+天气相关，与场景无关）
 * @param {number} progress 0=深夜 → 0.25=黎明 → 0.5=正午 → 0.75=黄昏 → 1.0=深夜
 * @param {string} weatherType clear/cloudy/rain/snow/sandstorm/fog
 */
function getSkyColorAtTime(progress, weatherType) {
  const pp = ((progress % 1) + 1) % 1;
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    const a = SKY_KEYFRAMES[i], b = SKY_KEYFRAMES[i + 1];
    if (pp >= a.p && pp <= b.p) {
      const f = (b.p === a.p) ? 0 : (pp - a.p) / (b.p - a.p);
      const base = lerpColor(a.c, b.c, f);
      return weatherTint(base, weatherType);
    }
  }
  return weatherTint(SKY_KEYFRAMES[0].c, weatherType);
}

/** 天空底部颜色（与顶部一致；地平线暖色由大气辉光另叠） */
function getSkyBottomColor(progress, weatherType) {
  return getSkyColorAtTime(progress, weatherType);
}

function lerpRGB(c1, c2, t) {
  const a = hexToRGB(c1), b = hexToRGB(c2);
  return `rgb(${Math.round(a.r+(b.r-a.r)*t)},${Math.round(a.g+(b.g-a.g)*t)},${Math.round(a.b+(b.b-a.b)*t)})`;
}

function hexToRGB(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substr(0, 2), 16),
    g: parseInt(hex.substr(2, 2), 16),
    b: parseInt(hex.substr(4, 2), 16)
  };
}

function hexToRGBStr(hex) {
  const rgb = hexToRGB(hex);
  return `${rgb.r},${rgb.g},${rgb.b}`;
}

/**
 * ===== 13个场景定义（按骑行循环顺序）=====
 * 配色灵感来自「息壤」App的治愈系暗调风格
 */
const SCENES = [
  // ──── 1. 戈壁 ────
  {
    id: 'gobi',
    name: '戈壁',
    dwellCycles: 2.4,  // ≈2.4个昼夜(720s)：戈壁苍茫漫长
    sky: sky(
      '#1a1a2e',   // 黎明：极深的墨蓝
      '#3d3a4d',   // 早晨：灰紫调
      '#8e9aaf',   // 中午：灰蓝白
      '#7c899f',   // 下午：冷灰蓝
      '#c17f59',   // 黄昏：暖赭橙
      '#12101d'    // 深夜：近黑墨色
    ),
    groundTop: '#2a2520',
    groundBottom: '#141210',
    mountains: [
      { color: '#2e2a28', amplitude: 50, freq: 0.003, yBase: 0.62 },   // 最远层
      { color: '#242220', amplitude: 35, freq: 0.005, yBase: 0.66 },   // 中层
      { color: '#181816', amplitude: 22, freq: 0.008, yBase: 0.70 }    // 最近层
    ],
    terrainStyle: 'rocky',
    weatherWeights: { clear: 45, cloudy: 15, sandstorm: 35, fog: 5 },
    description: '苍茫戈壁，乱石嶙峋'
  },

  // ──── 2. 沙漠 ────
  {
    id: 'desert',
    name: '沙漠',
    dwellCycles: 3.0,  // ≈3个昼夜(900s)：最广阔
    sky: sky(
      '#1e1e2f',   // 黎明
      '#c4845c',   // 早晨：沙漠金橙
      '#f0d9b5',   // 中午：亮暖沙色
      '#e8c49a',   // 下午
      '#d4744a',   // 黄昏：烈日余晖
      '#101018'    // 深夜
    ),
    groundTop: '#b8956a',
    groundBottom: '#5a4028',
    mountains: [
      { color: '#a67c52', amplitude: 55, freq: 0.002, yBase: 0.60 },
      { color: '#8a6540', amplitude: 38, freq: 0.004, yBase: 0.65 },
      { color: '#4a3520', amplitude: 20, freq: 0.007, yBase: 0.70 }
    ],
    terrainStyle: 'dunes',
    weatherWeights: { clear: 35, cloudy: 10, sandstorm: 50, fog: 5 },
    description: '金色沙丘连绵起伏'
  },

  // ──── 3. 绿洲 ────
  {
    id: 'oasis',
    name: '绿洲',
    dwellCycles: 1.0,  // ≈1个昼夜(300s)
    sky: sky(
      '#142228',   // 黎明：深青绿
      '#2d6b5a',   // 早晨：翡翠绿调
      '#7ab8a0',   // 中午：薄荷绿
      '#5fa388',   // 下午
      '#c47a5a',   // 黄昏：暖棕橙
      '#0c1618'    // 深夜
    ),
    groundTop: '#1a5c3a',
    groundBottom: '#0a2818',
    mountains: [
      { color: '#1a6b44', amplitude: 40, freq: 0.003, yBase: 0.63 },
      { color: '#145232', amplitude: 30, freq: 0.005, yBase: 0.67 },
      { color: '#0a2818', amplitude: 18, freq: 0.009, yBase: 0.71 }
    ],
    terrainStyle: 'vegetation',
    weatherWeights: { clear: 55, cloudy: 20, rain: 15, fog: 10 },
    description: '棕榈树与清澈水池'
  },

  // ──── 4. 海岸 ────
  {
    id: 'coast',
    name: '海岸',
    dwellCycles: 1.6,  // ≈1.6个昼夜(480s)
    sky: sky(
      '#0d1b2a',   // 黎明：深海蓝黑
      '#295c8a',   // 早晨：海蓝色
      '#7eb5d6',   // 中午：明亮天蓝
      '#4a90b8',   // 下午
      '#d4694a',   // 黄昏：夕阳红橙
      '#080f18'    // 深夜：极深海蓝
    ),
    groundTop: '#1a3a52',
    groundBottom: '#0a1824',
    mountains: [
      { color: '#1a4a68', amplitude: 25, freq: 0.004, yBase: 0.64 },   // 远处海平线
      { color: '#14354d', amplitude: 18, freq: 0.007, yBase: 0.68 },   // 近处海岸线
      { color: '#0a1824', amplitude: 12, freq: 0.010, yBase: 0.72 }    // 前景礁石
    ],
    terrainStyle: 'coastline',
    weatherWeights: { clear: 25, cloudy: 30, rain: 25, fog: 20 },
    description: '海浪拍打礁石'
  },

  // ──── 5. 城市 ────
  {
    id: 'city',
    name: '城市',
    dwellCycles: 0.6,  // ≈0.6个昼夜(180s)：城市快过
    sky: sky(
      '#151520',   // 黎明
      '#4a4a5c',   // 早晨：城市灰蓝
      '#9aa0ac',   // 中午：阴天灰
      '#888c96',   // 下午
      '#c76a42',   // 黄昏
      '#0e0e16'    // 深夜
    ),
    groundTop: '#2a2a34',
    groundBottom: '#14141a',
    buildings: true,        // 城市有建筑剪影
    windowLights: true,     // 窗户灯光
    mountains: [
      { color: '#333340', amplitude: 80, freq: 0.001, yBase: 0.55 },   // 城市天际线（高）
      { color: '#282832', amplitude: 50, freq: 0.002, yBase: 0.64 },   // 中层建筑
      { color: '#18181e', amplitude: 25, freq: 0.004, yBase: 0.70 }    // 前景轮廓
    ],
    terrainStyle: 'buildings',
    weatherWeights: { clear: 15, cloudy: 35, rain: 35, fog: 15 },
    description: '远处的城市天际线'
  },

  // ──── 6. 郊外 ────
  {
    id: 'suburb',
    name: '郊外',
    dwellCycles: 1.4,  // ≈1.4个昼夜(420s)
    sky: sky(
      '#131e2a',   // 黎明
      '#3d7090',   // 早晨
      '#8ec5e0',   // 中午：晴朗天蓝
      '#60a8cc',   // 下午
      '#d0784e',   // 黄昏
      '#0c1218'    // 深夜
    ),
    groundTop: '#1a5035',
    groundBottom: '#0a280f',
    mountains: [
      { color: '#2a6848', amplitude: 45, freq: 0.0025, yBase: 0.62 },
      { color: '#1e4a32', amplitude: 30, freq: 0.0045, yBase: 0.67 },
      { color: '#102818', amplitude: 18, freq: 0.008, yBase: 0.71 }
    ],
    terrainStyle: 'hills_gentle',
    weatherWeights: { clear: 35, cloudy: 30, rain: 25, fog: 10 },
    description: '乡间小路蜿蜒'
  },

  // ──── 7. 村庄 ────
  {
    id: 'village',
    name: '村庄',
    dwellCycles: 1.0,  // ≈1个昼夜(300s)
    sky: sky(
      '#171520',   // 黎明
      '#b08050',   // 早晨：暖村色
      '#e8d0a8',   // 中午：柔和暖黄
      '#d4b88a',   // 下午
      '#c06838',   // 黄昏：炊烟橙
      '#0e140f'    // 深夜
    ),
    groundTop: '#4a4030',
    groundBottom: '#1a180f',
    windowLights: true,
    mountains: [
      { color: '#5a5848', amplitude: 35, freq: 0.003, yBase: 0.64 },
      { color: '#3e3c30', amplitude: 25, freq: 0.005, yBase: 0.68 },
      { color: '#201e16', amplitude: 14, freq: 0.009, yBase: 0.72 }
    ],
    terrainStyle: 'cottages',
    weatherWeights: { clear: 40, cloudy: 30, rain: 15, fog: 15 },
    description: '炊烟袅袅的小村落'
  },

  // ──── 8. 农田 ────
  {
    id: 'farmland',
    name: '农田',
    dwellCycles: 1.4,  // ≈1.4个昼夜(420s)
    sky: sky(
      '#12201a',   // 黎明
      '#4a8860',   // 早晨：嫩绿
      '#98d4a8',   // 中午：鲜绿
      '#68bc82',   // 下午
      '#d08a50',   // 黄昏：麦田金黄
    '#0a140f'    // 深夜
    ),
    groundTop: '#3a7848',
    groundBottom: '#183820',
    mountains: [
      { color: '#4a985a', amplitude: 20, freq: 0.004, yBase: 0.65 },
      { color: '#327840', amplitude: 15, freq: 0.007, yBase: 0.69 },
      { color: '#183820', amplitude: 10, freq: 0.011, yBase: 0.73 }
    ],
    terrainStyle: 'fields',
    weatherWeights: { clear: 30, cloudy: 30, rain: 30, fog: 10 },
    description: '金黄麦田或绿油油的庄稼'
  },

  // ──── 9. 山区 ────
  {
    id: 'mountains',
    name: '山区',
    dwellCycles: 2.5,  // ≈2.5个昼夜(750s)：群峰长旅
    sky: sky(
      '#14101e',   // 黎明：深靛紫
      '#3d3a5c',   // 早晨：山间紫雾
      '#78809a',   // 中午：高山灰蓝
      '#606888',   // 下午
      '#b85a38',   // 黄昏：山巅残阳
      '#0c0a14'    // 深夜
    ),
    groundTop: '#2a2a30',
    groundBottom: '#141418',
    mountains: [
      { color: '#3a3a48', amplitude: 90, freq: 0.0015, yBase: 0.50 },  // 巍峨主峰
      { color: '#2e2e38', amplitude: 55, freq: 0.003, yBase: 0.62 },   // 中层山脉
      { color: '#1a1a22', amplitude: 30, freq: 0.005, yBase: 0.70 }    // 前景山丘
    ],
    terrainStyle: 'peaks',
    weatherWeights: { clear: 20, cloudy: 30, rain: 20, snow: 20, fog: 10 },
    description: '巍峨群峰'
  },

  // ──── 10. 平原 ────
  {
    id: 'plains',
    name: '平原',
    dwellCycles: 1.8,  // ≈1.8个昼夜(540s)
    sky: sky(
      '#111a24',   // 黎明
      '#4088a0',   // 早晨
      '#90d0dc',   // 中午：清澈水蓝
      '#60bcd0',   // 下午
      '#d08050',   // 黄昏
    '#0a1018'    // 深夜
    ),
    groundTop: '#288048',
    groundBottom: '#103818',
    mountains: [
      { color: '#38a058', amplitude: 12, freq: 0.005, yBase: 0.68 },
      { color: '#287038', amplitude: 8, freq: 0.008, yBase: 0.71 },
      { color: '#103818', amplitude: 5, freq: 0.012, yBase: 0.74 }   // 极平坦
    ],
    terrainStyle: 'flat_grass',
    weatherWeights: { clear: 35, cloudy: 30, rain: 25, fog: 10 },
    description: '一望无际的大平原'
  },

  // ──── 11. 草原 ────
  {
    id: 'grassland',
    name: '草原',
    dwellCycles: 2.0,  // ≈2个昼夜(600s)
    sky: sky(
      '#161820',   // 黎明
      '#c09050',   // 早晨：草原金
      '#f0ddb0',   // 中午：阳光草原
      '#e0c890',   // 下午
      '#d07040',   // 黄昏：落日草原
    '#0e100f'    // 深夜
    ),
    groundTop: '#388040',
    groundBottom: '#183818',
    mountains: [
      { color: '#48a050', amplitude: 25, freq: 0.003, yBase: 0.65 },
      { color: '#308030', amplitude: 18, freq: 0.006, yBase: 0.69 },
      { color: '#183818', amplitude: 10, freq: 0.010, yBase: 0.73 }
    ],
    terrainStyle: 'grass_waves',
    weatherWeights: { clear: 45, cloudy: 25, rain: 15, fog: 15 },
    description: '风吹草低见牛羊'
  },

  // ──── 12. 冰原 ────
  {
    id: 'tundra',
    name: '冰原',
    dwellCycles: 2.2,  // ≈2.2个昼夜(660s)：极地广袤
    sky: sky(
      '#1a1e28',   // 黎明：冷钢蓝
      '#7090a8',   // 早晨：冰蓝
      '#d0e0f0',   // 中午：冰雪白
      '#a0c0d8',   // 下午
      '#90a0c0',   // 黄昏：冰晶蓝
    '#10141c'    // 深夜
    ),
    groundTop: '#c8d8e8',
    groundBottom: '#687888',
    mountains: [
      { color: '#b0c8e0', amplitude: 50, freq: 0.0025, yBase: 0.58 },
      { color: '#90a8c0', amplitude: 35, freq: 0.004, yBase: 0.65 },
      { color: '#607088', amplitude: 20, freq: 0.007, yBase: 0.71 }
    ],
    terrainStyle: 'snow_fields',
    weatherWeights: { clear: 25, cloudy: 20, snow: 45, fog: 10 },
    description: '白雪皑皑的极地'
  },

  // ──── 13. 城堡 ────
  {
    id: 'castle',
    name: '城堡',
    dwellCycles: 1.0,  // ≈1个昼夜(300s)
    sky: sky(
      '#18141e',   // 黎明：神秘暗紫
      '#a07850',   // 早晨：古堡金
      '#d8c8a0',   // 中午：古典暖色
      '#c0a878',   // 下午
      '#a03828',   // 黄昏：血色残阳
    '#0e0c14'    // 深夜
    ),
    groundTop: '#3a3028',
    groundBottom: '#1a1814',
    windowLights: true,
    mountains: [
      { color: '#5a5048', amplitude: 60, freq: 0.0018, yBase: 0.56 },  // 城堡塔楼剪影
      { color: '#3e3830', amplitude: 38, freq: 0.003, yBase: 0.65 },
      { color: '#201e18', amplitude: 22, freq: 0.0055, yBase: 0.71 }
    ],
    terrainStyle: 'castle_ruins',
    weatherWeights: { clear: 35, cloudy: 30, rain: 15, fog: 20 },
    description: '古老的城堡遗迹'
  }
];

