/**
 * SceneManager.js - 场景管理器（阶段1简化版）
 * 管理场景切换和过渡动画
 */
class SceneManager {
  constructor() {
    this.scenes = SCENES;
    this.currentIndex = 0;
    this.sceneTime = 0;        // 在当前场景已停留的时间
    this.transitioning = false;
    this.transitionProgress = 0;
    this.transitionDuration = 7; // 过渡持续约7秒（缩短以减少颜色混合的怪异中间态）

    this.current = SCENES[0];
    this.next = null;
  }

  getCurrentScene() {
    return this.current;
  }

  getNextScene() {
    return this.next || this.scenes[(this.currentIndex + 1) % this.scenes.length];
  }

  update(dt) {
    this.sceneTime += dt;

    // 场景停留时长 = 昼夜倍数 × 昼夜周期
    // 沙漠漫长(数昼夜)、绿洲一般(1昼夜)、城市短暂(不到1昼夜)
    let cycle = 300;
    try { cycle = (dayNight && dayNight.cycleSeconds) || 300; } catch (e) { cycle = 300; }
    const dwell = (this.current.dwellCycles != null) ? this.current.dwellCycles
                : (this.current.duration || 0.6);
    const sceneDuration = dwell * cycle;

    if (!this.transitioning) {
      // 检查是否需要切换场景
      if (this.sceneTime >= sceneDuration) {
        this.startTransition();
      }
    } else {
      // 过渡进度
      this.transitionProgress += dt / this.transitionDuration;
      if (this.transitionProgress >= 1) {
        this.completeTransition();
      }
    }
  }

  startTransition() {
    this.transitioning = true;
    this.transitionProgress = 0;
    this.currentIndex = (this.currentIndex + 1) % this.scenes.length;
    this.next = this.scenes[this.currentIndex];
  }

  completeTransition() {
    this.current = this.next;
    this.next = null;
    this.transitioning = false;
    this.transitionProgress = 0;
    this.sceneTime = 0;
  }

  /** 获取过渡混合系数 (0=完全current, 1=完全next) */
  getBlendFactor() {
    if (!this.transitioning) return 0;
    // 使用smoothstep让过渡更自然
    const t = this.transitionProgress;
    return t * t * (3 - 2 * t); // smoothstep
  }
}
