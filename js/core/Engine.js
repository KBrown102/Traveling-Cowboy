/**
 * Engine.js - Canvas引擎核心
 * 负责初始化、resize、主循环调度
 *
 * v2: 渲染函数加了 try-catch 保护，单层崩溃不会杀死整个循环
 */
class Engine {
  constructor(canvasId = 'wallpaper') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error('[Engine] Canvas #' + canvasId + ' not found!');
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.running = false;
    this.lastTime = 0;
    this.deltaTime = 0;

    // 子系统（由main.js注入）
    this.renderer = null;
    this.dayNight = null;
    this.weather = null;
    this.sceneManager = null;
    this.audio = null;
    this.lightSystem = null;

    // 调试
    this.debugEl = document.getElementById('debug-info');
    this.fpsHistory = [];
    this.frameCount = 0;
    this._lastError = null;   // 记录最近的渲染错误
    this._errorCount = 0;      // 连续错误计数
    this._totalErrors = 0;     // 累计错误总数（用于统计）
    this._maxConsecutiveErrors = 60;  // 连续60帧错误才停止（约1秒），给场景过渡足够的容错空间

    // 绑定resize
    this._onResize = this.handleResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  /** 设置各子系统 */
  setSystems({ renderer, dayNight, weather, sceneManager, audio, lightSystem }) {
    this.renderer = renderer;
    this.dayNight = dayNight;
    this.weather = weather;
    this.sceneManager = sceneManager;
    this.audio = audio;
    this.lightSystem = lightSystem;
  }

  /** 处理窗口缩放 */
  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth || window.outerWidth || 1280;
    this.height = window.innerHeight || window.outerHeight || 720;

    // 安全下限：防止0尺寸导致NaN
    if (this.width < 100) this.width = 1280;
    if (this.height < 100) this.height = 720;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.renderer) {
      this.renderer.resize(this.width, this.height);
    }
  }

  /** 主循环 */
  start() {
    if (this.running) return;

    // 确保canvas尺寸已正确设置（防止file://下布局未完成）
    this.handleResize();

    if (this.width < 100 || this.height < 100) {
      // 尺寸还不对，延迟重试
      console.warn('[Engine] Canvas size too small, retrying in 100ms...');
      setTimeout(() => this.start(), 100);
      return;
    }

    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
    console.log('[Engine] Started', this.width, 'x', this.height);
  }

  stop() {
    this.running = false;
  }

  loop(currentTime) {
    if (!this.running) return;

    this.deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // 限制最大deltaTime，防止切后台回来时间跳跃
    if (this.deltaTime > 0.1) this.deltaTime = 0.016;
    if (this.deltaTime <= 0) this.deltaTime = 0.016;

    try {
      this.update(this.deltaTime);
      this.render();
      this._errorCount = 0;  // 成功帧，重置错误计数
    } catch (e) {
      this._errorCount++;
      this._totalErrors++;
      this._lastError = e;
      // 连续崩溃超过阈值才停止（默认60帧≈1秒，给场景过渡足够容错空间）
      if (this._errorCount > this._maxConsecutiveErrors) {
        console.error('[Engine] Too many consecutive errors (' + this._errorCount + '), stopping:', e.message);
        this.running = false;
        if (this.debugEl) {
          this.debugEl.innerHTML = '<span style="color:red">渲染出错(累计' + this._totalErrors + '次): ' + e.message + '</span>';
        }
        return;
      }
      // 偶发错误：仅前3次打印日志，避免刷屏
      if (this._errorCount <= 3 || this._errorCount % 10 === 0) {
        console.warn('[Engine] Render error #' + this._errorCount + ' (total:' + this._totalErrors + '):', e.message);
      }
    }

    // FPS统计
    this.frameCount++;
    if (this.debugEl && this.frameCount % 30 === 0) {
      this.updateDebug();
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt) {
    this.dayNight?.update(dt);
    this.weather?.update(
      dt,
      this.renderer ? this.renderer.scrollX : 0,
      this.sceneManager ? this.sceneManager.getCurrentScene() : null,
      this.width,
      this.height,
      this.dayNight ? this.dayNight.getTimeData() : null
    );
    this.sceneManager?.update(dt);
    this.audio?.update(dt);
    this.lightSystem?.update(dt);
  }

  render() {
    if (!this.renderer || !this.ctx) return;

    // 安全清除
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.renderer.render(this.ctx, {
      width: this.width,
      height: this.height,
      time: this.dayNight?.getTimeData(),
      weather: this.weather?.getState(),
      scene: this.sceneManager?.getCurrentScene(),
      scrollX: this.renderer.scrollX,
      lightSystem: this.lightSystem
    });
  }

  updateDebug() {
    const now = performance.now();
    this.fpsHistory.push(now);
    while (this.fpsHistory.length && now - this.fpsHistory[0] > 2000) {
      this.fpsHistory.shift();
    }
    const fps = Math.round(this.fpsHistory.length / 2);

    const t = this.dayNight?.getTimeData();
    const w = this.weather?.getState();
    const s = this.sceneManager?.getCurrentScene();

    let html = 'FPS: ' + fps;
    if (t) html += '<br>时间: ' + t.phase + ' (' + Math.floor(t.progress * 100) + '%)';
    if (w) html += '<br>天气: ' + w.type;
    if (s) html += '<br>场景: ' + s.name;
    if (this._lastError && this._totalErrors > 0) {
      html += '<br><span style="color:#f66">err:' + this._errorCount + ' consecutive / ' + this._totalErrors + ' total</span>';
    }

    this.debugEl.innerHTML = html;
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
  }
}
