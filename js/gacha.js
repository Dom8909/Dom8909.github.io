// Fusion: a Suika-style merge game. Drop orbs into the bin; two of the same tier fuse into the next,
// climbing the ladder from Common to Celestial and scoring as you go — bigger fusions score far more.
// Let the pile spill over the top line and it's game over; your best run is saved. The 2D physics
// (gravity + circle collisions resolved by positional relaxation) is written from scratch, runs on a
// fixed timestep, and is pooled, so it never allocates in the loop and stays smooth on any device.
// High score persists in localStorage behind an integrity checksum (tamper-evident, not secure).
(function(){
  const reduce = PF.reduce;
  const bin = document.getElementById('gachaBin'); if(!bin) return;
  const elScore = document.getElementById('gachaScore'), elBest = document.getElementById('gachaBest');
  const elLadder = document.getElementById('gachaLadder');
  const btnNew = document.getElementById('gachaNew');

  const COLORS=['#9aa7b8','#5eead4','#38bdf8','#a78bfa','#f472b6','#fb923c','#fbe36b'];
  const NAMES=['Common','Uncommon','Rare','Epic','Mythic','Legendary','Celestial'];
  const NT=COLORS.length, MAXT=NT-1;
  const G=0.55, REST=0.18, ITER=5, MAX_ORBS=110, STEP=1000/60, GRACE=180;   // GRACE = 3s at 60fps
  const SALT='fusion-v2-7c3';

  let W=0,H=0,dpr=1,ctx, unit=16, lineY=0, PW=0, wx0=0, wx1=0;   // PW = narrow play column, centred, with walls
  function rad(t){ return unit*Math.pow(1.22,t); }

  // pooled orbs + effects (the loop never allocates)
  const orbs=[]; for(let i=0;i<MAX_ORBS+8;i++) orbs.push({x:0,y:0,vx:0,vy:0,r:0,t:0,pop:1,alive:false,sl:0,slv:0,lvl:0,lvv:0,amp:0,phase:0,pvx:0,pvy:0,age:0});
  const fx=[]; for(let i=0;i<48;i++) fx.push({x:0,y:0,vx:0,vy:0,r:0,life:0,max:1,c:'',ring:false});
  function freeOrb(){ for(const o of orbs) if(!o.alive) return o; return null; }
  function ring(x,y,r,c){ for(const f of fx){ if(f.life<=0){ f.x=x;f.y=y;f.r=r;f.c=c;f.ring=true;f.life=f.max=20; return; } } }
  function spark(x,y,c){ for(const f of fx){ if(f.life<=0){ const a=Math.random()*6.28,s=1.5+Math.random()*2.5;
    f.x=x;f.y=y;f.vx=Math.cos(a)*s;f.vy=Math.sin(a)*s-1;f.r=1.5+Math.random()*2;f.c=c;f.ring=false;f.life=f.max=24+Math.random()*10; return; } } }

  let score=0, high=0, best=0, nextT=0, prevX=0, hovering=false, dead=false, overTime=0;

  // save (tamper-EVIDENT checksum, not real security; the salt lives in this file)
  function fnv(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36); }
  function save(){ try{ const j=JSON.stringify({h:Math.round(high),b:best}); localStorage.setItem('fusion', btoa(j)+'.'+fnv(j+SALT)); }catch(_){ } }
  function load(){ try{ const raw=localStorage.getItem('fusion'); if(!raw) return; const i=raw.lastIndexOf('.'); if(i<0) return;
    const j=atob(raw.slice(0,i)); if(fnv(j+SALT)!==raw.slice(i+1)) return; const d=JSON.parse(j);
    if(typeof d.h==='number') high=Math.max(0,Math.min(1e8,d.h)); if(typeof d.b==='number') best=Math.max(0,Math.min(MAXT,d.b|0)); }catch(_){ } }

  function fit(){ dpr=Math.min(devicePixelRatio||1,1); const r=bin.getBoundingClientRect();
    W=Math.max(1,Math.round(r.width)); H=Math.max(1,Math.round(r.height));
    bin.width=W*dpr; bin.height=H*dpr; ctx=bin.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
    PW=W-8; wx0=4; wx1=W-4;   // play area fills the full width, walls at the edges
    unit=Math.max(13, Math.min(PW/16, H/7)); lineY=Math.max(34, H*0.15); prevX=W/2; }

  function roll(){ const r=Math.random(); return r<0.7?0 : r<0.93?1 : 2; }   // mostly small, like Suika
  function drop(t,x){ if(dead) return; const o=freeOrb(); if(!o) return;
    o.alive=true; o.t=t; o.r=rad(t); o.x=Math.max(wx0+o.r+1,Math.min(wx1-o.r-1,x)); o.y=o.r+3; o.vx=0; o.vy=0; o.pop=0.55;
    o.sl=0; o.slv=0; o.lvl=0; o.lvv=0; o.amp=o.r*0.14; o.phase=Math.random()*6.28; o.pvx=0; o.pvy=0; o.age=0; }

  function merge(a,b){ const nt=Math.min(MAXT, a.t+1), mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    a.alive=false; b.alive=false;
    score += Math.round(2*Math.pow(1.85, a.t));   // bigger fusions score far more
    if(a.t>=best){ best=a.t; updateLadder(); }
    ring(mx,my,rad(a.t),COLORS[a.t]); for(let k=0;k<5;k++) spark(mx,my,COLORS[nt]);
    if(a.t<MAXT){ const o=freeOrb(); if(o){ o.alive=true; o.t=nt; o.r=rad(nt); o.x=mx; o.y=my; o.vx=(a.vx+b.vx)*0.5; o.vy=(a.vy+b.vy)*0.5-1.5; o.pop=0; o.sl=(a.sl+b.sl)*0.5; o.slv=0; o.lvl=0; o.lvv=0; o.amp=o.r*0.22; o.phase=Math.random()*6.28; o.pvx=o.vx; o.pvy=o.vy; o.age=30; } }
    else { score += 500; }   // fusing two Celestial orbs is a jackpot
  }

  // fixed-timestep physics: gravity, walls, several relaxation passes of fusion + collisions, then overflow check
  function physics(){
    for(const o of orbs){ if(!o.alive) continue; o.age++;
      o.vy+=G; o.vx*=0.992; o.x+=o.vx; o.y+=o.vy;
      if(o.pop<1){ o.pop+=0.12; if(o.pop>1) o.pop=1; }
      if(o.x<wx0+o.r){ o.x=wx0+o.r; o.vx=-o.vx*REST; } else if(o.x>wx1-o.r){ o.x=wx1-o.r; o.vx=-o.vx*REST; }
      if(o.y>H-o.r){ o.y=H-o.r; o.vy=-o.vy*REST; o.vx*=0.9; }
    }
    for(let it=0; it<ITER; it++){
      for(let i=0;i<orbs.length;i++){ const a=orbs[i]; if(!a.alive) continue;
        for(let j=i+1;j<orbs.length;j++){ const b=orbs[j]; if(!b.alive) continue;
          const dx=b.x-a.x, dy=b.y-a.y, d2=dx*dx+dy*dy, rr=a.r+b.r;
          // same-tier orbs that are touching (small tolerance) fuse; break because `a` is now consumed
          if(it===0 && a.t===b.t && d2 < rr*rr*1.12){ merge(a,b); break; }
          if(d2>=rr*rr || d2<=0.0001) continue;
          const d=Math.sqrt(d2), nx=dx/d, ny=dy/d, push=(rr-d)*0.5;
          a.x-=nx*push; a.y-=ny*push; b.x+=nx*push; b.y+=ny*push;
          const rvn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
          if(rvn<0){ const imp=rvn*(1+REST)*0.5; a.vx+=imp*nx; a.vy+=imp*ny; b.vx-=imp*nx; b.vy-=imp*ny; }
        }
      }
    }
    // liquid slosh: the surface tilts against horizontal accel, the level bobs on vertical accel, and a
    // travelling ripple's amplitude spikes with motion then decays — all springing back to still + level
    for(const o of orbs){ if(!o.alive) continue; const ax=o.vx-o.pvx, ay=o.vy-o.pvy;
      o.slv += -o.sl*0.07 - ax*0.06; o.slv*=0.86; o.sl+=o.slv; if(o.sl>0.7)o.sl=0.7; else if(o.sl<-0.7)o.sl=-0.7;
      o.lvv += -o.lvl*0.12 - ay*0.32; o.lvv*=0.82; o.lvl+=o.lvv; const lc=o.r*0.22; if(o.lvl>lc)o.lvl=lc; else if(o.lvl<-lc)o.lvl=-lc;
      o.amp = o.amp*0.9 + (Math.abs(ax)+Math.abs(ay))*0.5; const ac=o.r*0.2; if(o.amp>ac)o.amp=ac; o.phase += 0.2 + o.amp*0.04;
      o.pvx=o.vx; o.pvy=o.vy; }
    // overflow → game over: an orb that has been around a while (not a fresh drop passing through) is
    // still poking above the line, i.e. the pile is stuck against the top; held past a short grace
    let over=false; for(const o of orbs){ if(o.alive && o.age>18 && o.y-o.r<lineY){ over=true; break; } }
    if(over){ if(++overTime>GRACE && !dead){ dead=true; if(score>high) high=score; save(); } } else overTime=0;
    for(const f of fx){ if(f.life<=0) continue; f.life--; if(!f.ring){ f.vy+=0.25; f.x+=f.vx; f.y+=f.vy; f.vx*=0.96; } }
  }

  // a glass orb with liquid inside: glow, faint shell, then the liquid clipped to the circle and filled
  // below a rippling, tilted, bobbing surface, a bright waterline, a highlight and a rim. No per-frame alloc.
  const NS=11, surf=new Float32Array((NS+1)*2);
  function orb(o){ const r=o.r*(0.62+0.38*o.pop), c=COLORS[o.t], x=o.x, y=o.y;
    ctx.globalAlpha=0.15; ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r*1.16,0,7); ctx.fill(); ctx.globalAlpha=1;
    ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.clip();
    const baseY=y-r*0.16-o.lvl;
    for(let i=0;i<=NS;i++){ const dx=-r+2*r*i/NS; surf[i*2]=x+dx; surf[i*2+1]=baseY+o.sl*dx+o.amp*Math.sin(dx/r*3.1+o.phase); }
    ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(surf[0]-2, y+r+3);
    for(let i=0;i<=NS;i++) ctx.lineTo(surf[i*2], surf[i*2+1]);
    ctx.lineTo(surf[NS*2]+2, y+r+3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.42)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(surf[0],surf[1]);
    for(let i=1;i<=NS;i++) ctx.lineTo(surf[i*2],surf[i*2+1]); ctx.stroke();
    ctx.restore();
    ctx.fillStyle='rgba(255,255,255,0.24)'; ctx.beginPath(); ctx.arc(x-r*0.32,y-r*0.34,r*0.24,0,7); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.26)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(x,y,r-0.5,0,7); ctx.stroke();
  }
  // the "next" orb shown before dropping — same liquid render, sloshing as the cursor moves it
  const prev={x:0,y:0,r:0,t:0,pop:1,sl:0,slv:0,lvl:0,lvv:0,amp:0,phase:0};
  function drawPreview(px){ prev.t=nextT; prev.r=rad(nextT); const nx=Math.max(wx0+prev.r+1,Math.min(wx1-prev.r-1,px));
    const pax=nx-prev.x; prev.slv+=-prev.sl*0.08-pax*0.03; prev.slv*=0.88; prev.sl+=prev.slv; if(prev.sl>0.7)prev.sl=0.7; else if(prev.sl<-0.7)prev.sl=-0.7;
    prev.amp=Math.min(prev.r*0.18, prev.amp*0.9+Math.abs(pax)*0.4); prev.phase+=0.16+prev.amp*0.04;
    prev.x=nx; prev.y=Math.max(prev.r+3, lineY-prev.r-8); orb(prev); }
  function render(){ ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#0a1420'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,0.022)'; ctx.fillRect(wx0,0,PW,H);
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(wx0+0.5,0); ctx.lineTo(wx0+0.5,H); ctx.moveTo(wx1-0.5,0); ctx.lineTo(wx1-0.5,H); ctx.stroke();
    const warn = overTime>0 || dead;
    ctx.strokeStyle = warn?'rgba(248,113,113,0.6)':'rgba(255,255,255,0.1)'; ctx.lineWidth=1; ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.moveTo(wx0,lineY); ctx.lineTo(wx1,lineY); ctx.stroke(); ctx.setLineDash([]);
    for(const o of orbs) if(o.alive) orb(o);
    for(const f of fx){ if(f.life<=0) continue; const k=f.life/f.max;
      if(f.ring){ ctx.globalAlpha=k*0.7; ctx.strokeStyle=f.c; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(f.x,f.y,f.r*(1+(1-k)*1.4),0,7); ctx.stroke(); }
      else { ctx.globalAlpha=k; ctx.fillStyle=f.c; ctx.beginPath(); ctx.arc(f.x,f.y,f.r*k,0,7); ctx.fill(); } }
    ctx.globalAlpha=1;
    if(hovering && !dead){ const x=Math.max(wx0+rad(nextT)+1,Math.min(wx1-rad(nextT)-1,prevX));
      ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=1; ctx.setLineDash([2,5]); ctx.beginPath(); ctx.moveTo(x,lineY); ctx.lineTo(x,H); ctx.stroke(); ctx.setLineDash([]);
      drawPreview(prevX); }
    if(dead){ ctx.fillStyle='rgba(6,10,18,0.78)'; ctx.fillRect(0,0,W,H); ctx.textAlign='center';
      ctx.fillStyle='#f4f4ef'; ctx.font='600 26px Inter, system-ui, sans-serif'; ctx.fillText('Game Over', W/2, H/2-16);
      ctx.fillStyle='#9aa7b8'; ctx.font='15px Inter, system-ui, sans-serif'; ctx.fillText('Score '+score+'   ·   Best '+Math.max(high,score), W/2, H/2+9);
      ctx.fillStyle='#5eead4'; ctx.font='12px "JetBrains Mono", monospace'; ctx.fillText('CLICK TO PLAY AGAIN', W/2, H/2+34); ctx.textAlign='left'; }
    if(elScore) elScore.textContent=score; if(elBest) elBest.textContent=Math.max(high,score);
  }

  function updateLadder(){ if(!elLadder) return; let html='';
    for(let t=0;t<NT;t++){ html+='<span class="rung'+(t<=best?' on':'')+'" style="--c:'+COLORS[t]+'" title="'+NAMES[t]+'"></span>'; }
    elLadder.innerHTML=html; }
  function restart(){ for(const o of orbs) o.alive=false; for(const f of fx) f.life=0; score=0; dead=false; overTime=0; nextT=roll(); }

  // ---- loop (fixed-step physics, render every frame, idle when off-screen) ----
  let raf=null, running=false, acc=0, last=0;
  function loop(ts){ if(!running) return; raf=requestAnimationFrame(loop);
    if(!last) last=ts; let dt=ts-last; last=ts; if(dt>120) dt=120; acc+=dt;
    let guard=0; while(acc>=STEP && guard<5){ physics(); acc-=STEP; guard++; } if(acc>STEP) acc=0;
    render(); }
  function start(){ if(running||reduce) return; running=true; last=0; raf=requestAnimationFrame(loop); }
  function stop(){ running=false; if(raf){ cancelAnimationFrame(raf); raf=null; } }

  // ---- input ----
  function localX(e){ const r=bin.getBoundingClientRect(); return (e.clientX-r.left)*(W/r.width); }
  bin.style.cursor='pointer'; bin.style.touchAction='none';
  bin.addEventListener('pointermove', e=>{ hovering=true; prevX=localX(e); });
  bin.addEventListener('pointerenter', ()=>{ hovering=true; });
  bin.addEventListener('pointerleave', ()=>{ hovering=false; });
  bin.addEventListener('pointerdown', e=>{ if(dead){ restart(); } else { drop(nextT, localX(e)); nextT=roll(); } e.preventDefault(); });
  if(btnNew) btnNew.addEventListener('click', restart);

  // ---- boot ----
  let ready=false;
  function boot(){ if(ready) return; ready=true; fit(); load(); nextT=roll(); updateLadder(); }
  new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting){ boot(); start(); } else stop(); }); },{threshold:0.05}).observe(bin);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) stop(); else if(ready) start(); });
  if('ResizeObserver' in window){ let t=0; new ResizeObserver(()=>{ clearTimeout(t); t=setTimeout(()=>{ if(ready) fit(); }, 160); }).observe(bin); }
})();
