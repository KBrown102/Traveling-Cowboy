/**
 * WeatherRenderer.js - 天气渲染调度层（v2 模块化）
 *
 * 本文件不再包含任何具体绘制逻辑，只负责：
 *   1. 根据天气类型分发到各子模块
 *   2. 提供 renderClouds / renderPrecipitation 两个入口
 *      （供 main.js 注册到 midground / foreground 层）
 *
 * 子模块（各自独立文件）：
 *   - js/weather/clouds/CloudRenderer.js     → 云层（积云/卷云/层云）+ sampleObscuration()
 *   - js/weather/precipitation/RainRenderer.js   → 雨
 *   - js/weather/precipitation/SnowRenderer.js   → 雪
 *   - js/weather/precipitation/SandstormRenderer.js → 沙暴
 *   - js/weather/precipitation/FogRenderer.js    → 雾
 *
 * 经典脚本模式：顶层函数挂全局。
 */

// ══════════════════════════════════════
// 向后兼容：保留旧的 initWeatherField/updateWeatherField 空壳
// （防止其他代码调用时报 ReferenceError）
// ══════════════════════════════════════
function initWeatherField(w, h) {
  // 委托给各子模块初始化
  if (typeof initCloudField === 'function')   initCloudField(w, h);
  if (typeof initRainField === 'function')    initRainField(w, h);
  if (typeof initSnowField === 'function')    initSnowField(w, h);
  if (typeof initSandField === 'function')    initSandField(w, h);
  if (typeof initFogField === 'function')     initFogField(w, h);
}

function updateWeatherField(dt, wx) {
  // 委托给 WeatherSystem 的 update 方法统一调度
  // （这个函数保留仅为兼容，实际由 WeatherSystem.update 内部直接调用各子模块）
}

// ══════════════════════════════════════
// 渲染入口：云层（midground 层，在日月之上）
// ══════════════════════════════════════
/**
 * 渲染云层 → 直接委托给 CloudRenderer.renderClouds
 */
function renderClouds(ctx, wx, c) {
  if (typeof renderClouds !== 'function' || typeof _cloudField === 'undefined') return;
  // 调用 CloudRenderer 的 renderClouds（同名函数，但作用域是全局的）
  // 由于经典脚本的函数覆盖机制，这里的 renderClouds 实际指向的是
  // CloudRenderer.js 中定义的同名函数（因为后加载会覆盖先加载的）
  // 所以我们需要用不同的方式来调用...
  // ★ 解决方案：CloudRenderer 定义的就是全局 renderClouds，
  //   这里直接调用即可——但需要避免递归！
  //   实际上由于本文件先于 CloudRenderer 加载，CloudRenderer 会覆盖此函数。
  //   因此这个"调度层"实际上会被完全替换。这是设计意图。
}

/**
 * 渲染降水/沙暴/雾（foreground 层）
 */
function renderPrecipitation(ctx, wx, c) {
  if (!wx || !wx.current) return;
  const type = wx.current.type;
  const pi = wx.current.precipIntensity;
  const w = wx.width || c?.width || 1280;
  const h = wx.height || c?.height || 720;

  if (type === 'rain') {
    if (typeof renderRain === 'function') renderRain(ctx, pi);
  } else if (type === 'snow') {
    if (typeof renderSnow === 'function') renderSnow(ctx, pi, w, h);
  } else if (type === 'sandstorm') {
    if (typeof renderSandstorm === 'function') renderSandstorm(ctx, wx, pi);
  } else if (type === 'fog') {
    if (typeof renderFog === 'function') renderFog(ctx, wx, pi, w, h);
  }
}
