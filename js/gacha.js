// Fusion: a physics merge game. Drop orbs into the bin; two of the same tier fuse into the next, so
// you climb from Common to Celestial. Fusions pay out sparks, which fund higher-tier summons. The 2D
// physics (gravity + circle collisions resolved by positional relaxation) is written from scratch and
// runs on a fixed timestep with pooled objects, so it stays smooth on any device and never allocates
// inside the loop. Progress is saved to localStorage with an integrity check (tamper-evident, not secure).
(function(){
  const reduce = PF.reduce;
  const bin = document.getElementById('gachaBin'); if(!bin) return;
  const elSparks = document.getElementById('gachaSparks'), elBest = document.getElementById('gachaBest');
  const elLadder = document.getElementById('gachaLadder');
  const btnSummon = document.getElementById('gachaSummon'), btnReset = document.getElementById('gachaReset');

  const COLORS=['#9aa7b8','#5eead4','#38bdf8','#a78bfa','#f472b6','#fb923c','#fbe36b'];
  const NAMES=['Common','Uncommon','Rare','Epic','Mythic','Legendary','Celestial'];
  const NT=COLORS.length, MAXT=NT-1;
  const G=0.55, REST=0.18, ITER=5, MAX_ORBS=70, SUMMON_COST=24, STEP=1000/60;
  const SALT='fusion-v1-7c3';

  let W=0,H=0,dpr=1,ctx, unit=16, dangerY=0;
  function rad(t){ return unit*Math.pow(1.255,t); }

  // ---- pooled orbs + merge effects (the loop never allocates) ----
  const orbs=[]; for(let i=0;i<MAX_ORBS+8;i++) orbs.push({x:0,y:0,vx:0,vy:0,r:0,t:0,pop:1,merged:false,alive:false});
  const fx=[]; for(let i=0;i<48;i++) fx.push({x:0,y:0,vx:0,vy:0,r:0,life:0,max:1,c:'',ring:false});
  function freeOrb(){ for(const o of orbs) if(!o.alive) return o; return null; }
  function alive(){ let n=0; for(const o of orbs) if(o.alive) n++; return n; }
  function ring(x,y,r,c){ for(const f of fx){ if(f.life<=0){ f.x=x;f.y=y;f.r=r;f.c=c;f.ring=true;f.life=f.max=20; return; } } }
  function spark(x,y,c){ for(const f of fx){ if(f.life<=0){ const a=Math.random()*6.28,s=1.5+Math.random()*2.5;
    f.x=x;f.y=y;f.vx=Math.cos(a)*s;f.vy=Math.sin(a)*s-1;f.r=1.5+Math.random()*2;f.c=c;f.ring=false;f.life=f.max=24+Math.random()*10; return; } } }

  let sparks=20, best=0, nextT=0, prevX=0, hovering=false, full=false;

  // ---- save (tamper-EVIDENT: a checksum, not real security; the salt lives in this file) ----
  function fnv(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36); }
  function save(){ try{ const j=JSON.stringify({s:Math.round(sparks),b:best}); localStorage.setItem('fusion', btoa(j)+'.'+fnv(j+SALT)); }catch(_){ } }
  function load(){ try{ const raw=localStorage.getItem('fusion'); if(!raw) return; const i=raw.lastIndexOf('.'); if(i<0) return;
    const j=atob(raw.slice(0,i)); if(fnv(j+SALT)!==raw.slice(i+1)) return; const d=JSON.parse(j);
    if(typeof d.s==='number') sparks=Math.max(0,Math.min(1e7,d.s)); if(typeof d.b==='number') best=Math.max(0,Math.min(MAXT,d.b|0)); }catch(_){ } }

  function fit(){ dpr=Math.min(devicePixelRatio||1,1); const r=bin.getBoundingClientRect();
    W=Math.max(1,Math.round(r.width)); H=Math.max(1,Math.round(r.height));
    bin.width=W*dpr; bin.height=H*dpr; ctx=bin.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
    unit=Math.max(11, Math.min(W,H)/19); dangerY=Math.max(34, H*0.13); prevX=W/2; }

  function drop(t,x){ if(full) return false; const o=freeOrb(); if(!o) return false;
    o.alive=true; o.merged=false; o.t=t; o.r=rad(t); o.x=Math.max(o.r+2,Math.min(W-o.r-2,x)); o.y=Math.min(dangerY-o.r-2, o.r+6); o.vx=0; o.vy=0; o.pop=0.5;
    return true; }

  function merge(a,b){ const nt=Math.min(MAXT, a.t+1), mx=(a.x+b.x)/2, my=(a.y+b.y)/2, col=COLORS[a.t];
    a.alive=false; b.alive=false;
    const reward=Math.round(2*Math.pow(1.9,a.t));
    sparks+=reward; if(a.t>=best){ best=a.t; updateLadder(); }
    ring(mx,my,rad(a.t),col); for(let k=0;k<5;k++) spark(mx,my,COLORS[nt]);
    if(a.t<MAXT){ const o=freeOrb(); if(o){ o.alive=true; o.merged=false; o.t=nt; o.r=rad(nt); o.x=mx; o.y=my; o.vx=(a.vx+b.vx)*0.5; o.vy=Math.min(0,(a.vy+b.vy)*0.5)-1.5; o.pop=0; } }
    else { sparks+=reward*4; if(best>=MAXT){ best=MAXT; } }   // fusing two top orbs cashes out + clears space
    save(); }

  // ---- fixed-timestep physics: gravity, walls, then several relaxation passes of circle collisions ----
  function physics(){
    for(const o of orbs){ if(!o.alive) continue;
      o.vy+=G; o.vx*=0.992; o.x+=o.vx; o.y+=o.vy;
      if(o.pop<1){ o.pop+=0.12; if(o.pop>1) o.pop=1; }
      if(o.x<o.r){ o.x=o.r; o.vx=-o.vx*REST; } else if(o.x>W-o.r){ o.x=W-o.r; o.vx=-o.vx*REST; }
      if(o.y>H-o.r){ o.y=H-o.r; o.vy=-o.vy*REST; o.vx*=0.9; }
    }
    for(let it=0; it<ITER; it++){
      for(let i=0;i<orbs.length;i++){ const a=orbs[i]; if(!a.alive) continue;
        for(let j=i+1;j<orbs.length;j++){ const b=orbs[j]; if(!b.alive) continue;
          let dx=b.x-a.x, dy=b.y-a.y; let d2=dx*dx+dy*dy; const rr=a.r+b.r;
          if(d2>=rr*rr || d2<=0.0001) continue;
          const d=Math.sqrt(d2), nx=dx/d, ny=dy/d, ov=rr-d;
          if(a.t===b.t && !a.merged && !b.merged && it===0 && d < rr*0.92){ a.merged=b.merged=true; merge(a,b); continue; }
          if(!a.alive||!b.alive) continue;
          const push=ov*0.5; a.x-=nx*push; a.y-=ny*push; b.x+=nx*push; b.y+=ny*push;
          const rvn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;   // damp the approaching velocity along the normal
          if(rvn<0){ const imp=rvn*(1+REST)*0.5; a.vx+=imp*nx; a.vy+=imp*ny; b.vx-=imp*nx; b.vy-=imp*ny; }
        }
      }
    }
    // bin full if a settled orb pokes above the danger line
    full=false; if(alive()>=MAX_ORBS) full=true; else for(const o of orbs){ if(o.alive && o.y-o.r<dangerY && Math.abs(o.vy)<0.6){ full=true; break; } }
    for(const f of fx){ if(f.life<=0) continue; f.life--; if(!f.ring){ f.vy+=0.25; f.x+=f.vx; f.y+=f.vy; f.vx*=0.96; } }
    sparks+=0.04;   // a slow trickle so you are never fully stuck
  }

  // allocation-free glossy orb: glow halo + flat body + offset highlight + rim
  function orb(o){ const r=o.r*(0.62+0.38*o.pop), c=COLORS[o.t];
    ctx.globalAlpha=0.16; ctx.fillStyle=c; ctx.beginPath(); ctx.arc(o.x,o.y,r*1.16,0,7); ctx.fill(); ctx.globalAlpha=1;
    ctx.fillStyle=c; ctx.beginPath(); ctx.arc(o.x,o.y,r,0,7); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.34)'; ctx.beginPath(); ctx.arc(o.x-r*0.3,o.y-r*0.33,r*0.34,0,7); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(o.x,o.y,r-0.5,0,7); ctx.stroke();
  }
  function render(){ ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#0a1420'; ctx.fillRect(0,0,W,H);
    // danger line
    ctx.strokeStyle=full?'rgba(248,113,113,0.55)':'rgba(255,255,255,0.08)'; ctx.lineWidth=1; ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.moveTo(0,dangerY); ctx.lineTo(W,dangerY); ctx.stroke(); ctx.setLineDash([]);
    for(const o of orbs) if(o.alive) orb(o);
    // effects
    for(const f of fx){ if(f.life<=0) continue; const k=f.life/f.max;
      if(f.ring){ ctx.globalAlpha=k*0.7; ctx.strokeStyle=f.c; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(f.x,f.y,f.r*(1+(1-k)*1.4),0,7); ctx.stroke(); }
      else { ctx.globalAlpha=k; ctx.fillStyle=f.c; ctx.beginPath(); ctx.arc(f.x,f.y,f.r*k,0,7); ctx.fill(); }
    }
    ctx.globalAlpha=1;
    // next-orb preview at the drop line
    if(hovering && !full){ const r=rad(nextT); ctx.globalAlpha=0.85; ctx.fillStyle=COLORS[nextT];
      ctx.beginPath(); ctx.arc(Math.max(r+2,Math.min(W-r-2,prevX)), dangerY-r-6, r, 0, 7); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(prevX,dangerY); ctx.lineTo(prevX,H); ctx.stroke(); }
    if(elSparks) elSparks.textContent=Math.round(sparks);
  }

  function updateLadder(){ if(!elLadder) return; let html='';
    for(let t=0;t<NT;t++){ const on=t<=best; html+='<span class="rung'+(on?' on':'')+'" style="--c:'+COLORS[t]+'" title="'+NAMES[t]+'"></span>'; }
    elLadder.innerHTML=html; }

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
  bin.addEventListener('pointerdown', e=>{ const x=localX(e); if(drop(nextT,x)){ nextT=Math.random()<0.12?1:0; } e.preventDefault(); });
  if(btnSummon) btnSummon.addEventListener('click', ()=>{ if(full || sparks<SUMMON_COST) return; sparks-=SUMMON_COST;
    const r=Math.random(), t=r<0.5?1:r<0.82?2:3; drop(t, W/2); save(); });
  if(btnReset) btnReset.addEventListener('click', ()=>{ for(const o of orbs) o.alive=false; for(const f of fx) f.life=0; full=false; });

  // ---- boot ----
  let ready=false;
  function boot(){ if(ready) return; ready=true; fit(); load(); updateLadder(); }
  new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting){ boot(); start(); } else stop(); }); },{threshold:0.05}).observe(bin);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) stop(); else if(ready) start(); });
  if('ResizeObserver' in window){ let t=0; new ResizeObserver(()=>{ clearTimeout(t); t=setTimeout(()=>{ if(ready) fit(); }, 160); }).observe(bin); }
  setInterval(save, 5000);
})();
