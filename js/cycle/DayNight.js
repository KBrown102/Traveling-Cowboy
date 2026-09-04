/**
 * DayNight.js - 昼夜系统（息壤风格·增强版）
 * 5分钟完成一个完整昼夜循环
 *
 * 增强内容：
 * - 太阳位置 + 光线强度/颜色参数
 * - 月亮位置 + 光晕大小/强度参数
 * - 星星可见度系数
 * - 大气散射色（用于整体色调偏移）
 */
class DayNight {
  constructor(cycleSeconds = 300) {
    this.cycleSeconds = cycleSeconds;
    this.elapsed = 0;
    this.progress = 0.3; // 从早晨开始
    this.phase = 'morning';
  }

  update(dt) {
    this.elapsed += dt;
    this.progress = (this.elapsed / this.cycleSeconds) % 1;
    this.phase = this.getPhase();
  }

  getPhase() {
    const p = this.progress;
    if (p < 0.20) return 'night';
    if (p < 0.28) return 'dawn';
    if (p < 0.42) return 'morning';
    if (p < 0.58) return 'noon';
    if (p < 0.72) return 'afternoon';
    if (p < 0.80) return 'dusk';
    return 'night';
  }

  /** 返回完整时间数据供渲染使用 */
  getTimeData() {
    const p = this.progress;

    // 计算昼夜过渡系数
    let dayIntensity, nightIntensity, transitionBlend;
    if (p >= 0.25 && p <= 0.75) {
      // 白天
      dayIntensity = 1;
      nightIntensity = 0;
      transitionBlend = 1;
    } else if (p > 0.75 && p <= 0.85) {
      // 黄昏→夜间过渡
      const t = (p - 0.75) / 0.10;
      dayIntensity = 1 - t;
      nightIntensity = t;
      transitionBlend = 1 - t * 0.5;
    } else if (p >= 0.15 && p < 0.25) {
      // 夜间→黎明过渡
      const t = (p - 0.15) / 0.10;
      dayIntensity = t;
      nightIntensity = 1 - t;
      transitionBlend = 0.5 + t * 0.5;
    } else {
      dayIntensity = 0;
      nightIntensity = 1;
      transitionBlend = 0;
    }

    return {
      progress: this.progress,
      phase: this.phase,
      elapsed: this.elapsed,
      dayIntensity,
      nightIntensity,
      transitionBlend,
      // 星星可见度：夜间高、白天几乎不可见
      starVisibility: Math.max(0, Math.min(1, (nightIntensity - 0.2) / 0.8)),
      // 环境亮度（影响剪影对比度）
      ambientBrightness: 0.08 + dayIntensity * 0.35
    };
  }

  /**
   * 获取太阳完整信息
   * @returns {Object|null} {x, y, visible, radius, rayLength, color, intensity}
   */
  getSunData(width, height) {
    const p = this.progress;
    // 太阳只在 dawn(0.28) ~ dusk(0.80) 出现
    const dayStart = 0.27, dayEnd = 0.78;
    const dayLen = dayEnd - dayStart;
    let dayProgress = (p - dayStart) / dayLen;

    if (dayProgress < -0.08 || dayProgress > 1.08) return null;

    // 边缘淡入淡出
    let intensity = 1;
    if (dayProgress < 0) { intensity = 1 + dayProgress / 0.08; }       // 黎明升起
    if (dayProgress > 1) { intensity = 1 - (dayProgress - 1) / 0.08; } // 黄昏落下
    intensity = Math.max(0, Math.min(1, intensity));

    // 弧线轨迹
    dayProgress = Math.max(0, Math.min(1, dayProgress));
    const angle = dayProgress * Math.PI;
    const cx = width * 0.5;
    const rx = width * 0.45;
    const ry = height * 0.40;
    const cy = height * 0.68;

    const x = cx - Math.cos(angle) * rx;
    const y = cy - Math.sin(angle) * ry;

    // 根据时间调整太阳颜色和大小
    let color = '#fff4e0';   // 正午：亮白色
    let radius = 30;
    let rayLength = 200;

    if (this.phase === 'dawn' || this.phase === 'dusk') {
      color = '#ff8844';     // 黄昏：暖橙红
      radius = 38;
      rayLength = 280;
    } else if (this.phase === 'morning' || this.phase === 'afternoon') {
      color = '#ffcc66';     // 上午/下午：金黄
      radius = 33;
      rayLength = 240;
    }

    return { x, y, visible: true, radius, rayLength, color, intensity };
  }

  /**
   * 获取月亮完整信息
   * @returns {Object|null} {x, y, visible, radius, glowRadius, phase: 'waxing'|'waning'|'full'}
   */
  getMoonData(width, height) {
    const p = this.progress;
    // 月亮在夜间可见 (0.82 ~ 0.22 跨越0点)
    let nightProgress;
    if (p >= 0.82) {
      nightProgress = (p - 0.82) / 0.40;
    } else if (p <= 0.18) {
      nightProgress = (p + 0.18) / 0.40;
    } else {
      return null;
    }

    // 边缘淡入淡出
    let intensity = 1;
    if (nightProgress < 0.05) intensity = nightProgress / 0.05;
    if (nightProgress > 0.95) intensity = (1 - nightProgress) / 0.05;
    intensity = Math.max(0, Math.min(1, intensity));

    nightProgress = Math.max(0, Math.min(1, nightProgress));

    // 弧线轨迹（与太阳相反）
    const angle = nightProgress * Math.PI;
    const cx = width * 0.5;
    const rx = width * 0.40;
    const ry = height * 0.32;
    const cy = height * 0.62;

    const x = cx - Math.cos(angle) * rx;
    const y = cy - Math.sin(angle) * ry;

    return {
      x, y,
      visible: true,
      radius: 24,
      glowRadius: 180 + intensity * 60,  // 息壤风格大光晕！
      intensity,
      moonPhase: 'waxing'
    };
  }
}
