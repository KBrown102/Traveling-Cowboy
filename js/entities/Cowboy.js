/**
 * Cowboy.js - 前景主角：牛仔骑马剪影 + 行走动画
 *
 * 设计要点（对照黑名单与进阶优化）：
 * - 纯黑剪影风格（参考息壤 App），不引入任何外部资源
 * - 剪影固定在屏幕左侧，世界向后滚动 → 产生「骑马前进」的错觉
 * - 四腿对角步态 + 身体上下起伏 + 尾巴/风衣随风摆动
 * - 根据天气调整姿态：沙尘暴前倾+风衣狂舞、雨雪微低头、晴日放松
 * - 根据场景风力微调尾巴/风衣飘动幅度
 * - 轻微外发光（rim glow），色调随昼夜变化（黄昏暖、夜间/白天冷）
 *
 * 经典脚本模式：class 挂全局，main.js 中 new Cowboy() 并注册到前景层
 */
class Cowboy {
  constructor() {
    this.stepFreq = 1.35;   // 步态频率（步/秒），舒缓治愈
  }

  /**
   * 主渲染入口
   * c: { width, height, time(昼夜数据), weather(天气状态), scene(当前场景) }
   */
  render(ctx, c) {
    const { width, height, time, weather, scene } = c;
    const t = performance.now() / 1000;

    // 牛仔尺寸随屏幕高度自适应
    const S = (height * 0.22) / 156;   // 局部坐标总高 ~156 单位

    // 固定在屏幕左侧，脚部落在近景地面上（用户要求再往左挪）
    const x = width * 0.22;
    const feetY = height * 0.84;

    const wType = weather?.type || 'clear';
    const wInt = weather?.intensity ?? 0.5;
    const wind = this.getWind(scene, wType, wInt);

    // 前倾角度：恶劣天气更明显
    let lean = 0.02;
    if (wType === 'sandstorm') lean = 0.22 * (0.5 + wInt);
    else if (wType === 'snow') lean = 0.10 * (0.5 + wInt);
    else if (wType === 'rain') lean = 0.07 * (0.5 + wInt);

    // 恶劣天气放慢步态（跋涉感）
    let freq = this.stepFreq;
    if (wType === 'sandstorm') freq *= 0.7;
    if (wType === 'snow') freq *= 0.82;
    if (wType === 'fog') freq *= 0.9;

    const phase = t * freq * Math.PI * 2;     // 连续步态相位
    const bob = Math.sin(phase * 2) * 2.2;    // 身体起伏（2倍频）

    ctx.save();
    ctx.translate(x, feetY);

    // ===== 地面接触阴影（柔和椭圆，增强落地感）=====
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 3, 52 * S * 1.1, 7 * S, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ===== 缩放 + 起伏 =====
    ctx.translate(0, bob);
    ctx.scale(S, S);

    // ===== 外发光底pass（rim glow，色调随昼夜）=====
    const rim = this.getRimColor(time);
    ctx.save();
    ctx.shadowColor = rim;
    ctx.shadowBlur = 14;
    this.drawSilhouette(ctx, { phase, lean, wind, wType }, rim, rim);
    ctx.restore();

    // ===== 清晰黑剪影 pass =====
    this.drawSilhouette(ctx, { phase, lean, wind, wType }, '#08080e', '#08080e');

    ctx.restore();
  }

  /**
   * 绘制完整剪影（马 + 骑手 + 风衣 + 尾巴）
   * g: { phase, lean, wind, wType }
   * fillCol / strokeCol: 填充与描边色（发光pass用亮色，清晰pass用黑色）
   */
  drawSilhouette(ctx, g, fillCol, strokeCol) {
    const { phase, lean, wind, wType } = g;
    ctx.fillStyle = fillCol;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ───── 四腿（对角步态）─────
    // 髋部 x：前右(+34) 后右(-34) 前左(+26) 后左(-26)
    // 对角相位：前右&后左同相(0)，前左&后右反相(π)
    const hips = [
      { x: 34, ph: 0 },          // 前右
      { x: -34, ph: Math.PI },   // 后右
      { x: 26, ph: Math.PI },    // 前左
      { x: -26, ph: 0 }          // 后左
    ];
    const legTopY = -52;
    for (const h of hips) {
      const sw = Math.sin(phase + h.ph) * 13;             // 前后摆动
      const lift = Math.max(0, Math.cos(phase + h.ph)) * 7; // 伸展时抬蹄
      const kneeX = h.x + sw * 0.5 - 5;                    // 膝盖向后弯
      const hoofX = h.x + sw;
      const hoofY = -lift;
      ctx.beginPath();
      ctx.moveTo(h.x, legTopY);
      ctx.quadraticCurveTo(kneeX, legTopY + 30, hoofX, hoofY);
      ctx.stroke();
    }

    // ───── 尾巴（随风+步态摆动）─────
    const tailSway = Math.sin(phase * 0.5) * 4 + wind * 20;
    ctx.beginPath();
    ctx.moveTo(-46, -78);
    ctx.quadraticCurveTo(-66 - wind * 8, -66, -74 - tailSway, -46 + wind * 10);
    ctx.quadraticCurveTo(-68, -58, -48, -70);
    ctx.closePath();
    ctx.fill();

    // ───── 身体（饱满豆形）─────
    ctx.beginPath();
    ctx.moveTo(-48, -52);
    ctx.quadraticCurveTo(-54, -86, -10, -90);
    ctx.quadraticCurveTo(42, -93, 52, -74);
    ctx.quadraticCurveTo(56, -58, 38, -52);
    ctx.quadraticCurveTo(0, -47, -48, -52);
    ctx.closePath();
    ctx.fill();

    // ───── 脖子（向上前方）─────
    ctx.beginPath();
    ctx.moveTo(40, -82);
    ctx.quadraticCurveTo(58, -104, 64, -120);
    ctx.lineTo(80, -118);
    ctx.quadraticCurveTo(72, -98, 54, -78);
    ctx.closePath();
    ctx.fill();

    // ───── 头/口鼻 ─────
    ctx.beginPath();
    ctx.moveTo(64, -120);
    ctx.quadraticCurveTo(84, -127, 88, -116);
    ctx.quadraticCurveTo(89, -108, 80, -107);
    ctx.lineTo(63, -112);
    ctx.closePath();
    ctx.fill();

    // ───── 耳朵 ─────
    ctx.beginPath(); ctx.moveTo(66, -122); ctx.lineTo(70, -133); ctx.lineTo(74, -121); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(59, -120); ctx.lineTo(61, -131); ctx.lineTo(66, -119); ctx.closePath(); ctx.fill();

    // ───── 骑手 ─────
    ctx.save();
    ctx.translate(6, -90);
    ctx.rotate(lean);   // 前倾

    // 躯干
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.quadraticCurveTo(-13, -34, -2, -41);
    ctx.quadraticCurveTo(11, -43, 13, -34);
    ctx.quadraticCurveTo(15, -10, 7, 0);
    ctx.closePath();
    ctx.fill();

    // 头
    ctx.beginPath();
    ctx.arc(2, -47, 9, 0, Math.PI * 2);
    ctx.fill();

    // 牛仔帽：帽檐 + 帽冠
    ctx.beginPath();
    ctx.ellipse(2, -53, 21, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, -53);
    ctx.quadraticCurveTo(-7, -68, 2, -68);
    ctx.quadraticCurveTo(11, -68, 13, -53);
    ctx.closePath();
    ctx.fill();

    // 手臂（向前抓缰绳）
    ctx.beginPath();
    ctx.moveTo(9, -30);
    ctx.quadraticCurveTo(28, -28, 42, -22);
    ctx.stroke();

    // 腿（弯曲踩镫）
    ctx.beginPath();
    ctx.moveTo(2, -2);
    ctx.quadraticCurveTo(16, 7, 19, 19);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(19, 19);
    ctx.quadraticCurveTo(21, 31, 16, 41);
    ctx.stroke();

    ctx.restore();

    // ───── 风衣/斗篷（从臀部向后下方飘，随风摆动）─────
    ctx.save();
    ctx.translate(6, -90);
    ctx.rotate(lean);
    const flutter = wind * 24 + Math.sin(phase * 0.8) * 4;
    ctx.beginPath();
    ctx.moveTo(-9, -36);
    ctx.quadraticCurveTo(-32 - flutter * 0.5, -30, -48 - flutter, -8);
    ctx.quadraticCurveTo(-42 - flutter * 0.6, -1, -30, 5);
    ctx.quadraticCurveTo(-15, 1, -6, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** 风力评估：场景基础值 × 天气放大 */
  getWind(scene, wType, wInt) {
    let base = 0.15;
    const id = scene?.id;
    if (id === 'coast') base = 0.5;
    else if (id === 'plains' || id === 'grassland') base = 0.3;
    else if (id === 'mountains') base = 0.4;
    else if (id === 'tundra') base = 0.45;
    else if (id === 'desert' || id === 'gobi') base = 0.35;
    else if (id === 'oasis') base = 0.25;

    if (wType === 'sandstorm') base = 1.0;
    else if (wType === 'rain' || wType === 'snow') base = Math.max(base, 0.5) * (0.6 + wInt * 0.4);
    else if (wType === 'fog') base *= 0.3;
    else if (wType === 'cloudy') base *= (0.8 + wInt * 0.4);
    return Math.min(1, base);
  }

  /** 外发光色调（随昼夜） */
  getRimColor(time) {
    const p = time?.progress ?? 0.5;
    if (p > 0.68 && p < 0.86) return 'rgba(255,140,80,0.5)';   // 黄昏暖
    if (p > 0.14 && p < 0.30) return 'rgba(255,170,120,0.45)'; // 黎明暖
    if (p >= 0.30 && p <= 0.68) return 'rgba(150,180,230,0.32)'; // 白天冷
    return 'rgba(160,185,235,0.4)';                            // 夜间冷
  }
}
