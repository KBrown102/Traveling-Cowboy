/**
 * ForegroundObjects.js - 前景物体模块
 *
 * 20种世界坐标系流动物体（从右向左扫过屏幕）：
 *   石头、草丛、灌木、高草、野花、小野花、枯萎灌木、动物骨头、
 *   冰岩、雪草、枯死灌木、松果、干草捆、栅栏柱、大灌木、蕨类、
 *   路标牌、垃圾废弃物
 *
 * 每个场景类型有独特的物体分布组合。
 */

// ══════════════════════════════════════
// 物体缓存与生成
// ══════════════════════════════════════

let _fgObjectsCache = {};

function getForegroundObjects(sceneId, w, h) {
  const cacheKey = sceneId+'_'+Math.floor(w/128)+'_'+Math.floor(h/128);
  if (_fgObjectsCache[cacheKey]) return _fgObjectsCache[cacheKey];

  const seed = hashCode(sceneId), rng = seededRandom(seed+9999);
  const objects = [], worldWidth = w*6;

  let sceneType;
  if (sceneId.includes('city')||sceneId.includes('城市')) sceneType='urban';
  else if (sceneId.includes('desert')||sceneId.includes('沙漠')||sceneId.includes('戈壁')) sceneType='arid';
  else if (sceneId.includes('ice')||sceneId.includes('冰原')) sceneType='snowy';
  else if (sceneId.includes('farm')||sceneId.includes('农田')) sceneType='farmland';
  else if (sceneId.includes('oasis')||sceneId.includes('绿洲')) sceneType='lush';
  else sceneType='generic';

  const count = 140 + Math.floor(rng()*80);
  for(let i=0;i<count;i++){
    const wx=rng()*worldWidth, roll=rng(), size=0.5+rng()*1.5, yBias=Math.pow(rng(),0.7);
    let type;
    if(sceneType==='urban'){type=roll<0.35?'rock':roll<0.55?'bush':roll<0.75?'grass_cluster':roll<0.90?'sign':'trash';}
    else if(sceneType==='arid'){type=roll<0.40?'rock':roll<0.60?'bone':roll<0.80?'dead_shrub':'grass_cluster';}
    else if(sceneType==='snowy'){type=roll<0.30?'ice_rock':roll<0.55?'snow_grass':roll<0.75?'dead_bush':'pine_cone';}
    else if(sceneType==='farmland'){type=roll<0.25?'rock':roll<0.50?'hay_bale':roll<0.75?'fence_post':'grass_cluster';}
    else if(sceneType==='lush'){type=roll<0.20?'rock':roll<0.45?'flower':roll<0.70?'big_bush':'fern';}
    else{type=roll<0.30?'rock':roll<0.55?'grass_cluster':roll<0.78?'bush':'wild_flower';}

    objects.push({type,wx,size,yBias,variant:Math.floor(rng()*3),seed:seed+i*137});
  }
  objects.sort((a,b)=>a.yBias-b.yBias);
  _fgObjectsCache[cacheKey]=objects; return objects;
}

// ══════════════════════════════════════
// 绘制调度函数
// ══════════════════════════════════════

function drawForegroundObjects(ctx, scrollX, w, h, horizonY, scene){
  const objects=getForegroundObjects(scene.id,w,h);if(!objects.length)return;
  const parallax=1.0, visibleLeft=scrollX*parallax-w*0.5, visibleRight=scrollX*parallax+w*1.5;
  const groundColor=adjustBright(scene.groundBottom,1.15);

  for(const obj of objects){
    if(obj.wx<visibleLeft-50 || obj.wx>visibleRight+50) continue;
    const sx=obj.wx-scrollX*parallax, sy=horizonY+h*(0.05+obj.yBias*0.42);
    switch(obj.type){
      case 'rock':drawRockSil(ctx,sx,sy,obj.size,obj.seed);break;
      case 'grass_cluster':drawGrassClu(ctx,sx,sy,obj.size,obj.seed,groundColor);break;
      case 'bush':drawBushSil(ctx,sx,sy,obj.size,obj.seed,groundColor);break;
      case 'tall_grass':drawTallGrassSil(ctx,sx,sy,obj.size,obj.seed,groundColor);break;
      case 'flower':drawFlowerSil(ctx,sx,sy,obj.size,obj.seed);break;
      case 'wild_flower':drawWildFlower(ctx,sx,sy,obj.size,obj.seed);break;
      case 'dead_shrub':drawDeadShrub(ctx,sx,sy,obj.size,obj.seed,adjustBright(scene.groundBottom,0.85));break;
      case 'bone':drawBone(ctx,sx,sy,obj.size,obj.seed);break;
      case 'ice_rock':drawIceRock(ctx,sx,sy,obj.size,obj.seed);break;
      case 'snow_grass':drawSnowGrass(ctx,sx,sy,obj.size,obj.seed);break;
      case 'dead_bush':drawDeadBush(ctx,sx,sy,obj.size,obj.seed);break;
      case 'pine_cone':drawPineCone(ctx,sx,sy,obj.size,obj.seed);break;
      case 'hay_bale':drawHayBale(ctx,sx,sy,obj.size,obj.seed,groundColor);break;
      case 'fence_post':drawFencePost(ctx,sx,sy,obj.size,obj.seed);break;
      case 'big_bush':drawBigBush(ctx,sx,sy,obj.size,obj.seed,groundColor);break;
      case 'fern':drawFernSil(ctx,sx,sy,obj.size,obj.seed,groundColor);break;
      case 'sign':drawSignPost(ctx,sx,sy,obj.size,obj.seed);break;
      case 'trash':drawTrash(ctx,sx,sy,obj.size,obj.seed);break;
      default:drawGrassClu(ctx,sx,sy,obj.size,obj.seed,groundColor);
    }
  }
}

// ══════════════════════════════════════
// 20种物体绘制函数
// ══════════════════════════════════════

function drawRockSil(ctx,x,y,s,seed){
  ctx.fillStyle='#0a0a10';ctx.beginPath();
  const r=seededRandom(seed+1),r2=seededRandom(seed+2),r3=seededRandom(seed+3),r4=seededRandom(seed+4);
  const p=[[x-s*5*r(),y-s*1.5*r2()],[x-s*3.5*r3(),y-s*4*r()],[x-s*0.8*r4(),y-s*4.5*r2()],[x+s*2*r(),y-s*3.8*r3()],[x+s*4.5*r2(),y-s*2.5*r()],[x+s*5*r3(),y-s*0.8*r4()],[x+s*3*r(),y+s*0.5],[x+s*1*r4(),y+s*0.3],[x-s*2*r2(),y+s*0.4]];
  ctx.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)ctx.lineTo(p[i][0],p[i][1]);
  ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=0.5;ctx.stroke();
}

function drawGrassClu(ctx,x,y,s,seed,color){
  ctx.strokeStyle=color;ctx.lineCap='round';
  const blades=4+Math.floor(s*4);
  for(let i=0;i<blades;i++){
    const is=seededRandom(seed+i*7),h=(4+is()*14)*s,angle=(is()-0.5)*0.8,curve=(is()-0.5)*h*0.4;
    ctx.lineWidth=0.6+is()*1.2*s;ctx.beginPath();ctx.moveTo(x+(is()-0.5)*s*2,y);
    ctx.quadraticCurveTo(x+Math.sin(angle)*h*0.5+curve,y-h*0.55,x+Math.sin(angle)*h*0.8+curve*1.2,y-h);ctx.stroke();
  }ctx.lineCap='butt';
}

function drawBushSil(ctx,x,y,s,seed,color){
  ctx.fillStyle=color;ctx.beginPath();
  const circles=4+Math.floor(s*3);
  for(let i=0;i<circles;i++){const is=seededRandom(seed+i*11),cx=x+(is()-0.5)*s*12,cy=y-(is()*0.7+0.3)*s*9,cr=(2+is()*5)*s;ctx.moveTo(cx+cr,cy);ctx.arc(cx,cy,cr,0,Math.PI*2);}
  ctx.fill();
}

function drawTallGrassSil(ctx,x,y,s,seed,color){
  ctx.strokeStyle=color;ctx.lineCap='round';
  const stems=2+Math.floor(s*2);
  for(let i=0;i<stems;i++){
    const is=seededRandom(seed+i*13),h=(12+is()*22)*s,lean=(is()-0.5)*s*10;
    ctx.lineWidth=0.8+s*is()*1.5;ctx.beginPath();ctx.moveTo(x+(i-stems/2)*s*2,y);
    ctx.quadraticCurveTo(x+lean*0.4+(i-stems/2)*s,y-h*0.45,x+lean,y-h);ctx.stroke();
    const ld=i%2===0?-1:1;ctx.lineWidth=0.5+s*0.8;ctx.beginPath();
    ctx.moveTo(x+lean,y-h);ctx.quadraticCurveTo(x+lean+ld*s*5,y-h+s*4,x+lean+ld*s*7,y-h+s*8);ctx.stroke();
  }ctx.lineCap='butt';
}

function drawFlowerSil(ctx,x,y,s,seed){
  const is=seededRandom(seed),stemH=(8+is()*18)*s,lean=(seededRandom(seed+1)()-0.5)*s*6;
  ctx.strokeStyle='#0a0a10';ctx.lineWidth=0.6*s;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+lean*0.4,y-stemH*0.5,x+lean,y-stemH);ctx.stroke();
  ctx.fillStyle='#0a0a10';ctx.beginPath();ctx.arc(x+lean,y-stemH,s*2.5,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#0a0a10';ctx.lineWidth=0.5*s;const ly=y-stemH*0.4,ls=s*4;
  ctx.beginPath();ctx.moveTo(x+lean*0.3,ly);ctx.quadraticCurveTo(x+lean*0.3-ls,ly-ls*0.3,x+lean*0.3-ls*0.8,ly+ls*0.2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x+lean*0.3,ly);ctx.quadraticCurveTo(x+lean*0.3+ls,ly-ls*0.2,x+lean*0.3+ls*0.8,ly+ls*0.3);ctx.stroke();ctx.lineCap='butt';
}

function drawWildFlower(ctx,x,y,s,seed){
  ctx.fillStyle='#0a0a10';const is=seededRandom(seed),h=(5+is()*10)*s;
  ctx.strokeStyle='#0a0a10';ctx.lineWidth=0.4*s;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+(is()-0.5)*s*3,y-h*0.5,x+(is()-0.5)*s*4,y-h);ctx.stroke();ctx.beginPath();
  const pc=3+Math.floor(is()*4);for(let p=0;p<pc;p++){const pa=(p/pc)*Math.PI*2,px=x+(is()-0.5)*s*4+Math.cos(pa)*s*1.5,py=y-h+Math.sin(pa)*s*1.5;ctx.moveTo(px+s,py);ctx.arc(px,py,s*1.2,0,Math.PI*2);}ctx.fill();
}

function drawDeadShrub(ctx,x,y,s,seed,color){
  ctx.strokeStyle=color;ctx.lineWidth=0.7*s;ctx.lineCap='round';
  const branches=5+Math.floor(s*5);
  for(let i=0;i<branches;i++){const is=seededRandom(seed+i*17),h=(3+is()*8)*s,angle=(is()-0.5)*1.4;ctx.beginPath();ctx.moveTo(x+(is()-0.5)*s*3,y);ctx.lineTo(x+(is()-0.5)*s*3+Math.sin(angle)*h,y-h);ctx.stroke();}
  ctx.lineCap='butt';
}

function drawBone(ctx,x,y,s,seed){
  ctx.strokeStyle='rgba(180,175,165,0.25)';ctx.lineWidth=1.2*s;ctx.lineCap='round';
  const is=seededRandom(seed),len=(6+is()*14)*s,angle=(is()-0.5)*0.8;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  ctx.beginPath();ctx.moveTo(-len*0.4,0);ctx.lineTo(len*0.4,0);ctx.stroke();
  const ballR=s*2;ctx.beginPath();ctx.arc(-len*0.45,0,ballR,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(len*0.45,0,ballR,0,Math.PI*2);ctx.stroke();
  ctx.restore();ctx.lineCap='butt';
}

function drawIceRock(ctx,x,y,s,seed){
  ctx.fillStyle='#0c0c14';ctx.beginPath();
  const is=seededRandom(seed);
  const pts=[[x-s*5*is(),y],[x-s*4*seededRandom(seed+1)(),y-s*3*is()],[x-s,y-s*6*seededRandom(seed+2)()],[x+s*2*is(),y-s*7*is()],[x+s*4*seededRandom(seed+3)(),y-s*4*is()],[x+s*5.5*is(),y-s*1.5],[x+s*4*seededRandom(seed+4)(),y+s*0.5]];
  ctx.moveTo(pts[0][0],pts[0][1]);for(let p=1;p<pts.length;p++)ctx.lineTo(pts[p][0],pts[p][1]);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(200,220,255,0.08)';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(pts[2][0],pts[2][1]);ctx.lineTo(pts[3][0],pts[3][1]);ctx.stroke();
}

function drawSnowGrass(ctx,x,y,s,seed){
  ctx.strokeStyle='rgba(220,225,235,0.15)';ctx.lineWidth=0.6*s;ctx.lineCap='round';
  const count=3+Math.floor(s*4);for(let i=0;i<count;i++){const is=seededRandom(seed+i*19),h=(2+is()*5)*s;ctx.beginPath();ctx.moveTo(x+(is()-0.5)*s*4,y);ctx.quadraticCurveTo(x+(is()-0.5)*s*6,y-h*0.6,x+(is()-0.5)*s*7,y-h);ctx.stroke();}
  ctx.fillStyle='rgba(200,210,230,0.07)';ctx.beginPath();ctx.ellipse(x,y+1,s*5,s*1.5,0,0,Math.PI*2);ctx.fill();ctx.lineCap='butt';
}

function drawDeadBush(ctx,x,y,s,seed){
  ctx.strokeStyle='rgba(40,35,32,0.5)';ctx.lineWidth=0.8*s;ctx.lineCap='round';
  const branches=6+Math.floor(s*6);for(let i=0;i<branches;i++){const h=(2+seededRandom(seed+i*23)()*6)*s,ang=(seededRandom(seed+i*31)()-0.5)*1.6;ctx.beginPath();ctx.moveTo(x+(seededRandom(seed+i*37)()-0.5)*s*4,y);ctx.lineTo(x+(seededRandom(seed+i*43)()-0.5)*s*4+Math.sin(ang)*h,y-h*0.8);ctx.stroke();}
  ctx.lineCap='butt';
}

function drawPineCone(ctx,x,y,s,seed){
  ctx.fillStyle='#0e0c0a';ctx.beginPath();
  const is=seededRandom(seed),length=(5+is()*8)*s,width=s*3;
  ctx.ellipse(x,y-length*0.5,width,length,(is()-0.5)*0.3,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(60,50,40,0.3)';ctx.lineWidth=0.3;
  const scales=4+Math.floor(s*3);for(let sc=0;sc<scales;sc++){const sy=y-(sc/scales)*length,sw=width*(1-sc/scales*0.6);ctx.beginPath();ctx.moveTo(x-sw,sy);ctx.lineTo(x+sw,sy);ctx.stroke();}
}

function drawHayBale(ctx,x,y,s,seed,color){
  ctx.fillStyle=color;ctx.beginPath();const bw=s*10,bh=s*6,br=s*2;
  ctx.moveTo(x-bw/2+br,y-bh);ctx.arcTo(x+bw/2,y-bh,x+bw/2,y-bh+br,br);
  ctx.arcTo(x+bw/2,y,x-bw/2+br,y,br);ctx.arcTo(x-bw/2,y-bh+br,x-bw/2,y-bh,br);ctx.closePath();ctx.fill();
  ctx.strokeStyle=adjustBright(color,0.6);ctx.lineWidth=0.5;
  ['0','-0.25','0.25'].forEach(off=>{ctx.beginPath();ctx.moveTo(x+parseFloat(off)*bw,y-bh+1);ctx.lineTo(x+parseFloat(off)*bw,y-1);ctx.stroke();});
}

function drawFencePost(ctx,x,y,s,seed){
  ctx.fillStyle='#0a0a10';const ph=(10+seededRandom(seed+999)*16)*s,pw=s*2;
  ctx.fillRect(x-pw/2,y-ph,pw,ph+2);if(seededRandom(seed+1)()>0.4){const railH=ph*(0.25+seededRandom(seed+2)()*0.15);ctx.fillRect(x-pw*1.5,y-railH,pw*3,s*1.2);}
}

function drawBigBush(ctx,x,y,s,seed,color){
  ctx.fillStyle=color;ctx.beginPath();const is=seededRandom(seed);
  [[0,0,s*8],[-s*5,s*2,s*6],[s*5,s*1,s*5.5],[-s*3,-s*4,s*5],[s*4,-s*3,s*4.5],[0,-s*6,s*4],[-s*6,-s*2,s*3.5],[s*7,-s*1,s*3]].forEach(c=>{const cx=x+c[0]*is(),cy=y+c[1]*is();ctx.moveTo(cx+c[2],cy);ctx.arc(cx,cy,c[2]*(0.8+is()*0.4),0,Math.PI*2);});ctx.fill();
}

function drawFernSil(ctx,x,y,s,seed,color){
  ctx.strokeStyle=color;ctx.lineWidth=0.6*s;ctx.lineCap='round';
  const fronds=3+Math.floor(s*4);for(let f=0;f<fronds;f++){const is=seededRandom(seed+f*29),fh=(6+is()*14)*s,fa=(f-fronds/2)*0.25,bx=x+Math.sin(fa)*s*2;
  ctx.beginPath();ctx.moveTo(bx,y);ctx.quadraticCurveTo(bx+Math.sin(fa)*s*4,y-fh*0.5,bx+Math.sin(fa)*s*6,y-fh);
  const lc=4+Math.floor(fh/4);for(let l=1;l<=lc;l++){const lt=l/lc,lx=bx+Math.sin(fa)*s*6*lt,ly=y-fh*lt,ll=s*3*(1-lt*0.5);ctx.moveTo(lx,ly);ctx.quadraticCurveTo(lx-ll,ly-s,lx-ll*0.8,ly+s);ctx.moveTo(lx,ly);ctx.quadraticCurveTo(lx+ll,ly-s,lx+ll*0.8,ly+s);}ctx.stroke();}
  ctx.lineCap='butt';
}

function drawSignPost(ctx,x,y,s,seed){
  ctx.fillStyle='#0a0a10';const is=seededRandom(seed),postH=(12+is()*16)*s;
  ctx.fillRect(x-s*0.6,y-postH,s*1.2,postH+2);const signW=s*8,signH=s*4,signAngle=(is()-0.5)*0.3;
  ctx.save();ctx.translate(x,y-postH+s*2);ctx.rotate(signAngle);ctx.fillRect(-signW/2,-signH,signW,signH);ctx.fillStyle='rgba(255,255,255,0.04)';
  for(let t=0;t<3;t++)ctx.fillRect(-signW*0.35,-signH+s*(1+t*1.2),signW*0.7,s*0.5);ctx.restore();
}

function drawTrash(ctx,x,y,s,seed){
  ctx.fillStyle='#0c0c12';const is=seededRandom(seed),tt=Math.floor(is()*3);
  if(tt===0){ctx.beginPath();ctx.ellipse(x,y-s*3,s*1.5,s*5,0.1,0,Math.PI*2);ctx.fill();ctx.fillRect(x-s*0.5,y-s*7,s,s*3);}
  else if(tt===1){ctx.fillRect(x-s*2,y-s*6,s*4,s*6);ctx.fillRect(x-s*2.5,y-s*5,s,s*4);}
  else{ctx.beginPath();ctx.arc(x,y-s*2,s*3,0,Math.PI*2);ctx.arc(x+s*2,y-s*3,s*2.5,0,Math.PI*2);ctx.fill();}
}

// ══════════════════════════════════════
// 主入口：渲染前景物体
// ══════════════════════════════════════

function renderForegroundObjects(ctx,c){
  const {width,height,scrollX,time:timeData}=c;
  const scene=sceneManager.getCurrentScene();
  if(!scene)return;
  const horizonY=height*0.70;
  drawForegroundObjects(ctx,scrollX,width,height,horizonY,scene);
}
