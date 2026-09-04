/**
 * SkyRenderer.js - 天空渲染模块
 *
 * 负责：天空渐变背景、太阳（带放射光线）、月亮（超大光晕）、
 *       星空系统（银河带+十字光芒）、大气散射微光
 *
 * 渲染顺序（从底到顶）：
 *   1. 天空渐变背景
 *   2. 大气散射微光
 *   3. 太阳 + 光线
 *   4. 星星 ← 先画，因为月亮更近
 *   5. 月亮 ← 后画，遮盖星星（符合真实物理！）
 */

// ══════════════════════════════════════
// 太阳绘制（息壤风格·多层光晕）
// ══════════════════════════════════════

function drawSunEnhanced(ctx, data) {
  const { x, y, radius, color, intensity } = data;
  if (!isFinite(x) || !isFinite(y) || !isFinite(radius)) return;
  const r0 = Math.max(0, radius), rVal = Math.max(0.01, intensity);
  const rgb = hexToRGB(String(color).replace('#', ''));

  // 最外层大气散射光晕
  const outerGlow = safeRadialGrad(ctx, x, y, r0 * 0.5, x, y, r0 * 8);
  if (outerGlow) {
    outerGlow.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${(0.15*rVal).toFixed(4)})`);
    outerGlow.addColorStop(0.3, `rgba(${rgb.r},${rgb.g},${rgb.b},${(0.06*rVal).toFixed(4)})`);
    outerGlow.addColorStop(0.7, `rgba(${rgb.r},${rgb.g},${rgb.b},${(0.02*rVal).toFixed(4)})`);
    outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath(); ctx.arc(x, y, r0*8, 0, Math.PI*2); ctx.fill();
  }

  // 中层光晕
  const midGlow = safeRadialGrad(ctx, x, y, 0, x, y, r0 * 3);
  if (midGlow) {
    midGlow.addColorStop(0, `rgba(255,255,240,${(0.35*rVal).toFixed(4)})`);
    midGlow.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${(0.18*rVal).toFixed(4)})`);
    midGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = midGlow;
    ctx.beginPath(); ctx.arc(x, y, r0*3, 0, Math.PI*2); ctx.fill();
  }

  // 内层核心
  const core = safeRadialGrad(ctx, x, y, 0, x, y, r0 * 1.3);
  if (core) {
    core.addColorStop(0, `rgba(255,255,255,${(0.95*rVal).toFixed(4)})`);
    core.addColorStop(0.3, `rgba(255,250,220,${(0.85*rVal).toFixed(4)})`);
    core.addColorStop(0.7, String(color));
    core.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},${(0.7*rVal).toFixed(4)})`);
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(x, y, r0, 0, Math.PI*2); ctx.fill();
  }
}

// ══════════════════════════════════════
// 月亮绘制（息壤风格·超大柔和光晕 · 在星星之上！）
// ══════════════════════════════════════

function drawMoonEnhanced(ctx, data) {
  const { x, y, radius, glowRadius, intensity } = data;
  if (!isFinite(x)||!isFinite(y)||!isFinite(radius)||!isFinite(glowRadius)) return;
  const r0 = Math.max(0, radius), gr = Math.max(r0, glowRadius);
  const rv = Math.max(0.01, intensity);

  // 超大范围光晕
  const hg = safeRadialGrad(ctx, x, y, r0*0.3, x, y, gr);
  if (hg) {
    hg.addColorStop(0, `rgba(210,220,245,${(0.20*rv).toFixed(4)})`);
    hg.addColorStop(0.2, `rgba(200,210,240,${(0.10*rv).toFixed(4)})`);
    hg.addColorStop(0.5, `rgba(190,200,235,${(0.04*rv).toFixed(4)})`);
    hg.addColorStop(1, 'rgba(180,190,230,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(x,y,gr,0,Math.PI*2); ctx.fill();
  }

  // 中层光晕
  const mg = safeRadialGrad(ctx, x, y, 0, x, y, r0*4);
  if (mg) {
    mg.addColorStop(0, `rgba(230,238,255,${(0.30*rv).toFixed(4)})`);
    mg.addColorStop(0.5, `rgba(220,230,250,${(0.08*rv).toFixed(4)})`);
    mg.addColorStop(1, 'rgba(200,215,240,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(x,y,r0*4,0,Math.PI*2); ctx.fill();
  }

  // 弯月本体
  ctx.fillStyle = '#e8ecf4';
  ctx.shadowColor = '#d0daf0'; ctx.shadowBlur = 15;
  ctx.beginPath(); ctx.arc(x, y, r0, 0, Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(x+r0*0.35, y-r0*0.2, r0*0.78, 0, Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
}

// ══════════════════════════════════════
// 星空系统 v2（银河带+十字光芒）
// ══════════════════════════════════════

let _starsCacheV2 = {};

function drawStarsEnhanced(ctx, w, h, timeData, sceneId) {
  const cacheKey = `v2_${sceneId}_${Math.floor(w/100)}_${Math.floor(h/100)}`;
  const visibility = timeData.starVisibility;

  if (!_starsCacheV2[cacheKey]) {
    const stars = [];
    const baseSeed = hashCode(sceneId);
    const galaxyCenterY = h * 0.32;
    const galaxyThickness = h * 0.18;
    const galaxyAngle = -0.08;
    const totalStars = Math.floor(w * h / 900);

    for (let i = 0; i < totalStars; i++) {
      const sx = hashFloat(baseSeed + i*2654435761 + 12345);
      const sy = hashFloat(baseSeed + i*808306141 + 54321);
      let sz = hashFloat(baseSeed + i*1629613171 + 11111);

      let x = sx * w;
      let y = sy * h * 0.62;

      const dyFromGalaxy = y - galaxyCenterY;
      const dxAlongGalaxy = x - w * 0.5;
      const perpDist = Math.abs(dyFromGalaxy - dxAlongGalaxy * Math.tan(galaxyAngle));

      let sz_extra = sz;
      if (perpDist < galaxyThickness) {
        sz_extra = Math.min(1, sz + (1 - perpDist/galaxyThickness)*0.4);
      }

      const sizeRaw = sz_extra;
      const size = sizeRaw < 0.7 ? 0.3+sizeRaw*1.0 : 1.0+(sizeRaw-0.7)*6;
      const brightness = 0.25 + sz_extra * 0.75;
      const colorRoll = hashFloat(baseSeed + i*224582533 + 99999);
      let colorTemp = 0;
      if (colorRoll > 0.94) colorTemp = 1;
      else if (colorRoll < 0.04) colorTemp = 2;

      stars.push({x,y,size,brightness,colorTemp,
        twinkleOffset: hashFloat(baseSeed+i*333555+777)*Math.PI*2,
        twinkleSpeed: 0.5+hashFloat(baseSeed+i*666777+888)*2.0,
        inGalaxy: perpDist<galaxyThickness});
    }
    _starsCacheV2[cacheKey] = stars;
  }

  const now = performance.now() / 1000;
  for (const star of _starsCacheV2[cacheKey]) {
    const twinkle = 0.5+0.5*Math.sin(now*star.twinkleSpeed+star.twinkleOffset);
    const alpha = visibility*twinkle*star.brightness;
    if (alpha < 0.02) continue;

    let coreColor, glowColor;
    if (star.colorTemp===1) {
      coreColor=`rgba(255,245,200,${alpha.toFixed(3)})`;
      glowColor=`rgba(255,220,150,${(alpha*0.25).toFixed(3)})`;
    } else if (star.colorTemp===2) {
      coreColor=`rgba(210,230,255,${alpha.toFixed(3)})`;
      glowColor=`rgba(180,210,255,${(alpha*0.25).toFixed(3)})`;
    } else {
      coreColor=`rgba(255,255,248,${alpha.toFixed(3)})`;
      glowColor=`rgba(255,255,240,${(alpha*0.2).toFixed(3)})`;
    }

    const sr = star.size;
    if (sr > 2.0) {
      const sg = safeRadialGrad(ctx, star.x, star.y, 0, star.x, star.y, sr*4);
      if (sg) {
        sg.addColorStop(0, glowColor);
        sg.addColorStop(0.35, glowColor.replace(/[\d.]+\)$/, `${(alpha*0.12).toFixed(3)})`));
        sg.addColorStop(1, 'rgba(255,255,240,0)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(star.x, star.y, sr*4, 0, Math.PI*2); ctx.fill();
      }
      // 十字光芒
      const rayAlpha = alpha*0.15*twinkle;
      ctx.strokeStyle = `rgba(255,255,250,${rayAlpha.toFixed(3)})`;
      ctx.lineWidth = 0.4;
      const rayLen = sr*(3.5+twinkle*2);
      ctx.beginPath();
      ctx.moveTo(star.x-rayLen, star.y); ctx.lineTo(star.x+rayLen, star.y);
      ctx.moveTo(star.x, star.y-rayLen); ctx.lineTo(star.x, star.y+rayLen);
      ctx.stroke();
    } else if (sr > 1.0) {
      const mg = safeRadialGrad(ctx, star.x, star.y, 0, star.x, star.y, sr*2.5);
      if (mg) {
        mg.addColorStop(0, coreColor);
        mg.addColorStop(0.5, glowColor);
        mg.addColorStop(1, 'rgba(255,255,240,0)');
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(star.x, star.y, sr*2.5, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.fillStyle = coreColor;
    ctx.beginPath(); ctx.arc(star.x, star.y, sr*(0.6+0.4*twinkle), 0, Math.PI*2); ctx.fill();
  }
}

// ══════════════════════════════════════
// 大气散射微光（日出日落地平线辉光）
// ══════════════════════════════════════

function drawAtmosphericGlow(ctx, w, h, timeData, scene, nextScene, blend) {
  const p = timeData.progress;
  let intensity = 0;
  if (p>=0.26 && p<=0.32) intensity=Math.sin((p-0.26)/0.06*Math.PI);
  else if (p>=0.74 && p<=0.80) intensity=Math.sin((p-0.74)/0.06*Math.PI);
  if (intensity<0.05) return;
  intensity *= timeData.dayIntensity;

  const horizonY = h*0.78, glowHeight=h*0.30;
  const grad = safeLinearGrad(ctx, 0, horizonY, 0, horizonY-glowHeight);
  if (!grad) return;

  if (p<0.5) {
    grad.addColorStop(0,`rgba(255,180,100,${(intensity*0.35).toFixed(4)})`);
    grad.addColorStop(0.3,`rgba(255,140,90,${(intensity*0.18).toFixed(4)})`);
    grad.addColorStop(0.7,`rgba(200,120,160,${(intensity*0.06).toFixed(4)})`);
    grad.addColorStop(1,'rgba(150,100,180,0)');
  } else {
    grad.addColorStop(0,`rgba(255,100,50,${(intensity*0.30).toFixed(4)})`);
    grad.addColorStop(0.3,`rgba(220,80,100,${(intensity*0.16).toFixed(4)})`);
    grad.addColorStop(0.7,`rgba(140,60,140,${(intensity*0.05).toFixed(4)})`);
    grad.addColorStop(1,'rgba(100,40,120,0)');
  }
  ctx.fillStyle=grad;
  ctx.fillRect(0,horizonY-glowHeight,w,glowHeight+10);
}

// ══════════════════════════════════════
// 主入口：渲染完整天空
// ══════════════════════════════════════

/**
 * 渲染整个天空（由 main.js 的 background 层调用）
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} c - {width,height,time,weather,scene,scrollX}
 */
function renderSky(ctx, c) {
  const { width, height, time:timeData, weather:wState } = c;
  const blend = sceneManager.getBlendFactor();
  const scene = sceneManager.getCurrentScene();
  const nextScene = sceneManager.getNextScene();
  if (!scene||!timeData) return;

  // 阴晴 / 遮挡：云遮日月 → 变暗变模糊；阴天(overcast)整体压灰
  const overcast = wState ? (wState.overcast || 0) : 0;
  const hasSample = typeof sampleObscuration === 'function';

  // 1. 天空渐变（全局天空：只跟昼夜+天气走，与场景无关 → 绿洲不再绿天、海岸不再蓝天）
  const wType = wState ? wState.type : 'clear';
  const skyTop = getSkyColorAtTime(timeData.progress, wType);
  const skyBot = getSkyBottomColor(timeData.progress, wType);

  const skyGrad=safeLinearGrad(ctx,0,0,0,height*0.72);
  if(skyGrad){
    skyGrad.addColorStop(0,skyTop);
    skyGrad.addColorStop(0.6,skyBot);
    skyGrad.addColorStop(1,lerpColor(skyBot,'#000',0.15));
    ctx.fillStyle=skyGrad;
    ctx.fillRect(0,0,width,height);
  }

  // 1b.（阴晴幕已移动到日月星辰「之后」绘制，见文件末尾第 6 步——
  //     这样它才能连续、柔和地遮住日月，而不是只压灰天空背景。）

  // 2. 大气散射微光
  if(timeData.dayIntensity>0.1){
    drawAtmosphericGlow(ctx,width,height,timeData,scene,nextScene,blend);
  }

  // 3. 太阳（云遮挡 → 变暗变模糊）
  if(wState?.celestialVisible!==false){
    const sunData=dayNight.getSunData(width,height);
    if(sunData?.visible){
      const obsc = hasSample ? sampleObscuration(sunData.x, sunData.y) : 0;
      const eff = sunData.intensity * (1 - obsc*0.85) * (1 - overcast*0.5);
      if(eff>0.02){
        lightSystem.renderSunRays(ctx,sunData.x,sunData.y,12,sunData.rayLength,sunData.color,eff);
        drawSunEnhanced(ctx,Object.assign({},sunData,{intensity:eff}));
        lightSystem.addLight(sunData.x,sunData.y,sunData.radius*2,sunData.color,eff*0.8,'sun');
      }
    }
  }

  // 4. 星星（先画！月亮在后面会盖住它们）——星星也随 overcast 连续变淡
  if(timeData.starVisibility>0 && wState?.celestialVisible!==false){
    const starTime = (overcast>0.02)
      ? Object.assign({}, timeData, { starVisibility: timeData.starVisibility * (1 - overcast*0.85) })
      : timeData;
    drawStarsEnhanced(ctx,width,height,starTime,scene.id);
  }

  // 5. 月亮（后画！月亮离我们比星星近，所以遮盖星星；同样受云遮挡变暗）
  if(wState?.celestialVisible!==false){
    const moonData=dayNight.getMoonData(width,height);
    if(moonData?.visible){
      const obsc = hasSample ? sampleObscuration(moonData.x, moonData.y) : 0;
      const eff = moonData.intensity * (1 - obsc*0.85) * (1 - overcast*0.45);
      if(eff>0.02){
        drawMoonEnhanced(ctx,Object.assign({},moonData,{intensity:eff}));
        lightSystem.addLight(moonData.x,moonData.y,moonData.radius*2,'#e8ecf4',eff*0.5,'moon');
      }
    }
  }

  // 6. 中层阴晴幕（画在日月星辰「之后」，云「之前」）
  //    随 overcast 连续变化的半透明幕：把后层的太阳/月亮/星星柔和地「蒙」住，
  //    而不是硬阈值一刀切。透明度连续 → 阴晴切换平滑。
  //    白天蒙灰白（overcast 时天空发白），夜晚蒙暗蓝灰（阴夜更暗）。
  //    幕是半透明的 → 太阳核心仍能透出「一点点光斑」，符合真实阴天观感。
  if(overcast>0.02){
    const day=timeData.dayIntensity;
    const vr=Math.round(lerpNum(44,152,day));
    const vg=Math.round(lerpNum(48,158,day));
    const vb=Math.round(lerpNum(64,170,day));
    const topA=overcast*lerpNum(0.42,0.60,day);
    const botA=overcast*lerpNum(0.30,0.42,day);
    const veil=safeLinearGrad(ctx,0,0,0,height*0.80);
    if(veil){
      veil.addColorStop(0,`rgba(${vr},${vg},${vb},${topA.toFixed(3)})`);
      veil.addColorStop(1,`rgba(${vr},${vg},${vb},${botA.toFixed(3)})`);
      ctx.fillStyle=veil;
      ctx.fillRect(0,0,width,height*0.80);
    }
  }
}

// 本地线性插值（避免依赖 ColorUtils 的 lerp 命名差异）
function lerpNum(a,b,t){ t=t<0?0:(t>1?1:t); return a+(b-a)*t; }
