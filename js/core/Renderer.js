/**
 * Renderer.js - 分层渲染器
 * 负责按层级顺序（后景→中景→前景）渲染所有元素
 * 支持视差滚动
 */
class Renderer {
  constructor() {
    this.width = 0;
    this.height = 0;

    // 滚动偏移量（世界坐标）
    this.scrollX = 0;
    this.scrollSpeed = 30; // 像素/秒

    // 各层注册的渲染函数列表
    this.layers = {
      background: [],   // 后景：天空、日月星辰、远山
      midground: [],    // 中景：云、鸟、粒子
      foreground: []    // 前景：牛仔、路面、近物
    };

    // 视差速度倍率（值越小滚得越慢）
    this.parallaxFactors = {
      background: 0.15,
      midground: 0.4,
      foreground: 1.0
    };
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  /** 注册渲染器到指定层 */
  register(layer, renderFn) {
    if (this.layers[layer]) {
      this.layers[layer].push(renderFn);
    }
  }

  /** 移除渲染器 */
  unregister(layer, renderFn) {
    if (this.layers[layer]) {
      const idx = this.layers[layer].indexOf(renderFn);
      if (idx >= 0) this.layers[layer].splice(idx, 1);
    }
  }

  /** 更新滚动 */
  updateScroll(dt) {
    this.scrollX += this.scrollSpeed * dt;
  }

  /** 获取某层的视差偏移量 */
  getParallaxX(layer) {
    return this.scrollX * (this.parallaxFactors[layer] || 1);
  }

  /** 主渲染方法 - 由Engine每帧调用 */
  render(ctx, context) {
    const { width, height } = this;

    // 更新滚动
    this.updateScroll(context.dt || 0.016);

    // 每层独立 try-catch：一层崩溃不影响其他层
    try { this.renderLayer(ctx, 'background', context); } catch(e) {
      console.warn('[Renderer] background layer error:', e.message);
    }
    try { this.renderLayer(ctx, 'midground', context); } catch(e) {
      console.warn('[Renderer] midground layer error:', e.message);
    }
    try { this.renderLayer(ctx, 'foreground', context); } catch(e) {
      console.warn('[Renderer] foreground layer error:', e.message);
    }
  }

  renderLayer(ctx, layerName, context) {
    const px = this.getParallaxX(layerName);

    for (const fn of this.layers[layerName]) {
      // 每个注册函数也单独保护
      try {
        fn(ctx, {
          ...context,
          scrollX: px,
          width: this.width,
          height: this.height
        });
      } catch(e) {
        console.warn(`[Renderer] ${layerName} fn error:`, e.message);
      }
    }
  }

  /** 设置滚动速度 */
  setSpeed(pixelsPerSec) {
    this.scrollSpeed = pixelsPerSec;
  }
}
