/**
 * WeatherSystem.js - 天气系统 v2（空间天气区 · 从画面里走过来）
 *
 * 设计原则（用户明确要求的「基础规则」）：
 *   - 天气不是「整页切换」的状态机，而是沿世界坐标分布的「天气区」。
 *     每个区在屏幕右侧外生成，人物（相机）随 renderer.scrollX 走入该区，
 *     走出右侧边缘即离开——和场景一样，是从画面里"走过来"的。
 *   - 天气类型由「当前场景」的 weatherWeights 加权决定（沙漠几乎无雨、海岸多雨雾、
 *     冰原多雪、戈壁多沙暴），实现与场景的联动。
 *   - 天气与昼夜联动：云遮日月 → 日月变暗变模糊（见 SkyRenderer 的 obscuration）；
 *     阴晴程度（overcast）越高，日月越模糊、整体光照越暗。
 *   - 云/雨/雪/沙暴/雾的具体绘制在 WeatherRenderer.js，本文件只负责「天气区调度 +
 *     当前天气状态 + 播种字段」。
 *
 * 经典脚本模式：class 挂全局，main.js 中 new WeatherSystem()。
 */

// 平滑插值（用于天气区边界过渡，避免突变）
function weatherSmoothstep(a, b, x) {
  if (a === b) return x < a ? 0 : 1;
  let t = (x - a) / (b - a);
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// 各类天气单区持续秒数（世界速度 80px/s 下，1屏≈16s）
const WEATHER_ZONE_SECONDS = {
  clear:      [26, 46],   // 晴天：漫长开阔
  cloudy:     [20, 34],
  rain:       [13, 22],
  snow:       [16, 26],
  fog:        [16, 26],
  sandstorm:  [9, 16]      // 沙暴：短促猛烈
};

// 各类天气的基础特征（会被随机强度微调）
const WEATHER_PROFILE = {
  clear:     { overcast: [0.04, 0.14], cloudiness: [0.10, 0.22], wind: [5, 11],  precip: false },
  cloudy:    { overcast: [0.35, 0.62], cloudiness: [0.45, 0.80], wind: [10, 22], precip: false },
  rain:      { overcast: [0.55, 0.82], cloudiness: [0.65, 0.90], wind: [18, 38], precip: true },
  snow:      { overcast: [0.50, 0.78], cloudiness: [0.55, 0.82], wind: [10, 24], precip: true },
  fog:       { overcast: [0.66, 0.86], cloudiness: [0.45, 0.68], wind: [3, 9],   precip: true },
  sandstorm: { overcast: [0.55, 0.82], cloudiness: [0.40, 0.66], wind: [55, 120],precip: true }
};

class WeatherSystem {
  constructor() {
    this.zones = [];            // 天气区数组（沿世界坐标连续排列）
    this.genX = 0;              // 下一个待生成区的起始世界 X
    this.worldScroll = 0;       // 当前相机世界 X（= renderer.scrollX，前景 parallax=1）
    this.worldSpeed = 80;       // 世界滚动速度（与 renderer.scrollSpeed 同步）
    this.width = 1280;
    this.height = 720;

    // 当前天气状态（每帧由 update 计算，供渲染层读取）
    this.current = {
      type: 'clear',
      intensity: 0.4,
      cloudiness: 0.15,
      overcast: 0.08,
      windSpeed: 8,
      precipIntensity: 0,
      brightness: 1,
      celestialVisible: true
    };
  }

  /** 由 main.js 在 renderer.setSpeed 后同步世界速度 */
  setWorldSpeed(v) { this.worldSpeed = v; }

  setViewport(w, h) { this.width = w; this.height = h; }

  // ══════════════════════════════════════
  // 每帧更新：推进相机、生成/裁剪天气区、计算当前天气
  // ══════════════════════════════════════
  update(dt, worldScroll, scene, width, height, timeData) {
    if (width) this.width = width;
    if (height) this.height = height;
    this.worldScroll = worldScroll || 0;

    // 懒初始化云/粒子字段
    if (typeof initWeatherField === 'function') initWeatherField(this.width, this.height);

    // 1. 在相机前方（右侧 2 屏）生成天气区
    const aheadTarget = this.worldScroll + this.width * 2.0;
    let guard = 0;
    while (this.genX < aheadTarget && guard++ < 50) {
      this._generateZone(scene);
    }

    // 2. 裁剪相机后方已离开的区
    while (this.zones.length > 2 && this.zones[0].endX < this.worldScroll - this.width) {
      this.zones.shift();
    }

    // 3. 计算人物当前所在天气区（牛仔在屏幕 22% 处）
    const cowboyX = this.worldScroll + this.width * 0.22;
    const idx = this._zoneIndexAt(cowboyX);
    const zone = this.zones[idx] || this.zones[this.zones.length - 1];
    const prevZone = this.zones[idx - 1] || zone;

    if (zone) {
      const span = Math.max(1, zone.endX - zone.startX);
      const into = (cowboyX - zone.startX) / span;          // 0..1 进入深度
      // ★ 边界混合区从 10% 扩大到 22%，过渡更柔和
      const boundaryFade = Math.min(
        weatherSmoothstep(0, 0.22, into),
        weatherSmoothstep(0, 0.22, 1 - into)
      );

      // 与上一区在边界处交叉淡变，避免日月明暗硬跳
      const prof = zone.profile;
      const pProf = prevZone.profile;
      const overcast  = lerp(prof.overcast,  pProf.overcast,  1 - boundaryFade);
      const cloudiness= lerp(prof.cloudiness, pProf.cloudiness,1 - boundaryFade);
      const windSpeed = lerp(prof.windSpeed,  pProf.windSpeed, 1 - boundaryFade);
      const intensity = lerp(zone.intensity,  prevZone.intensity, 1 - boundaryFade);

      const precipBase = prof.precip ? intensity : 0;
      const precipIntensity = precipBase * boundaryFade;

      // ★ 时间平滑：current 值逐帧 lerp 靠近目标值（消除跳变）
      const smoothK = Math.min(1, dt * 2.5);  // 每帧追赶 ~2.5 倍 dt 的差距
      this.current.type = zone.type;           // 类型可以突变
      this._smooth('intensity',   intensity,   smoothK);
      this._smooth('cloudiness',  cloudiness,  smoothK);
      this._smooth('overcast',    overcast,    smoothK);
      this._smooth('windSpeed',   windSpeed,   smoothK);
      this._smooth('precipIntensity', precipIntensity, smoothK);
      this.current.brightness = Math.max(0.50, 1 - this.current.overcast * 0.42);
      // ★ 不再用 overcast 硬阈值切断日月（那会导致阴晴切换时太阳「啪」地消失）。
      //   日月始终可见，其亮度由 SkyRenderer 按 overcast 连续衰减 + 中层阴晴幕遮挡；
      //   仅沙暴时才整体隐藏日月（沙幕本就铺满屏幕）。
      this.current.celestialVisible = zone.type !== 'sandstorm';
    }

    // 4. 推进各子模块（云 / 雨 / 雪 / 沙暴 / 雾 / 飞鸟）
    if (typeof updateCloudField === 'function')   updateCloudField(dt, this);
    const type = this.current.type, pi = this.current.precipIntensity;
    if (typeof updateRainField === 'function')     updateRainField(dt, this, type, pi);
    if (typeof updateSnowField === 'function')     updateSnowField(dt, this, type, pi);
    if (typeof updateSandField === 'function')     updateSandField(dt, this, type, pi);
    if (typeof updateFogField === 'function')      updateFogField(dt, this, type, pi);
    // 飞鸟：深夜判定用 timeData，恶劣天气/重阴判定用 current（birdVisible 已含）
    if (typeof updateBirdField === 'function')     updateBirdField(dt, this, timeData, scene);
  }

  // ══════════════════════════════════════
  // 天气区生成
  // ══════════════════════════════════════
  _generateZone(scene) {
    const type = this._pickType(scene);
    const prof = WEATHER_PROFILE[type];

    const [dmin, dmax] = WEATHER_ZONE_SECONDS[type];
    const dur = dmin + Math.random() * (dmax - dmin);
    const worldWidth = dur * this.worldSpeed;

    const intensity = 0.4 + Math.random() * 0.5;
    const overcast   = prof.overcast[0]   + Math.random() * (prof.overcast[1]   - prof.overcast[0]);
    const cloudiness = prof.cloudiness[0] + Math.random() * (prof.cloudiness[1] - prof.cloudiness[0]);
    const windSpeed  = prof.wind[0]       + Math.random() * (prof.wind[1]       - prof.wind[0]);

    const startX = this.genX;
    const endX = startX + worldWidth;
    this.genX = endX;

    this.zones.push({
      type, intensity, startX, endX,
      profile: { overcast, cloudiness, windSpeed, precip: prof.precip }
    });
  }

  /** 按当前场景的 weatherWeights 加权挑选天气类型 */
  _pickType(scene) {
    const weights = (scene && scene.weatherWeights) || { clear: 55, cloudy: 30, rain: 10, snow: 2, sandstorm: 2, fog: 1 };
    let total = 0;
    for (const k in weights) total += (weights[k] || 0);
    let r = Math.random() * total;
    for (const k in weights) {
      r -= (weights[k] || 0);
      if (r <= 0) return k;
    }
    return 'clear';
  }

  /**
   * 时间平滑插值：让 current[key] 逐步靠近 target，避免跳变
   * @param {string} key - this.current 的属性名
   * @param {number} target - 目标值
   * @param {number} k - 追赶系数（0~1，越大越快）
   */
  _smooth(key, target, k) {
    const cur = this.current[key];
    const diff = target - cur;
    if (Math.abs(diff) < 0.005) {
      this.current[key] = target;  // 足够接近就贴合
    } else {
      this.current[key] = cur + diff * k;
    }
  }

  _zoneIndexAt(x) {
    for (let i = 0; i < this.zones.length; i++) {
      if (x >= this.zones[i].startX && x < this.zones[i].endX) return i;
    }
    if (this.zones.length === 0) return -1;
    return x < this.zones[0].startX ? 0 : this.zones.length - 1;
  }

  /** 取某世界 X 处的云量（供云渲染做"成片云团/零星云"分布） */
  cloudinessAt(x) {
    const i = this._zoneIndexAt(x);
    if (i < 0) return 0.12;
    return this.zones[i].profile.cloudiness;
  }

  // ══════════════════════════════════════
  // 对外状态（Engine 每帧取此塞入渲染上下文）
  // ══════════════════════════════════════
  getState() {
    const c = this.current;
    return {
      type: c.type,
      intensity: c.intensity,
      cloudiness: c.cloudiness,
      overcast: c.overcast,
      windSpeed: c.windSpeed,
      precipIntensity: c.precipIntensity,
      brightness: c.brightness,
      celestialVisible: c.celestialVisible,
      isSevere: this.isSevere(),
      birdVisible: this.birdVisible()
    };
  }

  isSevere() { return ['rain', 'snow', 'sandstorm'].includes(this.current.type); }

  /** 飞鸟是否可见（恶劣天气 + 重阴 + 深夜隐藏；深夜判定交给鸟类系统） */
  birdVisible() { return !this.isSevere() && this.current.overcast < 0.75; }
}

// 线性插值（不依赖 ColorUtils，避免循环依赖问题）
function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
