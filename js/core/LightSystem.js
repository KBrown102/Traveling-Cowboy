/**
 * LightSystem.js - 光照系统
 * 管理鼠标光圈、发光物体、光线投射等所有光效
 */
class LightSystem {
  constructor() {
    this.mouseX = -1000;
    this.mouseY = -1000;
    this.mouseRadius = 180;      // 鼠标光圈半径
    this.mouseIntensity = 0.35;  // 鼠标光圈强度
    this.mouseEnabled = true;

    // 发光物体列表 {x, y, radius, color, intensity, type}
    this.lights = [];

    // 预计算的鼠标光圈渐变（避免每帧重建）
    this._mouseGradCache = null;
    this._cacheKey = '';
  }

  /** 更新鼠标位置（由Engine绑定mousemove事件） */
  setMousePosition(x, y) {
    this.mouseX = x;
    this.mouseY = y;
    this._mouseGradCache = null; // 清除缓存
  }

  /** 添加一个发光物体 */
  addLight(x, y, radius, color, intensity = 1, type = 'generic') {
    this.lights.push({ x, y, radius, color, intensity, type });
  }

  /** 清空发光物体列表 */
  clearLights() {
    this.lights.length = 0;
  }

  update(dt) {
    // 发光物体的动态更新可以在这里做
    // （比如闪烁效果等）
  }

  /**
   * 渲染光照层（在主渲染完成后叠加）
   * 使用 globalCompositeOperation = 'screen' 或 'soft-light' 实现发光
   */
  render(ctx, width, height) {
    ctx.save();

    // ===== 1. 鼠标光圈 =====
    if (this.mouseEnabled && this.mouseX > 0 && this.mouseY > 0) {
      this.renderMouseGlow(ctx);
    }

    // ===== 2. 发光物体的光晕 =====
    for (const light of this.lights) {
      this.renderLightGlow(ctx, light);
    }

    ctx.restore();
  }

  /** 绘制鼠标周围的柔和光圈 */
  renderMouseGlow(ctx) {
    const { x, y } = this;
    if (!isFinite(x) || !isFinite(y)) return;
    const r = this.mouseRadius;
    if (!isFinite(r) || r <= 0) return;

    // 多层叠加实现柔和的边缘衰减
    const layers = [
      { radius: r * 1.8, alpha: 0.03 },
      { radius: r * 1.3, alpha: 0.06 },
      { radius: r * 0.9, alpha: 0.10 },
      { radius: r * 0.5, alpha: 0.15 }
    ];

    for (const layer of layers) {
      if (!isFinite(layer.radius)) continue;
      const grad = safeRadialGrad(ctx, x, y, 0, x, y, layer.radius);
      if (!grad) continue;
      grad.addColorStop(0, `rgba(255,250,240,${layer.alpha})`);
      grad.addColorStop(0.5, `rgba(255,245,230,${layer.alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(255,245,220,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, layer.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 中心最亮点
    const coreR = Math.max(1, r * 0.2);
    const core = safeRadialGrad(ctx, x, y, 0, x, y, coreR);
    if (core) {
      core.addColorStop(0, 'rgba(255,255,255,0.12)');
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, coreR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 绘制单个发光物体的光晕 */
  renderLightGlow(ctx, light) {
    const { x, y, radius, color, intensity } = light;
    if (!isFinite(x)||!isFinite(y)||!isFinite(radius)) return;

    // 解析颜色
    const rgb = this.parseColor(color);

    // 外层大范围光晕
    const outerR = Math.max(1, radius * 4);
    const outer = safeRadialGrad(ctx, x, y, 0, x, y, outerR);
    if (outer) {
      outer.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.25 * intensity})`);
      outer.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.08 * intensity})`);
      outer.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, outerR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 内层核心光晕
    const innerR = Math.max(1, radius * 1.2);
    const inner = safeRadialGrad(ctx, x, y, 0, x, y, innerR);
    if (inner) {
      inner.addColorStop(0, `rgba(255,255,255,${0.6 * intensity})`);
      inner.addColorStop(0.3, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.4 * intensity})`);
      inner.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(x, y, innerR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 绘制光线投射效果（如灯塔光束）
   * @param {Object} opts {originX, originY, angle, length, spread, color, intensity}
   */
  renderLightBeam(ctx, opts) {
    const { ox, oy, angle, length, spread, color, intensity } = opts;
    if (!isFinite(ox)||!isFinite(oy)||!isFinite(length)) return;
    const halfSpread = spread / 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(angle);

    const rgb = this.parseColor(color);

    // 锥形光束
    const beam = safeLinearGrad(ctx, 0, 0, Math.max(1,length), 0);
    if (!beam) { ctx.restore(); return; }
    beam.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.35 * intensity})`);
    beam.addColorStop(0.3, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.12 * intensity})`);
    beam.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, -Math.tan(halfSpread) * length);
    ctx.lineTo(length, Math.tan(halfSpread) * length);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * 绘制太阳放射状光线（从中心向四周发散）
   * @param {number} cx 太阳中心x
   * @param {number} cy 太阳中心y
   * @param {number} rayCount 光线数量
   * @param {number} maxLen 最大长度
   * @param {string} color 光线颜色
   * @param {number} intensity 强度
   */
  renderSunRays(ctx, cx, cy, rayCount, maxLen, color, intensity) {
    if (!isFinite(cx)||!isFinite(cy)||!isFinite(maxLen)) return;
    const rgb = this.parseColor(color);
    const now = performance.now() / 1000;

    for (let i = 0; i < rayCount; i++) {
      const baseAngle = (i / rayCount) * Math.PI * 2;
      // 微微摆动
      const wobble = Math.sin(now * 0.5 + i * 1.7) * 0.02;
      const angle = baseAngle + wobble;

      // 每条光线长度不同
      const lenVar = 0.6 + ((i * 137.508) % 100) / 100 * 0.7;
      const len = maxLen * lenVar;

      // 宽度也变化
      const width = 1 + ((i * 73) % 100) / 100 * 2;

      const ex = cx + Math.cos(angle) * len;
      const ey = cy + Math.sin(angle) * len;

      const rayGrad = safeLinearGrad(ctx, cx, cy, ex, ey);
      if (!rayGrad) continue;
      rayGrad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.4 * intensity})`);
      rayGrad.addColorStop(0.3, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.12 * intensity})`);
      rayGrad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

      ctx.strokeStyle = rayGrad;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  parseColor(color) {
    color = String(color || '');
    // 处理 rgb(r,g,b) 格式（lerpColor 输出）
    const m = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      return { r: +m[1]||0, g: +m[2]||0, b: +m[3]||0 };
    }
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      return {
        r: parseInt(hex.substr(0, 2), 16)||0,
        g: parseInt(hex.substr(2, 2), 16)||0,
        b: parseInt(hex.substr(4, 2), 16)||0
      };
    }
    return { r: 255, g: 255, b: 255 };
  }

  /** 绑定到canvas元素 */
  bindToCanvas(canvas) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.setMousePosition(e.clientX - rect.left, e.clientY - rect.top);
    });
    canvas.addEventListener('mouseleave', () => {
      this.setMousePosition(-1000, -1000);
    });
  }
}
