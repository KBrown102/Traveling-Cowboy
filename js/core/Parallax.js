/**
 * Parallax.js - 视差滚动工具
 * 提供无限循环背景的计算辅助方法
 */
class Parallax {
  /**
   * 计算无限滚动的绘制位置
   * @param {number} worldX - 世界坐标（随时间增长）
   * @param {number} viewWidth - 视口宽度
   * @param {number} patternWidth - 图案重复宽度
   * @returns {{offset: number, count: number}} offset为起始偏移，count为需要绘制的份数
   */
  static calcLoopPositions(worldX, viewWidth, patternWidth) {
    // 取模得到当前周期内的偏移
    const offset = ((worldX % patternWidth) + patternWidth) % patternWidth;
    // 需要绘制的图案数 = 视口宽度 / 图案宽度 + 2（前后各多一个防穿帮）
    const count = Math.ceil(viewWidth / patternWidth) + 2;
    return { offset: -offset, count };
  }

  /**
   * 将世界坐标转换为带视差的屏幕坐标
   * @param {number} worldX - 世界X坐标
   * @param {number} parallaxFactor - 视差系数 (0~1)
   * @param {number} viewportOffset - 视口滚动偏移
   * @returns {number} 屏幕X坐标
   */
  static toScreenX(worldX, parallaxFactor, viewportOffset) {
    return worldX - viewportOffset * parallaxFactor;
  }

  /**
   * 线性插值颜色
   * @param {string} color1 - 起始色 (#rrggbb 或 hsl字符串)
   * @param {string} color2 - 结束色
   * @param {number} t - 进度 0~1
   * @returns {string} 插值后的颜色
   */
  static lerpColor(color1, color2, t) {
    const c1 = Parallax.parseColor(color1);
    const c2 = Parallax.parseColor(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * 三色插值（用于昼夜6个关键帧之间的过渡）
   * @param {Array<string>} colors - 颜色数组 [c0, c1, c2]
   * @param {number} t - 总进度 0~1
   * @returns {string}
   */
  static lerp3Color(colors, t) {
    const seg = t * (colors.length - 1); // 映射到段数
    const i = Math.floor(seg);
    const f = seg - i;
    if (i >= colors.length - 1) return colors[colors.length - 1];
    return Parallax.lerpColor(colors[i], colors[i + 1], f);
  }

  /** 解析颜色为RGB对象 */
  static parseColor(color) {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      return {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16)
      };
    }
    // 简单解析 rgb(r,g,b)
    const m = color.match(/\d+/g);
    return m ? { r: +m[0], g: +m[1], b: +m[2] } : { r: 0, g: 0, b: 0 };
  }
}
