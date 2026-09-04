/**
 * TerrainRenderer.js - 地形渲染模块
 *
 * 负责：
 *   1. 3层视差远山剪影（13种专属地形轮廓）
 *   2. 地面渐变（支持场景过渡插值）
 *   3. 水平延展路面（黑名单#1：禁止透视收缩）
 */

// ══════════════════════════════════════
// 3层远山系统（13种地形风格 + 过渡插值）
// ══════════════════════════════════════

function drawMountains3Layer(ctx, scrollX, w, h, scene, nextScene, blend, timeData) {
  if (!scene?.mountains || !scene.mountains.length) return;
  drawSceneMountains(ctx, scrollX, w, h, scene, timeData, 1);
  if (blend>0 && nextScene?.mountains) {
    ctx.globalAlpha = blend*0.85;
    drawSceneMountains(ctx, scrollX,w,h,nextScene,timeData,1);
    ctx.globalAlpha=1;
  }
}

function drawSceneMountains(ctx, scrollX, w, h, scene, timeData) {
  const layers=scene.mountains;
  const style=scene.terrainStyle||'hills_gentle';
  const baseSeed=hashCode(scene.id);
  for(let li=0;li<layers.length;li++){
    const layer=layers[li];
    const parallaxFactors=[0.12,0.18,0.26];
    const layerScrollX=scrollX*(parallaxFactors[li]||(0.08+li*0.07));
    const horizonY=h*layer.yBase;
    const dayBoost=timeData.dayIntensity*0.15;
    ctx.fillStyle=adjustBright(layer.color,1+dayBoost);
    ctx.beginPath();
    ctx.moveTo(-10,h+10);
    generateMountainPath(ctx,style,layer,horizonY,baseSeed,li,layerScrollX,w,h,scene);
    ctx.lineTo(w+10,h+10); ctx.closePath(); ctx.fill();
  }
}

// 地形路由器
function generateMountainPath(ctx,style,layer,horizonY,seed,li,scrollX,w,h,scene){
  switch(style){
    case 'peaks':return pathPeaks(ctx,layer,horizonY,seed,li,scrollX,w);
    case 'dunes':return pathDunes(ctx,layer,horizonY,seed,li,scrollX,w);
    case 'coastline':return pathCoastline(ctx,layer,horizonY,seed,li,scrollX,w,h);
    case 'buildings':return pathBuildings(ctx,layer,horizonY,seed,li,scrollX,w,h,scene);
    case 'flat_grass':return pathFlatGrass(ctx,layer,horizonY,seed,li,scrollX,w);
    case 'hills_gentle':return pathHillsGentle(ctx,layer,horizonY,seed,li,scrollX,w);
    case 'fields':return pathFields(ctx,layer,horizonY,seed,li,scrollX,w);
    case 'snow_fields':return pathSnowFields(ctx,layer,horizonY,seed,li,scrollX,w);
    case 'castle_ruins':return pathCastleRuins(ctx,layer,horizonY,seed,li,scrollX,w,h);
    case 'cottages':return pathCottages(ctx,layer,horizonY,seed,li,scrollX,w);
    case 'rocky':return pathRocky(ctx,layer,horizonY,seed,li,scrollX,w);
    case 'vegetation':return pathVegetation(ctx,layer,horizonY,seed,li,scrollX,w);
    case 'grass_waves':return pathGrassWaves(ctx,layer,horizonY,seed,li,scrollX,w);
    default:return pathHillsGentle(ctx,layer,horizonY,seed,li,scrollX,w);
  }
}

// ══════════════════════════════════════
// 13种地形路径生成函数
// ══════════════════════════════════════

function smoothPathPoint(ctx,x,startX,prevY,y){
  if(x===startX){ctx.lineTo(x,y);}
  else{const cx=(x-3+x)/2;ctx.quadraticCurveTo(x-3,prevY,cx,(prevY+y)/2);}
}

function pathPeaks(ctx,layer,horizonY,seed,li,scrollX,w){
  const startX=Math.floor(scrollX/350)*350-700; let prevY=horizonY;
  for(let x=startX;x<w+700;x+=2.5){
    const nx=x+scrollX,s=seed+li*151;
    const y=horizonY-Math.sin(nx*layer.freq+s)*layer.amplitude
      -Math.pow(Math.sin(nx*layer.freq*3.7+s*2.1),2)*layer.amplitude*0.5
      -Math.sin(nx*layer.freq*8.3+s*4.7)*layer.amplitude*0.15
      -Math.max(0,Math.sin(nx*layer.freq*0.7+s*0.5))*Math.sin(nx*layer.freq*2.3+s*1.1)*layer.amplitude*0.6;
    smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

function pathDunes(ctx,layer,horizonY,seed,li,scrollX,w){
  const startX=Math.floor(scrollX/500)*500-800; let prevY=horizonY;
  for(let x=startX;x<w+800;x+=4){
    const nx=x+scrollX,s=seed+li*113;
    const y=horizonY-Math.sin(nx*layer.freq+s)*layer.amplitude
      -Math.sin(nx*layer.freq*0.6+s*1.4)*layer.amplitude*0.5
      -Math.cos(nx*layer.freq*0.25+s*0.8)*layer.amplitude*0.25;
    smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

function pathCoastline(ctx,layer,horizonY,seed,li,scrollX,w,h){
  const startX=Math.floor(scrollX/300)*300-600; let prevY=horizonY;
  for(let x=startX;x<w+600;x+=3){
    const nx=x+scrollX,s=seed+li*97;
    const y=horizonY-Math.sin(nx*layer.freq*1.5+s)*layer.amplitude*0.4
      -Math.sin(nx*layer.freq*7+s*3)*layer.amplitude*0.08;
    smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

function pathBuildings(ctx,layer,horizonY,seed,li,scrollX,w,h,scene){
  const s=seed+li*173,rng=seededRandom(s);
  const bw=8+rng()*18;
  ctx.moveTo(-10,h+10);
  let currentX=-50+((scrollX*(0.05+li*0.04))%400);
  for(let i=0;i<Math.floor(w/12)+20;i++){
    const bh=rng()*layer.amplitude*2+layer.amplitude*0.3,topVar=horizonY-bh;
    const roofType=rng();
    if(roofType<0.5){ctx.lineTo(currentX,topVar);ctx.lineTo(currentX+bw,topVar);}
    else if(roofType<0.75){const ph=bh*0.25;ctx.lineTo(currentX,topVar);ctx.lineTo(currentX+bw*0.5,topVar-ph);ctx.lineTo(currentX+bw,topVar);}
    else{const sh=bh*0.15;ctx.lineTo(currentX,topVar);ctx.lineTo(currentX+bw*0.3,topVar-sh);ctx.lineTo(currentX+bw*0.7,topVar-sh);ctx.lineTo(currentX+bw,topVar);}
    const gap=2+rng()*6;ctx.lineTo(currentX+bw,horizonY+5);currentX+=bw+gap;
  }ctx.lineTo(w+10,h+10);
}

function pathFlatGrass(ctx,layer,horizonY,seed,li,scrollX,w){
  const startX=Math.floor(scrollX/200)*200-400; let prevY=horizonY;
  for(let x=startX;x<w+400;x+=5){
    const nx=x+scrollX,s=seed+li*83;
    const y=horizonY-Math.sin(nx*layer.freq+s)*layer.amplitude*0.5-Math.sin(nx*layer.freq*3.5+s*2)*layer.amplitude*0.15;
    smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

function pathHillsGentle(ctx,layer,horizonY,seed,li,scrollX,w){
  const startX=Math.floor(scrollX/400)*400-800; let prevY=horizonY;
  for(let x=startX;x<w+800;x+=3){
    const nx=x+scrollX,s=seed+li*137;
    const y=horizonY-Math.sin(nx*layer.freq+s)*layer.amplitude
      -Math.sin(nx*layer.freq*2.17+s*1.3)*layer.amplitude*0.45
      -Math.sin(nx*layer.freq*0.57+s*2.7)*layer.amplitude*0.25
      -Math.pow(Math.sin(nx*layer.freq*4.1+s),2)*layer.amplitude*0.15;
    smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

function pathFields(ctx,layer,horizonY,seed,li,scrollX,w){
  const s=seed+li*127,rng=seededRandom(s),startX=Math.floor(scrollX/250)*250-500;
  ctx.moveTo(startX,horizonY+5);let cx=startX;
  while(cx<w+600){
    const fw=(40+rng()*80)+(rng()*40),fh=rng()*layer.amplitude*1.2+layer.amplitude*0.2,terrace=horizonY-fh;
    ctx.lineTo(cx+fw*0.15,terrace);ctx.lineTo(cx+fw*0.75,terrace+rng()*layer.amplitude*0.08);
    ctx.lineTo(cx+fw,horizonY+3+rng()*3);cx+=fw;
  }ctx.lineTo(w+10,horizonY+5);
}

function pathSnowFields(ctx,layer,horizonY,seed,li,scrollX,w){
  const startX=Math.floor(scrollX/420)*420-850; let prevY=horizonY;
  for(let x=startX;x<w+850;x+=3){
    const nx=x+scrollX,s=seed+li*143;
    const y=horizonY-Math.sin(nx*layer.freq+s)*layer.amplitude
      -Math.cos(nx*layer.freq*0.55+s*1.2)*layer.amplitude*0.5
      -Math.pow(Math.abs(Math.sin(nx*layer.freq*2.9+s*2.3)),1.5)*layer.amplitude*0.35*(Math.sin(nx*layer.freq*0.3+s*0.7)>0.3?1:0);
    smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

function pathCastleRuins(ctx,layer,horizonY,seed,li,scrollX,w,h){
  const s=seed+li*163,rng=seededRandom(s),startX=Math.floor(scrollX/300)*300-600;
  ctx.moveTo(-10,h+10);let cx=startX;
  while(cx<w+600){
    const wallH=rng()*layer.amplitude*0.8+layer.amplitude*0.3,baseY=horizonY-wallH;
    const segW=30+rng()*60;ctx.lineTo(cx,baseY);ctx.lineTo(cx+segW*0.6,baseY+rng()*4);
    if(rng()>0.4){const th=wallH*(0.4+rng()*0.8),tt=rng();
      if(tt<0.5){ctx.lineTo(cx+segW*0.35,baseY-th);ctx.lineTo(cx+segW*0.55,baseY-th);}
      else{ctx.lineTo(cx+segW*0.3,baseY-th*0.8);ctx.lineTo(cx+segW*0.42,baseY-th);ctx.lineTo(cx+segW*0.55,baseY-th*0.8);}
    }ctx.lineTo(cx+segW,horizonY+2+rng()*5);cx+=segW+(3+rng()*10);
  }ctx.lineTo(w+10,h+10);
}

function pathCottages(ctx,layer,horizonY,seed,li,scrollX,w){
  const startX=Math.floor(scrollX/320)*320-650; let prevY=horizonY;
  for(let x=startX;x<w+650;x+=3){
    const nx=x+scrollX,s=seed+li*103;
    const baseY=horizonY-Math.sin(nx*layer.freq+s)*layer.amplitude*0.8-Math.sin(nx*layer.freq*2.1+s*1.5)*layer.amplitude*0.3;
    const roof=(Math.sin(nx*layer.freq*0.15+s*0.3)>0.7)?layer.amplitude*0.25*Math.sin(nx*0.03+s):0;
    const y=baseY-roof;smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

function pathRocky(ctx,layer,horizonY,seed,li,scrollX,w){
  const startX=Math.floor(scrollX/380)*380-760; let prevY=horizonY;
  for(let x=startX;x<w+760;x+=2.5){
    const nx=x+scrollX,s=seed+li*131;
    const y=horizonY-Math.sin(nx*layer.freq+s)*layer.amplitude
      -Math.sin(nx*layer.freq*2.5+s*1.7)*layer.amplitude*0.4
      -Math.abs(Math.sin(nx*layer.freq*5+s*3.5))*layer.amplitude*0.2
      -(Math.sin(nx*layer.freq*11+s*7)>0.6?layer.amplitude*0.12:0);
    smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

function pathVegetation(ctx,layer,horizonY,seed,li,scrollX,w){
  const startX=Math.floor(scrollX/400)*400-800; let prevY=horizonY;
  for(let x=startX;x<w+800;x+=3.5){
    const nx=x+scrollX,s=seed+li*107;
    const y=horizonY-Math.sin(nx*layer.freq+s)*layer.amplitude
      -Math.sin(nx*layer.freq*0.45+s*1.1)*layer.amplitude*0.4
      -Math.sin(nx*layer.freq*3.2+s*2.3)*layer.amplitude*0.12;
    smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

function pathGrassWaves(ctx,layer,horizonY,seed,li,scrollX,w){
  const startX=Math.floor(scrollX/360)*360-720; let prevY=horizonY;
  for(let x=startX;x<w+720;x+=3){
    const nx=x+scrollX,s=seed+li*109;
    const y=horizonY-Math.sin(nx*layer.freq+s)*layer.amplitude
      -Math.sin(nx*layer.freq*1.8+s*1.3)*layer.amplitude*0.35
      -Math.cos(nx*layer.freq*0.6+s*0.9)*layer.amplitude*0.2;
    smoothPathPoint(ctx,x,startX,prevY,y); prevY=y;
  }
}

// ══════════════════════════════════════
// 场景化道路系统（形态随场景变化，颜色仅微调）
//
// 核心设计原则：
//   道路是人物脚下的前景带，它的形态决定场景"质感"。
//   沙漠=沙地+仙人掌、戈壁=土路+碎石、城市=柏油路+路灯...
//   颜色只随昼夜/天气做极微小变化（adjustBright 0.95~1.05）。
// ══════════════════════════════════════

/** 道路调度器：根据 terrainStyle 分发到具体绘制函数 */
function drawSceneRoad(ctx, scrollX, w, h, horizonY, scene, timeData){
  const style=scene.terrainStyle||'hills_gentle';
  const roadTop=horizonY+h*0.02, roadBottom=h;
  const dayB=timeData.dayIntensity; // 0~1

  switch(style){
    case 'dunes':       return drawRoadDesert(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'rocky':      return drawRoadGobi(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'vegetation': return drawRoadOasis(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'coastline':  return drawRoadCoast(ctx,scrollX,w,h,horizonY,roadTop,roadBottom,scene,dayB,timeData);
    case 'buildings':  return drawRoadCity(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'hills_gentle':return drawRoadSuburb(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'cottages':  return drawRoadVillage(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'fields':     return drawRoadFarmland(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'peaks':      return drawRoadMountain(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'flat_grass': return drawRoadPlains(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'grass_waves':return drawRoadGrassland(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'snow_fields':return drawRoadTundra(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    case 'castle_ruins':return drawRoadCastle(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
    default:           return drawRoadSuburb(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB);
  }
}

// ══ 通用辅助：绘制道路基底（窄条渐变带） ══
function _roadBase(ctx,w,roadTop,roadBottom,colorTop,colorBot){
  const g=safeLinearGrad(ctx,0,roadTop,0,roadBottom);
  if(g){g.addColorStop(0,colorTop);g.addColorStop(0.5,colorBot);g.addColorStop(1,colorBot);}
  ctx.fillStyle=g||colorBot;
  ctx.fillRect(0,roadTop,w,roadBottom-roadTop);
}

// ══ 1. 沙漠道路：沙地 + 仙人掌剪影 ══
function drawRoadDesert(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#c4a060',0.92+dayB*0.08),
    adjustBright('#8a6838',0.95+dayB*0.05));
  // 沙丘波纹纹理
  ctx.strokeStyle=`rgba(200,170,100,${0.06+dayB*0.04})`;ctx.lineWidth=1;
  for(let y=roadTop+8;y<roadBottom-3;y+=6+Math.floor(y*0.01)%4){
    const off=(scrollX*0.15+y*0.3)%1; ctx.beginPath();
    ctx.moveTo(0,y);ctx.quadraticCurveTo(w*0.3,y-Math.sin(off*Math.PI)*2,w*0.6,y+Math.sin((off+0.5)*Math.PI)*1.5);
    ctx.quadraticCurveTo(w*0.85,y-Math.sin(off*0.7*Math.PI)*1,w,y);ctx.stroke();
  }
  // 散布仙人掌剪影
  const cSeed=hashCode(scene.id)+999,cCount=Math.floor(w/180)+3;
  for(let i=0;i<cCount;i++){
    const cx=((seededRandom(cSeed+i*777)*w*1.4-scrollX*0.55)%(w+200))-100;
    if(cx<-30||cx>w+30)continue;
    const ch=10+seededRandom(cSeed+i*333)*14,s=ch/20;
    const cy=roadTop+4+seededRandom(cSeed+i*111)*(roadBottom-roadTop-ch-8);
    ctx.fillStyle='#0a0a12';
    // 主干
    ctx.fillRect(cx-s*1.2,cy,s*2.4,ch);
    // 左臂
    ctx.beginPath();ctx.moveTo(cx-s*1.2,cy+ch*0.25);
    ctx.lineTo(cx-s*4*s,cy+ch*0.15);ctx.lineTo(cx-s*3.5*s,cy+ch*0.35);ctx.closePath();ctx.fill();
    // 右臂
    ctx.beginPath();ctx.moveTo(cx+s*1.2,cy+ch*0.3);
    ctx.lineTo(cx+s*4.5*s,cy+ch*0.2);ctx.lineTo(cx+s*4*s,cy+ch*0.4);ctx.closePath();ctx.fill();
    // 上臂
    if(seededRandom(cSeed+i*555)>0.35){
      ctx.beginPath();ctx.moveTo(cx-s*0.8,cy);
      ctx.lineTo(cx-s*3*s,cy-ch*0.15);ctx.lineTo(cx-s*2.5*s,cy+ch*0.05);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(cx+s*0.8,cy);
      ctx.lineTo(cx+s*3.5*s,cy-ch*0.1);ctx.lineTo(cx+s*3*s,cy+ch*0.08);ctx.closePath();ctx.fill();
    }
  }
}

// ══ 2. 戈壁道路：土路 + 碎石块 ══
function drawRoadGobi(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#3a3228',0.93+dayB*0.07),
    adjustBright('#1c1814',0.96+dayB*0.04));
  // 土路裂缝纹理
  ctx.strokeStyle=`rgba(80,68,50,${0.07+dayB*0.03})`;ctx.lineWidth=0.6;
  for(let i=0;i<18;i++){
    const sx=((i*137+hashCode(scene.id))*3.7-scrollX*0.25)%(w+100)-50;
    const sy=roadTop+8+(i*41)%(roadBottom-roadTop-16);
    ctx.beginPath();ctx.moveTo(sx,sy);
    ctx.lineTo(sx+8+seededRandom(i*99)*12,sy+3+seededRandom(i*77)*5);ctx.stroke();
  }
  // 碎石块
  const rkSeed=hashCode(scene.id)+222;
  for(let i=0;i<Math.floor(w/55)+8;i++){
    const rx=((seededRandom(rkSeed+i*151)*w*1.6-scrollX*0.45)%(w+80))-40;
    if(rx<-8||rx>w+8)continue;
    const ry=roadTop+5+seededRandom(rkSeed+i*333)*(roadBottom-roadTop-10);
    const rs=2+seededRandom(rkSeed+i*777)*4;
    ctx.fillStyle='#0a0a12';ctx.beginPath();
    ctx.moveTo(rx,ry-rs);ctx.lineTo(rx+rs*0.8,ry-rs*0.3);ctx.lineTo(rx+rs*0.5,ry);
    ctx.lineTo(rx+rs,ry+rs*0.3);ctx.lineTo(rx+rs*0.2,ry+rs);ctx.lineTo(rx-rs*0.3,ry+rs*0.5);
    ctx.closePath();ctx.fill();
  }
}

// ══ 3. 绿洲道路：泥土小径 + 草丛边缘 ══
function drawRoadOasis(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#2a4030',0.92+dayB*0.08),
    adjustBright('#142018',0.95+dayB*0.05));
  // 泥土小径（比两侧稍亮）
  const pathW=w*0.22,pathCx=w*0.5;
  const pg=safeLinearGrad(ctx,pathCx-pathW*0.5,roadTop,pathCx+pathW*0.5,roadTop);
  if(pg){pg.addColorStop(0,`rgba(0,0,0,0)`);pg.addColorStop(0.2,`rgba(60,90,60,${0.08+dayB*0.05})`);
    pg.addColorStop(0.5,`rgba(80,110,70,${0.12+dayB*0.06})`);pg.addColorStop(0.8,`rgba(60,90,60,${0.08+dayB*0.05})`);
    pg.addColorStop(1,`rgba(0,0,0,0)`);}
  ctx.fillStyle=pg;ctx.fillRect(0,roadTop,w,roadBottom-roadTop);
  // 边缘草丛剪影
  const grSeed=hashCode(scene.id)+444;
  for(let i=0;i<Math.floor(w/28)+10;i++){
    const side=i%2;// 交替左右
    const gx=((seededRandom(grSeed+i*111)*w*1.4-scrollX*0.4)%(w+60))-30;
    if(gx<-5||gx>w+5)continue;
    const gy=side===0?roadTop+1:roadBottom-3-seededRandom(grSeed+i*555)*8;
    const gh=4+seededRandom(grSeed+i*333)*10;
    ctx.fillStyle='#0a0a12';ctx.beginPath();
    ctx.moveTo(gx,gy);ctx.quadraticCurveTo(gx-3,gy-gh*0.6,gx-1,gy-gh);
    ctx.quadraticCurveTo(gx+2,gy-gh*0.5,gx+2,gy);ctx.fill();
  }
}

// ══ 4. 海岸道路：动态海浪 + 波光粼粼（！） ══
function drawRoadCoast(ctx,scrollX,w,h,horizonY,roadTop,roadBottom,scene,dayB,timeData){
  const now=performance.now()/1000;
  // 深色海水基底
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#142838',0.9+dayB*0.1),
    adjustBright('#0a1820',0.94+dayB*0.06));

  // 动态波浪线（3层，不同速度和振幅）
  const waveLayers=[
    {amp:3.5,freq:0.015,speed:0.6,alpha:0.08+dayB*0.06,color:'180,210,230'},
    {amp:2.5,freq:0.022,speed:0.9,alpha:0.06+dayB*0.04,color:'200,220,240'},
    {amp:1.8,freq:0.03,speed:1.3,alpha:0.05+dayB*0.03,color:'220,235,250'}
  ];
  for(const wl of waveLayers){
    ctx.strokeStyle=`rgba(${wl.color},${wl.alpha})`;ctx.lineWidth=wl.amp*0.5;
    ctx.beginPath();
    for(let x=-5;x<=w+5;x+=3){
      const y=roadTop+(roadBottom-roadTop)*0.15
        +Math.sin(x*wl.freq+now*wl.speed+scrollX*0.002)*wl.amp
        +Math.sin(x*wl.freq*2.3+now*wl.speed*1.5+scrollX*0.003)*wl.amp*0.4;
      if(x===-5)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }

  // 波光粼粼闪烁点
  const spSeed=hashCode(scene.id)+888,spCount=Math.floor(w/35)+5;
  for(let i=0;i<spCount;i++){
    const spx=((seededRandom(spSeed+i*123)*w*1.5-scrollX*0.3)%(w+40))-20;
    if(spx<0||spx>w)continue;
    const spy=roadTop+(roadBottom-roadTop)*(0.1+seededRandom(spSeed+i*456)*0.5);
    // 只在特定相位闪烁（不是每帧都亮）
    const phase=(now*2.5+spSeed+i*73)%1;
    const bright=phase<0.15?phase/0.15:(phase>0.9?(1-phase)/0.1:0);
    if(bright<0.03)continue;
    const spr=1+seededRandom(spSeed+i*789)*2.5;
    const sg=safeRadialGrad(ctx,spx,spy,0,spx,spy,spr*3);
    if(sg){sg.addColorStop(0,`rgba(255,255,245,${(bright*0.7).toFixed(3)})`);
      sg.addColorStop(0.4,`rgba(200,225,255,${(bright*0.3).toFixed(3)})`);
      sg.addColorStop(1,'rgba(180,210,240,0)');ctx.fillStyle=sg;
      ctx.beginPath();ctx.arc(spx,spy,spr*3,0,Math.PI*2);ctx.fill();}
  }

  // 前景礁石/沙滩剪影
  const rfSeed=hashCode(scene.id)+666;
  for(let i=0;i<Math.floor(w/120)+2;i++){
    const rx=((seededRandom(rfSeed+i*99)*w*1.3-scrollX*0.5)%(w+100))-50;
    if(rx<-20||rx>w+20)continue;
    const ry=roadBottom-4-seededRandom(rfSeed+i*333)*12;
    const rw=8+seededRandom(rfSeed+i*555)*18,rh=3+seededRandom(rfSeed+i*777)*7;
    ctx.fillStyle='#0a0a12';
    ctx.beginPath();ctx.moveTo(rx,ry);
    ctx.lineTo(rx+rw*0.7,ry-rh*0.4);ctx.lineTo(rx+rw,ry-rh*0.1);
    ctx.lineTo(rx+rw*0.8,ry+rh*0.3);ctx.lineTo(rx+rw*0.3,ry+rh*0.5);ctx.closePath();ctx.fill();
  }
}

// ══ 5. 城市道路：柏油路面 + 路灯 ══
function drawRoadCity(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#1e1e26',0.94+dayB*0.06),
    adjustBright('#101014',0.97+dayB*0.03));
  // 中央标线（白色虚线）
  const ly=roadTop+(roadBottom-roadTop)*0.45;
  ctx.strokeStyle=`rgba(255,255,240,${0.12+dayB*0.08})`;ctx.lineWidth=1.2;
  const dashLen=30,gapLen=20,dashOffset=-(scrollX*0.8)%(dashLen+gapLen);
  let dx=dashOffset;
  while(dx<w+dashLen){
    if(dx>-dashLen&&dx<w)ctx.beginPath(),ctx.moveTo(dx,ly),ctx.lineTo(dx+dashLen,ly),ctx.stroke();
    dx+=dashLen+gapLen;
  }
  // 路灯（远处小→近处略大）
  const lpSeed=hashCode(scene.id)+333;
  for(let i=0;i<Math.floor(w/160)+3;i++){
    const lx=((seededRandom(lpSeed+i*111)*w*1.5-scrollX*0.6)%(w+120))-60;
    if(lx<-15||lx>w+15)continue;
    const lh=12+seededRandom(lpSeed+i*333)*18;
    const ly=roadTop+2+seededRandom(lpSeed+i*555)*4;
    ctx.fillStyle='#0a0a12';
    // 灯杆
    ctx.fillRect(lx,ly-lh,1.5,lh);
    // 灯头
    ctx.beginPath();ctx.arc(lx,ly-lh,2.5,0,Math.PI*2);ctx.fill();
    // 灯光晕（夜间更明显）
    if(dayB<0.5){
      const lg=safeRadialGrad(ctx,lx,ly-lh,0,lx,ly-lh,20);
      if(lg){lg.addColorStop(0,`rgba(255,230,150,${(0.12*(1-dayB)).toFixed(3)})`);
        lg.addColorStop(1,'rgba(255,220,120,0)');ctx.fillStyle=lg;
        ctx.beginPath();ctx.arc(lx,ly-lh,20,0,Math.PI*2);ctx.fill();}
    }
  }
}

// ══ 6. 郊外道路：乡间泥土路 ══
function drawRoadSuburb(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#243828',0.92+dayB*0.08),
    adjustBright('#141c14',0.95+dayB*0.05));
  // 泥土路中央隆起（隐约）
  const pg=safeLinearGrad(ctx,0,roadTop,0,roadBottom);
  if(pg){pg.addColorStop(0,'rgba(0,0,0,0)');pg.addColorStop(0.35,`rgba(70,100,60,${0.04+dayB*0.03})`);
    pg.addColorStop(0.5,`rgba(80,110,65,${0.06+dayB*0.04})`);
    pg.addColorStop(0.65,`rgba(70,100,60,${0.04+dayB*0.03})`);pg.addColorStop(1,'rgba(0,0,0,0)');}
  ctx.fillStyle=pg;ctx.fillRect(0,roadTop,w,roadBottom-roadTop);
  // 小石子
  const pkSeed=hashCode(scene.id)+777;
  for(let i=0;i<Math.floor(w/70)+5;i++){
    const px=((seededRandom(pkSeed+i*231)*w*1.4-scrollX*0.4)%(w+50))-25;
    if(px<-4||px>w+4)continue;
    const py=roadTop+6+seededRandom(pkSeed+i*555)*(roadBottom-roadTop-12);
    const ps=1+seededRandom(pkSeed+i*999)*2.5;
    ctx.fillStyle='rgba(10,10,18,0.6)';ctx.beginPath();ctx.arc(px,py,ps,0,Math.PI*2);ctx.fill();
  }
}

// ══ 7. 村庄道路：泥土路 + 远处屋影 ══
function drawRoadVillage(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#3a3428',0.92+dayB*0.08),
    adjustBright('#1c1810',0.95+dayB*0.05));
  // 屋顶剪影（远景，低对比度）
  const ctSeed=hashCode(scene.id)+555;
  for(let i=0;i<Math.floor(w/200)+2;i++){
    const cx=((seededRandom(ctSeed+i*177)*w*1.6-scrollX*0.35)%(w+150))-75;
    if(cx<-30||cx>w+30)continue;
    const cw=20+seededRandom(ctSeed+i*333)*30,ch=8+seededRandom(ctSeed+i*777)*14;
    const cy=roadTop+2+seededRandom(ctSeed+i*999)*3;
    ctx.fillStyle='#0a0a12';
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+cw*0.4,cy-ch);
    ctx.lineTo(cx+cw*0.6,cy-ch);ctx.lineTo(cx+cw,cy);ctx.closePath();ctx.fill();
  }
}

// ══ 8. 农田道路：田垄土路 + 栅栏 ══
function drawRoadFarmland(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#2a3824',0.92+dayB*0.08),
    adjustBright('#161c12',0.95+dayB*0.05));
  // 田垄横线（暗示农田）
  ctx.strokeStyle=`rgba(50,70,40,${0.06+dayB*0.04})`;ctx.lineWidth=0.8;
  const rowH=10+Math.floor(scrollX*0.05)%6,rowOff=-(scrollX*0.15)%rowH;
  for(let y=roadTop+5+rowOff;y<roadBottom-3;y+=rowH){
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y+(seededRandom(Math.floor(y))*2-1));ctx.stroke();
  }
  // 栅栏柱（右侧）
  const fcSeed=hashCode(scene.id)+888;
  for(let i=0;i<Math.floor(w/90)+3;i++){
    const fx=((seededRandom(fcSeed+i*199)*w*1.3-scrollX*0.5)%(w+60))-30;
    if(fx<-5||fx>w+5)continue;
    const fh=8+seededRandom(fcSeed+i*377)*10;
    const fy=roadTop+3+seededRandom(fcSeed+i*777)*(roadBottom-roadTop-fh-5);
    ctx.fillStyle='#0a0a12';ctx.fillRect(fx,fy,2,fh);
    // 横栏（每3根一根）
    if(i%3===0){ctx.fillRect(fx-6,fy+fh*0.35,14,1.2);ctx.fillRect(fx-6,fy+fh*0.7,14,1.2);}
  }
}

// ══ 9. 山区道路：碎石小径 ══
function drawRoadMountain(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#28282e',0.93+dayB*0.07),
    adjustBright('#141418',0.96+dayB*0.04));
  // 碎石颗粒
  const stSeed=hashCode(scene.id)+444;
  for(let i=0;i<Math.floor(w/40)+12;i++){
    const sx=((seededRandom(stSeed+i*277)*w*1.5-scrollX*0.42)%(w+40))-20;
    if(sx<-3||sx>w+3)continue;
    const sy=roadTop+4+seededRandom(stSeed+i*666)*(roadBottom-roadTop-8);
    const ss=1+seededRandom(stSeed+i*888)*3;
    ctx.fillStyle='rgba(10,10,18,0.5)';ctx.beginPath();ctx.arc(sx,sy,ss,0,Math.PI*2);ctx.fill();
  }
}

// ══ 10. 平原道路：极简草地 ══
function drawRoadPlains(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#285830',0.91+dayB*0.09),
    adjustBright('#143818',0.94+dayB*0.06));
  // 野花点
  const wfSeed=hashCode(scene.id)+333;
  for(let i=0;i<Math.floor(w/50)+6;i++){
    const wx=((seededRandom(wfSeed+i*155)*w*1.4-scrollX*0.35)%(w+40))-20;
    if(wx<-3||wx>w+3)continue;
    const wy=roadTop+3+seededRandom(wfSeed+i*444)*(roadBottom-roadTop-6);
    if(seededRandom(wfSeed+i*777)>0.6){
      ctx.fillStyle=`rgba(10,10,18,${0.3+seededRandom(wfSeed+i*888)*0.4})`;
      ctx.beginPath();ctx.arc(wx,wy,1+seededRandom(wfSeed+i*999),0,Math.PI*2);ctx.fill();
    }
  }
}

// ══ 11. 草原道路：草浪 + 野花 ══
function drawRoadGrassland(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#305828',0.91+dayB*0.09),
    adjustBright('#182814',0.94+dayB*0.06));
  // 草叶剪影（随风摆动暗示）
  const gsSeed=hashCode(scene.id)+666;
  for(let i=0;i<Math.floor(w/18)+15;i++){
    const gx=((seededRandom(gsSeed+i*211)*w*1.4-scrollX*0.32)%(w+30))-15;
    if(gx<-2||gx>w+2)continue;
    const gy=roadBottom-2-seededRandom(gsSeed+i*444)*10;
    const gh=3+seededRandom(gsSeed+i*777)*8;
    const lean=Math.sin(performance.now()/1000*0.8+gx*0.02+i)*2;
    ctx.fillStyle='#0a0a12';ctx.beginPath();
    ctx.moveTo(gx,gy);ctx.quadraticCurveTo(gx+lean,gy-gh*0.6,gx+lean*0.5,gy-gh);
    ctx.quadraticCurveTo(gx+lean*0.3,gy-gh*0.4,gx+1,gy);ctx.fill();
  }
}

// ══ 12. 冰原道路：雪地 + 冰裂纹 ══
function drawRoadTundra(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#b8c8d8',0.9+dayB*0.1),
    adjustBright('#586878',0.94+dayB*0.06));
  // 冰裂纹
  ctx.strokeStyle=`rgba(80,100,120,${0.1+dayB*0.05})`;ctx.lineWidth=0.6;
  const crSeed=hashCode(scene.id)+777;
  for(let i=0;i<12;i++){
    const cx=((seededRandom(crSeed+i*133)*w*1.3-scrollX*0.3)%(w+60))-30;
    const cy=roadTop+8+seededRandom(crSeed+i*333)*(roadBottom-roadTop-16);
    const clen=8+seededRandom(crSeed+i*555)*20;
    const cang=seededRandom(crSeed+i*999)*Math.PI*2;
    ctx.beginPath();ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(cang)*clen,cy+Math.sin(cang)*clen*0.6);ctx.stroke();
    if(seededRandom(crSeed+i*777)>0.5){// 分叉
      ctx.beginPath();ctx.moveTo(cx+Math.cos(cang)*clen*0.5,cy+Math.sin(cang)*clen*0.3);
      ctx.lineTo(cx+Math.cos(cang+0.8)*clen*0.6,cy+Math.sin(cang+0.8)*clen*0.35);ctx.stroke();}
  }
  // 雪粒
  for(let i=0;i<Math.floor(w/30)+10;i++){
    const sx=((seededRandom(crSeed+i*111)*w*1.4-scrollX*0.25)%(w+30))-15;
    if(sx<0||sx>w)continue;
    const sy=roadTop+3+seededRandom(crSeed+i*222)*(roadBottom-roadTop-6);
    ctx.fillStyle=`rgba(200,215,230,${0.15+dayB*0.1})`;
    ctx.beginPath();ctx.arc(sx,sy,0.5+seededRandom(crSeed+i*333)*1.2,0,Math.PI*2);ctx.fill();
  }
}

// ══ 13. 城堡道路：石板路 + 碎石 ══
function drawRoadCastle(ctx,scrollX,w,h,roadTop,roadBottom,scene,dayB){
  _roadBase(ctx,w,roadTop,roadBottom,
    adjustBright('#2e2a24',0.93+dayB*0.07),
    adjustBright('#181612',0.96+dayB*0.04));
  // 石板接缝线
  ctx.strokeStyle=`rgba(60,54,44,${0.08+dayB*0.04})`;ctx.lineWidth=0.8;
  const slW=40+Math.floor(scrollX*0.08)%20,slOff=-(scrollX*0.4)%slW;
  for(let sx=slOff;sx<w+slW;sx+=slW){
    ctx.beginPath();ctx.moveTo(sx,roadTop+2);ctx.lineTo(sx,roadBottom-2);ctx.stroke();
  }
  // 不规则石板边界
  ctx.strokeStyle=`rgba(60,54,44,0.05)`;ctx.lineWidth=0.5;
  for(let sy=roadTop+12;sy<roadBottom-5;sy+=15+Math.floor(sy*0.07)%8){
    ctx.beginPath();ctx.moveTo(5,sy);ctx.lineTo(w-5,sy+seededRandom(sy)*3-1.5);ctx.stroke();
  }
}
// ══════════════════════════════════════
//
// 设计要点（黑名单#5/#6）：
//   远山是远景剪影，必须绘制在天空之后、地面之前。
//   这样前景地面（在 foreground 层绘制）会自然盖住山脚，
//   形成正确的景深关系，而不是把山画在路面之上。
function renderMountains(ctx,c){
  const {scrollX,time:timeData}=c;
  const scene=sceneManager.getCurrentScene();
  if(!scene)return;
  const blend=sceneManager.getBlendFactor();
  const nextScene=blend>0?sceneManager.getNextScene():null;
  drawMountains3Layer(ctx,scrollX,c.width,c.height,scene,nextScene,blend,timeData);
  // 阴天压暗远山（overcast 越高越暗）
  const oc=c.weather?c.weather.overcast:0;
  if(oc>0.05){
    ctx.fillStyle=`rgba(10,12,20,${(oc*0.28).toFixed(3)})`;
    ctx.fillRect(0,0,c.width,c.height*0.74);
  }
}

// ══════════════════════════════════════
// 主入口：渲染地面 + 水平路面（前景层）
// ══════════════════════════════════════
//
// 水平延展（黑名单#1：禁止透视收缩的梯形道路），全屏贯通。
function renderGround(ctx,c){
  const {width,height,scrollX,time:timeData}=c;
  const scene=sceneManager.getCurrentScene();
  if(!scene)return;

  const blend=sceneManager.getBlendFactor();
  const nextScene=blend>0?sceneManager.getNextScene():null;
  // 道路收窄：从30%→22%屏幕高度，让后景更广阔
  const horizonY=height*0.78;

  // 地面主体（过渡插值，仅极微弱的昼夜影响）
  let gTop=scene.groundTop,gBot=scene.groundBottom;
  if(nextScene){gTop=lerpColor(scene.groundTop,nextScene.groundTop,blend);gBot=lerpColor(scene.groundBottom,nextScene.groundBottom,blend);}

  // 地面渐变（很薄的过渡层，大部分空间留给场景化道路）
  const groundGrad=safeLinearGrad(ctx,0,horizonY-2,0,height);
  if(groundGrad){
    groundGrad.addColorStop(0,adjustBright(gTop,1.02));
    groundGrad.addColorStop(0.15,gTop);
    groundGrad.addColorStop(1,gBot);
    ctx.fillStyle=groundGrad;
    ctx.fillRect(0,horizonY-2,width,height-horizonY+2);
  }

  // 场景化道路（形态随 terrainStyle 变化，不是换色！）
  drawSceneRoad(ctx,scrollX,width,height,horizonY,scene,timeData);

  // 阴天压暗地面（与远山统一变暗，强化阴晴明暗联动）
  const oc=c.weather?c.weather.overcast:0;
  if(oc>0.05){
    ctx.fillStyle=`rgba(8,10,18,${(oc*0.22).toFixed(3)})`;
    ctx.fillRect(0,horizonY-2,width,height-horizonY+2);
  }
}
