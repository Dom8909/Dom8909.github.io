// Neuroevolution: a fleet of vessels learns to run a winding channel. Each vessel is driven by
// a small neural network; the networks improve over generations through a genetic algorithm.
// Both are written from scratch and tuned to run on very low-end hardware (Raspberry Pi class):
// object pooling and shared buffers mean zero per-frame allocation, a 1-byte collision mask,
// squared-distance checks, and a small 4-sensor / 6-hidden network.
(function(){
  const reduce = PF.reduce;
  const sim = document.getElementById('neuroSim'); if(!sim) return;
  const brain = document.getElementById('neuroBrain');
  const elGen = document.getElementById('neuroGen'), elAlive = document.getElementById('neuroAlive'), elBest = document.getElementById('neuroBest');
  const btnSpeed = document.getElementById('neuroSpeed'), btnNew = document.getElementById('neuroNew');

  // scale the fleet to the device; a runtime guard (below) trims it further if frames run slow
  const LITE = (navigator.hardwareConcurrency||2) < 6 || matchMedia('(pointer:coarse)').matches || innerWidth < 760;
  let POP = LITE?34:60;
  const N_SENS=4, INPUTS=N_SENS+1, HID=6, OUTS=2;
  const SENS_ANG=[-1.0,-0.35,0.35,1.0], SENS_RANGE=120, RAY_STEP=6;
  const MAX_SPEED=2.5, TURN=0.075, CHAN_W=42, GEN_FRAMES=750, CP2=(CHAN_W*0.72)*(CHAN_W*0.72);
  const MUT_RATE=0.12, MUT_AMT=0.5, ELITE=0.16, KEYS=['w1','b1','w2','b2'];

  // ---- neural network (flat weight arrays; forward writes into supplied buffers, never allocates) ----
  function rnd(n){ const a=new Float32Array(n); for(let i=0;i<n;i++) a[i]=Math.random()*2-1; return a; }
  function newNet(){ return { w1:rnd(INPUTS*HID), b1:rnd(HID), w2:rnd(HID*OUTS), b2:rnd(OUTS) }; }
  function forward(nn, inp, hOut, oOut){
    for(let j=0;j<HID;j++){ let s=nn.b1[j]; for(let i=0;i<INPUTS;i++) s+=inp[i]*nn.w1[i*HID+j]; hOut[j]=Math.tanh(s); }
    let o0=nn.b2[0], o1=nn.b2[1];
    for(let j=0;j<HID;j++){ o0+=hOut[j]*nn.w2[j*OUTS]; o1+=hOut[j]*nn.w2[j*OUTS+1]; }
    oOut[0]=Math.tanh(o0); oOut[1]=Math.tanh(o1);
  }
  function copyW(dst,src){ for(let i=0;i<KEYS.length;i++) dst[KEYS[i]].set(src[KEYS[i]]); }
  function crossMutInto(dst,a,b){ for(let n=0;n<KEYS.length;n++){ const k=KEYS[n], z=dst[k], x=a[k], y=b[k];
    for(let i=0;i<z.length;i++){ z[i]=Math.random()<0.5?x[i]:y[i]; if(Math.random()<MUT_RATE) z[i]+=(Math.random()*2-1)*MUT_AMT; } } }

  // ---- course: a winding closed channel; a 1-byte mask drives collisions and raycasts ----
  let W=0,H=0,dpr=1, ctx, mask, mctx, mask1=null, track, centre=[], checks=[], start, startH;
  function fit(){ dpr=Math.min(devicePixelRatio||1, LITE?1:1.25); const r=sim.getBoundingClientRect(); W=Math.max(1,Math.round(r.width)); H=Math.max(1,Math.round(r.height));
    sim.width=W*dpr; sim.height=H*dpr; ctx=sim.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
    mask=document.createElement('canvas'); mask.width=W; mask.height=H; mctx=mask.getContext('2d');
    track=document.createElement('canvas'); track.width=W*dpr; track.height=H*dpr;
    if(brain){ const br=brain.getBoundingClientRect(); brain.width=Math.max(1,Math.round(br.width*dpr)); brain.height=Math.max(1,Math.round(br.height*dpr)); }
  }
  function buildCourse(){
    const cx=W/2, cy=H/2, R=Math.min(W,H*1.25)*0.34;
    const a1=Math.random()*6.28, a2=Math.random()*6.28, k1=2+((Math.random()*2)|0), k2=3+((Math.random()*2)|0);
    centre=[]; const STEPS=180;
    for(let i=0;i<STEPS;i++){ const th=i/STEPS*6.2832, rad=R*(1+0.25*Math.sin(k1*th+a1)+0.13*Math.sin(k2*th+a2));
      centre.push({x:cx+Math.cos(th)*rad, y:cy+Math.sin(th)*rad*0.78}); }
    checks=[]; for(let i=0;i<STEPS;i+=4) checks.push(centre[i]);
    mctx.fillStyle='#000'; mctx.fillRect(0,0,W,H);
    mctx.strokeStyle='#fff'; mctx.lineWidth=CHAN_W; mctx.lineJoin='round'; mctx.lineCap='round';
    pathCentre(mctx,1); mctx.stroke();
    // pack the channel into 1 byte per cell (open=1) for cache-friendly, branch-light sampling
    const id=mctx.getImageData(0,0,W,H).data; mask1=new Uint8Array(W*H);
    for(let i=0;i<W*H;i++) mask1[i]=id[i*4]>127?1:0;
    renderTrack();
    start={x:centre[0].x,y:centre[0].y}; startH=Math.atan2(centre[2].y-start.y, centre[2].x-start.x);
  }
  function pathCentre(c,scale){ c.beginPath(); c.moveTo(centre[0].x*scale,centre[0].y*scale);
    for(let i=1;i<centre.length;i++) c.lineTo(centre[i].x*scale,centre[i].y*scale); c.closePath(); }
  function open(x,y){ x|=0; y|=0; if(x<0||y<0||x>=W||y>=H) return false; return mask1[y*W+x]===1; }
  function ray(x,y,a){ const dx=Math.cos(a),dy=Math.sin(a);
    for(let d=RAY_STEP;d<SENS_RANGE;d+=RAY_STEP){ const xi=(x+dx*d)|0, yi=(y+dy*d)|0;
      if(xi<0||yi<0||xi>=W||yi>=H || mask1[yi*W+xi]===0) return d/SENS_RANGE; } return 1; }

  // pre-render the pretty water channel once per course
  function renderTrack(){ const c=track.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
    c.fillStyle='#0a1622'; c.fillRect(0,0,W,H);
    c.lineCap='round'; c.lineJoin='round';
    c.strokeStyle='#10324a'; c.lineWidth=CHAN_W+8; pathCentre(c,1); c.stroke();
    const g=c.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0e4d63'); g.addColorStop(1,'#0a3346');
    c.strokeStyle=g; c.lineWidth=CHAN_W; pathCentre(c,1); c.stroke();
    c.strokeStyle='rgba(94,234,212,0.18)'; c.lineWidth=1.5; c.setLineDash([2,7]); pathCentre(c,1); c.stroke(); c.setLineDash([]);
    for(let i=0;i<checks.length;i+=3){ const p=checks[i]; c.fillStyle='rgba(251,146,60,0.7)'; c.beginPath(); c.arc(p.x,p.y,2.2,0,7); c.fill(); }
  }

  // ---- agents (pooled; the fleet array and weight buffers are allocated once and reused) ----
  let agents=[], scratch=[], gen=1, frame=0, best=0, bestNet=newNet(), leader=null, speedMul=1, raf=null;
  const inBuf=new Float32Array(INPUTS);
  function makeAgent(){ return { nn:newNet(), x:0,y:0,h:0,sp:0, alive:true, fit:0, cp:1, idle:0,
    sens:new Float32Array(N_SENS), hid:new Float32Array(HID), out:new Float32Array(OUTS), trail:[] }; }
  function reset(a){ a.x=start.x; a.y=start.y; a.h=startH; a.sp=0.7; a.alive=true; a.fit=0; a.cp=1; a.idle=0; a.trail.length=0; }
  function step(a){ const s=a.sens;
    for(let i=0;i<N_SENS;i++) s[i]=ray(a.x,a.y,a.h+SENS_ANG[i]);
    for(let i=0;i<N_SENS;i++) inBuf[i]=s[i]; inBuf[N_SENS]=a.sp/MAX_SPEED;
    forward(a.nn, inBuf, a.hid, a.out);
    const thr=(a.out[1]+1)/2;
    a.h+=a.out[0]*TURN*(0.45+thr); a.sp+=(thr*MAX_SPEED-a.sp)*0.12;
    a.x+=Math.cos(a.h)*a.sp; a.y+=Math.sin(a.h)*a.sp;
    if(!open(a.x,a.y)){ a.alive=false; return; }
    const cp=checks[a.cp%checks.length]; const dx=cp.x-a.x, dy=cp.y-a.y;
    if(dx*dx+dy*dy<CP2){ a.cp++; a.fit+=10; a.idle=0; } else if(++a.idle>140){ a.alive=false; return; }
    a.fit+=a.sp*0.008;
    a.trail.push(a.x,a.y); if(a.trail.length>14) a.trail.splice(0,2);
  }
  function pick(){ const h=Math.max(2,POP>>1); const a=agents[(Math.random()*h)|0], b=agents[(Math.random()*h)|0]; return b.fit>a.fit?b:a; }
  function nextGen(){
    agents.sort((p,q)=>q.fit-p.fit);
    if(agents[0].fit>best){ best=agents[0].fit; copyW(bestNet, agents[0].nn); }
    const el=Math.max(1,Math.round(POP*ELITE));
    for(let i=0;i<POP;i++){ if(i<el) copyW(scratch[i], agents[i].nn); else crossMutInto(scratch[i], pick().nn, pick().nn); }
    for(let i=0;i<POP;i++){ copyW(agents[i].nn, scratch[i]); reset(agents[i]); }
    gen++; frame=0;
  }
  function tick(){ frame++; let alive=0; leader=null;
    for(let i=0;i<POP;i++){ const a=agents[i]; if(!a.alive) continue; step(a); if(a.alive){ alive++; if(!leader||a.fit>leader.fit) leader=a; } }
    if(alive===0||frame>GEN_FRAMES) nextGen();
    return alive;
  }
  function spawn(){ while(agents.length<POP){ agents.push(makeAgent()); scratch.push(newNet()); }
    for(let i=0;i<POP;i++){ const a=agents[i]; for(let n=0;n<KEYS.length;n++){ const w=a.nn[KEYS[n]]; for(let j=0;j<w.length;j++) w[j]=Math.random()*2-1; } reset(a); }
    gen=1; frame=0; best=0; }

  // ---- rendering ----
  function vessel(c,a,lead){ c.save(); c.translate(a.x,a.y); c.rotate(a.h);
    c.fillStyle = lead?'#fbbf24':'rgba(190,228,255,0.85)';
    c.beginPath(); c.moveTo(6,0); c.lineTo(-4,3); c.lineTo(-2.5,0); c.lineTo(-4,-3); c.closePath(); c.fill(); c.restore();
  }
  function draw(){
    ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(track,0,0); ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=1.4;
    for(let i=0;i<POP;i++){ const a=agents[i]; if(!a.alive||a.trail.length<4) continue; ctx.beginPath(); ctx.moveTo(a.trail[0],a.trail[1]); for(let k=2;k<a.trail.length;k+=2) ctx.lineTo(a.trail[k],a.trail[k+1]); ctx.stroke(); }
    if(leader){ for(let i=0;i<N_SENS;i++){ const an=leader.h+SENS_ANG[i], d=leader.sens[i]*SENS_RANGE;
      ctx.strokeStyle='rgba(94,234,212,'+(0.15+(1-leader.sens[i])*0.5)+')'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(leader.x,leader.y); ctx.lineTo(leader.x+Math.cos(an)*d,leader.y+Math.sin(an)*d); ctx.stroke(); } }
    for(let i=0;i<POP;i++){ const a=agents[i]; if(a.alive && a!==leader) vessel(ctx,a,false); }
    if(leader) vessel(ctx,leader,true);
    drawBrain();
    if(elGen){ let al=0; for(let i=0;i<POP;i++) if(agents[i].alive) al++; elGen.textContent='Gen '+gen; elAlive.textContent=al+' alive'; elBest.textContent='best '+best.toFixed(0); }
  }
  function drawBrain(){ if(!brain || !leader) return; const bc=brain.getContext('2d'), bw=brain.width, bh=brain.height; bc.clearRect(0,0,bw,bh);
    const cols=[INPUTS,HID,OUTS], xs=[bw*0.14,bw*0.5,bw*0.86], R=4.5*dpr;
    const pos=cols.map((n,ci)=>{ const a=[]; for(let i=0;i<n;i++) a.push({x:xs[ci], y:bh*(i+1)/(n+1)}); return a; });
    const ins=new Float32Array(INPUTS); for(let i=0;i<N_SENS;i++) ins[i]=leader.sens[i]; ins[N_SENS]=leader.sp/MAX_SPEED;
    function wires(from,to,w,act,stride){ for(let i=0;i<from.length;i++) for(let j=0;j<to.length;j++){ const wt=w[i*stride+j];
      bc.strokeStyle=(wt>0?'rgba(94,234,212,':'rgba(167,139,250,')+Math.min(0.5,Math.abs(wt)*0.35*Math.abs(act[i]||0.3)+0.03)+')'; bc.lineWidth=Math.min(1.6,Math.abs(wt)*0.7)*dpr; bc.beginPath(); bc.moveTo(from[i].x,from[i].y); bc.lineTo(to[j].x,to[j].y); bc.stroke(); } }
    wires(pos[0],pos[1],leader.nn.w1,ins,HID);
    wires(pos[1],pos[2],leader.nn.w2,leader.hid,OUTS);
    const acts=[ins,leader.hid,leader.out];
    for(let ci=0;ci<3;ci++) for(let i=0;i<pos[ci].length;i++){ const v=Math.abs(acts[ci][i]||0); const p=pos[ci][i];
      bc.fillStyle='rgba(94,234,212,'+(0.2+Math.min(0.8,v))+')'; bc.beginPath(); bc.arc(p.x,p.y,R,0,7); bc.fill();
      bc.strokeStyle='rgba(255,255,255,0.25)'; bc.lineWidth=dpr; bc.stroke(); }
  }

  // runtime guard: the sim always ticks, but renders less often if frames run slow (which cuts the
  // dominant compositing cost) and only then shrinks the fleet, keeping the whole page responsive.
  let fAcc=0, fCnt=0, fPrev=0, ready=false, running=false, skip=0, fc=0;
  function loop(ts){
    if(!running) return;
    if(fPrev){ fAcc+=ts-fPrev; if(++fCnt>=45){ const avg=fAcc/fCnt; fAcc=0; fCnt=0;
      if(avg>24){ if(skip<3) skip++; else if(POP>26){ POP-=8; if(agents.length>POP){ agents.length=POP; scratch.length=POP; } } }
      else if(avg<14 && skip>0) skip--; } }
    fPrev=ts;
    for(let s=0;s<speedMul;s++) tick();
    if((fc++ % (skip+1))===0) draw();
    raf=requestAnimationFrame(loop);
  }
  function resume(){ if(running||reduce) return; running=true; fPrev=0; raf=requestAnimationFrame(loop); }
  function pause(){ running=false; if(raf){ cancelAnimationFrame(raf); raf=null; } }

  if(btnSpeed) btnSpeed.addEventListener('click', ()=>{ speedMul = speedMul===1?3:1; btnSpeed.textContent='Speed: '+speedMul+'×'; });
  if(btnNew) btnNew.addEventListener('click', ()=>{ buildCourse(); spawn(); });

  // run only while the card is on screen; go fully idle (no rAF, no work) when it is not
  new IntersectionObserver(es=>{ es.forEach(e=>{
    if(e.isIntersecting){ if(!ready){ ready=true; fit(); buildCourse(); spawn(); if(reduce){ draw(); return; } } resume(); }
    else pause();
  }); },{threshold:0.1}).observe(sim);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) pause(); else if(ready) resume(); });
})();
