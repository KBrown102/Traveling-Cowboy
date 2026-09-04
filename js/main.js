/**
 * main.js - 项目入口（息壤风格·深色调增强版 · 模块化编排）
 *
 * 职责：装配所有子系统、注册分层渲染回调、启动引擎。
 * 具体的绘制逻辑已拆分到各模块（本文件不重复实现任何绘制函数）：
 *   - js/utils/ColorUtils.js         : 颜色与渐变工具（含 NaN 保护）
 *   - js/render/SkyRenderer.js       : 天空/太阳/星星/月亮  → renderSky(ctx, c)
 *   - js/render/TerrainRenderer.js   : 远山 renderMountains / 地面路面 renderGround
 *   - js/render/ForegroundObjects.js : 前景流动物体          → renderForegroundObjects(ctx, c)
 *
 * 经典脚本模式（file:// 直接双击打开）：依赖经由全局作用域共享，无需 import。
 */
// ========== 创建引擎实例 ==========
const engine = new Engine('wallpaper');

// ========== 创建子系统 ==========
const renderer = new Renderer();
const dayNight = new DayNight(300);    // 5分钟一昼夜
const weather = new WeatherSystem();
const sceneManager = new SceneManager();
const lightSystem = new LightSystem();
const cowboy = new Cowboy();   // 🤠 前景主角：牛仔骑马

renderer.setSpeed(80); // 80px/s：世界明显在动，牛仔在前进
weather.setWorldSpeed(renderer.scrollSpeed); // 天气区宽度按此换算

// 注册系统到引擎
engine.setSystems({ renderer, dayNight, weather, sceneManager, lightSystem });

// 绑定鼠标事件到光照系统
lightSystem.bindToCanvas(engine.canvas);

// ========== 注册渲染层 ==========
// 层次顺序：background(天空→远山) → midground(场景灯光) → foreground(地面→物体→牛仔→光效)
// 远山必须在地面"之前"绘制，这样前景地面能盖住山脚（正确的景深关系）。
// 月亮在 renderSky 内已处理为"绘制在星星之上"（月亮离我们更近）。

renderer.register('background', (ctx, c) => {
  renderSky(ctx, c);          // 天空 / 太阳 / 星星 / 月亮（SkyRenderer）
  renderMountains(ctx, c);    // 3层远山剪影（TerrainRenderer）
  // 太阳/月亮的光注册仅用于本帧的前处理；清空后由中景灯光接管，避免跨帧残留
  lightSystem.clearLights();
});

renderer.register('midground', (ctx, c) => {
  renderClouds(ctx, weather, c);    // ☁️ 拟真云层（高空极慢 / 低空随风，遮日月）
  renderBirds(ctx, c);              // 🐦 飞鸟装饰（偶发小群剪影，恶劣天气/重阴/深夜隐藏）
  renderSceneLights(ctx, c);  // 城市窗户 / 村庄灯火
});

renderer.register('foreground', (ctx, c) => {
  renderGround(ctx, c);             // 地面渐变 + 水平路面（TerrainRenderer）
  renderForegroundObjects(ctx, c);  // 路边流动物体（ForegroundObjects）
  cowboy.render(ctx, c);            // 🤠 牛仔骑马剪影 + 行走动画
  lightSystem.render(ctx, c.width, c.height);  // 最后叠加全局光照（鼠标光圈等）
  renderPrecipitation(ctx, weather, c);         // 🌧️🌨️🌫️ 降水/雾（人物之前飘过）
});

// ====================================================================================
// ======== 场景发光物体（城市窗户、村庄灯火等）=======
// ====================================================================================
// 该函数依赖 lightSystem / sceneManager 等全局，保留在本文件作为"中景编排"。

function renderSceneLights(ctx, c) {
  const { width, height, scrollX, scene } = c;
  if (!scene || !scene.windowLights) return;

  const seed = hashCode(scene.id);
  const rng = seededRandom(seed + 333);
  const horizonY = height * 0.68;

  if (scene.terrainStyle === 'buildings') {
    // 城市：密集的窗户灯光
    for (let i = 0; i < 60; i++) {
      const bx = (rng() * width * 2 + scrollX * 0.25) % (width + 400) - 200;
      const by = horizonY - rng() * height * 0.28 - rng() * height * 0.12;

      // 窗户灯光颜色变化（暖黄/暖橙/冷白）
      const colorChoice = rng();
      let color = '#ffcc44';  // 默认暖黄
      if (colorChoice < 0.2) color = '#ff8833';   // 暖橙
      else if (colorChoice > 0.85) color = '#aaccff'; // 冷白

      const intensity = 0.4 + rng() * 0.6;
      const size = 1.2 + rng() * 2;

      // 窗户光点本体
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6 + size * 2;
      ctx.beginPath();
      ctx.arc(bx, by, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 注册为发光物体
      lightSystem.addLight(bx, by, size * 3, color, intensity * 0.5, 'window');
    }
  } else {
    // 村庄/城堡：稀疏的温暖灯火
    for (let i = 0; i < 10; i++) {
      const bx = (rng() * width * 1.5 + scrollX * 0.3) % (width + 300) - 150;
      const by = horizonY - rng() * height * 0.08;
      const intensity = 0.5 + rng() * 0.5;
      const size = 2 + rng() * 2;
      const color = '#ffaa33';

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + size * 3;
      ctx.beginPath();
      ctx.arc(bx, by, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      lightSystem.addLight(bx, by, size * 4, color, intensity * 0.4, 'lamp');
    }
  }
}

// ========== 启动引擎（多重保护确保渲染成功）==========
function startEngine() {
  try {
    // 检查canvas是否存在
    const cvs = document.getElementById('wallpaper');
    if (!cvs) {
      console.warn('[Start] Canvas not found, retrying...');
      setTimeout(startEngine, 200);
      return;
    }

    // 检查canvas尺寸
    if (cvs.width < 100 || cvs.height < 100) {
      // 强制设置一次
      cvs.width = window.innerWidth || 1280;
      cvs.height = window.innerHeight || 720;
      cvs.style.width = cvs.width + 'px';
      cvs.style.height = cvs.height + 'px';
    }

    // 启动
    engine.start();
    console.log('[Start] Engine started successfully');
  } catch (e) {
    console.error('[Start] Error:', e);
    setTimeout(startEngine, 500); // 出错也重试
  }
}

// 根据DOM状态选择启动方式
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(startEngine, 50));
} else {
  setTimeout(startEngine, 50);
}
console.log("Cowboy wallpaper v3 (modular) loaded.");
