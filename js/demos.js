// Canvas demos: shoal, pathfinder, wireframe, and portal.
(function(){
  const reduce = PF.reduce;
  function fit(c){ const dpr=Math.min(devicePixelRatio||1,2); const r=c.getBoundingClientRect(); c.width=r.width*dpr; c.height=r.height*dpr; const ctx=c.getContext('2d'); ctx.scale(dpr,dpr); return {ctx,w:r.width,h:r.height}; }
  function ptr(c,st){ const hint=c.parentNode.querySelector('.hint');
    const set=e=>{ const r=c.getBoundingClientRect(); st.x=e.clientX-r.left; st.y=e.clientY-r.top; st.on=true; if(hint&&!st._h){ st._h=true; hint.style.opacity=0; } };
    const move=e=>set(e), down=e=>{ set(e); st.click=true; }, leave=()=>{ st.on=false; };
    c.addEventListener('pointermove',move,{passive:true}); c.addEventListener('pointerdown',down,{passive:true}); c.addEventListener('pointerleave',leave,{passive:true});
    return ()=>{ c.removeEventListener('pointermove',move); c.removeEventListener('pointerdown',down); c.removeEventListener('pointerleave',leave); };
  }
  function runWhenVisible(c,start){ let stop=null; new IntersectionObserver(es=>{ es.forEach(en=>{ if(en.isIntersecting&&!stop){stop=start();} else if(!en.isIntersecting&&stop){stop();stop=null;} }); },{threshold:0.05}).observe(c); }

  // A* on a 4-neighbour grid (Manhattan heuristic). Returns the expansion order and the path.
  function astar(nc,nr,wall,si,gi){ const open=[]; const g={},f={},came={},closed=new Uint8Array(nc*nr),inOpen=new Uint8Array(nc*nr);
    const gx=gi%nc, gy=(gi/nc|0); const hx=i=>Math.abs((i%nc)-gx)+Math.abs(((i/nc|0))-gy);
    g[si]=0; f[si]=hx(si); open.push(si); inOpen[si]=1; const order=[];
    while(open.length){ let bi=0; for(let k=1;k<open.length;k++) if(f[open[k]]<f[open[bi]]) bi=k; const cur=open.splice(bi,1)[0]; inOpen[cur]=0;
      if(closed[cur]) continue; closed[cur]=1; order.push(cur);
      if(cur===gi){ const path=[]; let n=cur; while(n!==undefined){ path.push(n); n=came[n]; } path.reverse(); return {order,path}; }
      const cx=cur%nc, cy=(cur/nc|0), nb=[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
      for(const m of nb){ const nx=m[0],ny=m[1]; if(nx<0||ny<0||nx>=nc||ny>=nr) continue; const ni=ny*nc+nx; if(wall[ni]||closed[ni]) continue;
        const ng=g[cur]+1; if(g[ni]===undefined||ng<g[ni]){ g[ni]=ng; f[ni]=ng+hx(ni); came[ni]=cur; if(!inOpen[ni]){ open.push(ni); inOpen[ni]=1; } } }
    } return {order,path:[]}; }

  // Shoal: 3D boids with perspective projection; the pointer repels nearby fish.
  function flock(c){ return function(){ let {ctx,w,h}=fit(c);
    const N=Math.max(26,Math.min(60,Math.round(w*h/3400)));
    const DEPTH=420, FOCAL=440, cz=DEPTH/2;        // screen scale = FOCAL / (FOCAL + z)
    const MAX=2.4, MIN=1.2, PER=46, SEP=22;
    const F=[];
    for(let i=0;i<N;i++) F.push({ x:Math.random()*w, y:Math.random()*h, z:Math.random()*DEPTH,
      vx:Math.random()*2-1, vy:(Math.random()*2-1)*0.6, vz:Math.random()*2-1,
      ph:Math.random()*6.283, sp:0.85+Math.random()*0.4, warm:Math.random()<0.22 });
    const bub=[]; for(let i=0;i<14;i++) bub.push({ x:Math.random()*w, y:Math.random()*h, r:1+Math.random()*2.4, s:0.2+Math.random()*0.5 });
    const st={on:false}; const off=ptr(c,st); let raf, t=0;
    const bg=ctx.createLinearGradient(0,0,0,h); bg.addColorStop(0,'#0e4d63'); bg.addColorStop(0.45,'#073246'); bg.addColorStop(1,'#04141f');
    const order=F.map((_,i)=>i);

    function project(o){ const s=FOCAL/(FOCAL+o.z); return { sx:w/2+(o.x-w/2)*s, sy:h/2+(o.y-h/2)*s, s }; }
    function ocean(){ ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(let i=0;i<4;i++){ const x=w*(0.15+0.22*i)+Math.sin(t*0.005+i)*30, wd=34+i*10;
        const lg=ctx.createLinearGradient(x,0,x-60,h); lg.addColorStop(0,'rgba(140,225,255,0.10)'); lg.addColorStop(1,'rgba(140,225,255,0)');
        ctx.fillStyle=lg; ctx.beginPath(); ctx.moveTo(x-wd,0); ctx.lineTo(x+wd,0); ctx.lineTo(x-30,h); ctx.lineTo(x-90,h); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    function fish(o){ const p=project(o), s=p.s, ang=Math.atan2(o.vy,o.vx);
      const len=(12+6*o.sp)*s, ht=(5.5+2*o.sp)*s, wig=Math.sin(t*0.18*o.sp+o.ph)*0.5, depth=o.z/DEPTH;
      const al=Math.max(0.12, 0.95-depth*0.7);
      let r,g,b; if(o.warm){ r=245-depth*120|0; g=150-depth*80|0; b=70-depth*30|0; } else { r=120-depth*55|0; g=220-depth*110|0; b=215-depth*70|0; }
      ctx.save(); ctx.translate(p.sx,p.sy); ctx.rotate(ang); ctx.globalAlpha=al;
      ctx.fillStyle='rgb('+r+','+g+','+b+')';
      ctx.beginPath(); ctx.moveTo(len*0.6,0); ctx.quadraticCurveTo(0,-ht,-len*0.5,0); ctx.quadraticCurveTo(0,ht,len*0.6,0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-len*0.5,0); ctx.lineTo(-len*0.5-ht*1.1,-ht*(0.9+wig)); ctx.lineTo(-len*0.5-ht*1.1,ht*(0.9-wig)); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=al*0.9; ctx.fillStyle='rgba(8,18,24,1)'; ctx.beginPath(); ctx.arc(len*0.34,-ht*0.18,Math.max(0.6,1.1*s),0,7); ctx.fill();
      ctx.restore();
    }
    function step(){ t++;
      for(let i=0;i<F.length;i++){ const a=F[i]; let ax=0,ay=0,az=0,cx=0,cy=0,cZ=0,sx=0,sy=0,sz=0,n=0,sn=0;
        for(let j=0;j<F.length;j++){ if(i===j) continue; const o=F[j]; const dx=o.x-a.x,dy=o.y-a.y,dz=o.z-a.z,d2=dx*dx+dy*dy+dz*dz;
          if(d2<PER*PER){ ax+=o.vx; ay+=o.vy; az+=o.vz; cx+=o.x; cy+=o.y; cZ+=o.z; n++;
            if(d2<SEP*SEP&&d2>0.001){ const d=Math.sqrt(d2); sx-=dx/d; sy-=dy/d; sz-=dz/d; sn++; } } }
        if(n>0){ ax/=n; ay/=n; az/=n; cx=cx/n-a.x; cy=cy/n-a.y; cZ=cZ/n-a.z;
          a.vx+=(ax-a.vx)*0.04+cx*0.0008; a.vy+=(ay-a.vy)*0.04+cy*0.0008; a.vz+=(az-a.vz)*0.04+cZ*0.0008; }
        if(sn>0){ a.vx+=sx*0.05; a.vy+=sy*0.05; a.vz+=sz*0.05; }
        a.vy+=(h*0.5-a.y)*0.00018; a.vz+=(cz-a.z)*0.00020;
        if(st.on){ const pr=project(a), dx=pr.sx-st.x, dy=pr.sy-st.y, d=Math.hypot(dx,dy); if(d<92&&d>0.01){ const fc=(1-d/92)*0.7; a.vx+=dx/d*fc/pr.s; a.vy+=dy/d*fc/pr.s; a.vz-=fc*0.4; } }
        let v=Math.hypot(a.vx,a.vy,a.vz); if(v>MAX){ a.vx*=MAX/v; a.vy*=MAX/v; a.vz*=MAX/v; } else if(v<MIN&&v>0.001){ a.vx*=MIN/v; a.vy*=MIN/v; a.vz*=MIN/v; }
        a.x+=a.vx; a.y+=a.vy*0.7; a.z+=a.vz;
        if(a.x<-20)a.x+=w+40; else if(a.x>w+20)a.x-=w+40; if(a.y<-20)a.y+=h+40; else if(a.y>h+20)a.y-=h+40;
        if(a.z<0){ a.z=0; a.vz=Math.abs(a.vz); } else if(a.z>DEPTH){ a.z=DEPTH; a.vz=-Math.abs(a.vz); }
      }
    }
    function render(){ ocean();
      ctx.fillStyle='rgba(180,235,255,0.18)';
      for(const o of bub){ o.y-=o.s; o.x+=Math.sin(t*0.02+o.y*0.05)*0.2; if(o.y<-4){ o.y=h+4; o.x=Math.random()*w; } ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,7); ctx.fill(); }
      order.sort((p,q)=>F[q].z-F[p].z); for(const i of order) fish(F[i]);
    }
    function loop(){ step(); render(); raf=requestAnimationFrame(loop); }
    if(reduce){ render(); return ()=>off(); }
    loop(); return ()=>{ cancelAnimationFrame(raf); off(); };
  };}

  // Pathfinder: animates the A* search; drag to toggle walls and it re-solves.
  function path(c){ return function(){ let {ctx,w,h}=fit(c); const cell=Math.max(13,Math.round(Math.min(w,h)/9));
    const nc=Math.max(6,Math.floor(w/cell)), nr=Math.max(4,Math.floor(h/cell)); const ox=(w-nc*cell)/2, oy=(h-nr*cell)/2;
    let wall=new Uint8Array(nc*nr); const si=Math.floor(nr/2)*nc+0, gi=Math.floor(nr/2)*nc+(nc-1);
    let res={order:[],path:[]}, reveal=0, pathRev=0, phase='search', timer=0;
    function recompute(){ res=astar(nc,nr,wall,si,gi); reveal=0; pathRev=0; phase=res.order.length?'search':'done'; timer=0; }
    function randomWalls(){ wall=new Uint8Array(nc*nr); const k=Math.round(nc*nr*0.24); for(let q=0;q<k;q++){ const i=Math.floor(Math.random()*nc*nr); if(i!==si&&i!==gi) wall[i]=1; } recompute(); }
    function cellAt(px,py){ const x=Math.floor((px-ox)/cell), y=Math.floor((py-oy)/cell); if(x<0||y<0||x>=nc||y>=nr) return -1; return y*nc+x; }
    let down=false, mode=-1;
    function pe(e){ const r=c.getBoundingClientRect(); return cellAt(e.clientX-r.left, e.clientY-r.top); }
    function pd(e){ down=true; const i=pe(e); if(i<0||i===si||i===gi){ mode=-1; return; } mode=wall[i]?0:1; wall[i]=mode; recompute(); const hint=c.parentNode.querySelector('.hint'); if(hint) hint.style.opacity=0; }
    function pm(e){ if(!down||mode<0) return; const i=pe(e); if(i<0||i===si||i===gi) return; if(wall[i]!==mode){ wall[i]=mode; recompute(); } }
    function pu(){ down=false; }
    c.addEventListener('pointerdown',pd); c.addEventListener('pointermove',pm,{passive:true}); window.addEventListener('pointerup',pu);
    function cellXY(i){ return {x:ox+(i%nc)*cell, y:oy+((i/nc|0))*cell}; }
    function dc(i,col){ const p=cellXY(i); ctx.fillStyle=col; ctx.fillRect(p.x+1,p.y+1,cell-2,cell-2); }
    let raf;
    function frame(){ ctx.fillStyle='#06070f'; ctx.fillRect(0,0,w,h);
      for(let i=0;i<nc*nr;i++) dc(i, wall[i]?'rgba(255,255,255,0.11)':'rgba(255,255,255,0.03)');
      if(phase==='search'){ reveal=Math.min(res.order.length, reveal+Math.max(1,Math.round(res.order.length/55))); if(reveal>=res.order.length){ phase=res.path.length?'path':'done'; timer=0; } }
      const closedN=(phase==='search')?reveal:res.order.length;
      for(let k=0;k<closedN;k++) dc(res.order[k],'rgba(94,234,212,0.16)');
      if(phase==='search'&&reveal>0) dc(res.order[reveal-1],'rgba(94,234,212,0.55)');
      if(phase==='path'){ pathRev=Math.min(res.path.length, pathRev+1); if(pathRev>=res.path.length){ phase='done'; timer=0; } }
      const pr=(phase==='path')?pathRev:(phase==='done'?res.path.length:0);
      for(let k=0;k<pr;k++) dc(res.path[k],'rgba(167,139,250,0.85)');
      if(phase==='done'){ timer++; if(timer>150&&!down) randomWalls(); }
      dc(si,'#34d399'); dc(gi,'#fb7185');
      raf=requestAnimationFrame(frame);
    }
    randomWalls();
    if(reduce){ phase='done'; reveal=res.order.length; pathRev=res.path.length; frame=function(){}; ctx.fillStyle='#06070f'; ctx.fillRect(0,0,w,h);
      for(let i=0;i<nc*nr;i++) dc(i, wall[i]?'rgba(255,255,255,0.11)':'rgba(255,255,255,0.03)'); for(const i of res.order) dc(i,'rgba(94,234,212,0.16)'); for(const i of res.path) dc(i,'rgba(167,139,250,0.85)'); dc(si,'#34d399'); dc(gi,'#fb7185');
      return ()=>{ c.removeEventListener('pointerdown',pd); c.removeEventListener('pointermove',pm); window.removeEventListener('pointerup',pu); }; }
    frame();
    return ()=>{ cancelAnimationFrame(raf); c.removeEventListener('pointerdown',pd); c.removeEventListener('pointermove',pm); window.removeEventListener('pointerup',pu); };
  };}

  // Wireframe: an icosahedron projected to 2D; drag to rotate.
  function wire(c){ return function(){ let {ctx,w,h}=fit(c); const PHI=1.618033988749;
    const V=[[0,1,PHI],[0,1,-PHI],[0,-1,PHI],[0,-1,-PHI],[1,PHI,0],[1,-PHI,0],[-1,PHI,0],[-1,-PHI,0],[PHI,0,1],[PHI,0,-1],[-PHI,0,1],[-PHI,0,-1]];
    const E=[]; for(let i=0;i<12;i++) for(let j=i+1;j<12;j++){ const dx=V[i][0]-V[j][0],dy=V[i][1]-V[j][1],dz=V[i][2]-V[j][2]; if(Math.abs(dx*dx+dy*dy+dz*dz-4)<0.001) E.push([i,j]); }
    const st={on:false}; const off=ptr(c,st); let raf, rx=0.5, ry=0.4, trx=0.5, try_=0.4;
    const R=Math.min(w,h)*0.62, cx=w/2, cy=h/2, F=4.2;
    function project(){ const cosx=Math.cos(rx),sinx=Math.sin(rx),cosy=Math.cos(ry),siny=Math.sin(ry);
      return V.map(v=>{ const x=v[0],y=v[1],z=v[2]; const y1=y*cosx-z*sinx, z1=y*sinx+z*cosx; const x2=x*cosy+z1*siny, z2=-x*siny+z1*cosy; const s=F/(F-z2*0.42); return {x:cx+x2*R*s*0.32, y:cy+y1*R*s*0.32, z:z2}; }); }
    function draw(){ ctx.fillStyle='#06070f'; ctx.fillRect(0,0,w,h);
      if(st.on){ try_=(st.x/w-0.5)*Math.PI*2.2; trx=(st.y/h-0.5)*Math.PI*1.6; } else { try_+=0.0065; trx+=0.0026; }
      rx+=(trx-rx)*0.08; ry+=(try_-ry)*0.08; const P=project();
      for(const e of E){ const a=P[e[0]], b=P[e[1]]; const dep=(a.z+b.z)/2; const al=Math.max(0.12,Math.min(0.85,0.4+0.42*((dep+2)/4)));
        ctx.strokeStyle='rgba(150,205,255,'+al.toFixed(3)+')'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
      for(const p of P){ ctx.beginPath(); ctx.arc(p.x,p.y,1.7,0,7); ctx.fillStyle='rgba(94,234,212,0.9)'; ctx.fill(); }
      raf=requestAnimationFrame(draw);
    }
    if(reduce){ const P=project(); ctx.fillStyle='#06070f'; ctx.fillRect(0,0,w,h); for(const e of E){ const a=P[e[0]],b=P[e[1]]; ctx.strokeStyle='rgba(150,205,255,0.5)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); } return ()=>off(); }
    draw(); return ()=>{ cancelAnimationFrame(raf); off(); };
  };}

  // Portal: a decorative particle vortex.
  function portal(c){ return function(){ let {ctx,w,h}=fit(c); const cx=w/2, cy=h/2, R=Math.min(w,h)*0.4;
    const N=Math.max(50,Math.min(150,Math.round(w*h/1300))), P=[];
    for(let i=0;i<N;i++) P.push({a:Math.random()*Math.PI*2, r:R*(0.25+Math.random()*1.0), sz:0.8+Math.random()*1.8, c:Math.random()<0.5?'94,234,212':'167,139,250'});
    let raf,t=0;
    function draw(){ t++; ctx.fillStyle='rgba(6,7,15,0.30)'; ctx.fillRect(0,0,w,h); ctx.save(); ctx.translate(cx,cy);
      for(let ring=0;ring<3;ring++){ const rr=R*(0.92+ring*0.05)+Math.sin(t*0.02+ring)*2; ctx.beginPath(); ctx.ellipse(0,0,rr,rr*0.6,0,0,7); ctx.strokeStyle='rgba(167,139,250,'+(0.14-ring*0.04)+')'; ctx.lineWidth=2; ctx.stroke(); }
      for(const p of P){ p.a+=0.004+(R*0.9-p.r)*0.00006+0.006; p.r-=0.16; if(p.r<R*0.16){ p.r=R*(0.95+Math.random()*0.3); p.a=Math.random()*Math.PI*2; }
        const x=Math.cos(p.a)*p.r, y=Math.sin(p.a)*p.r*0.6, al=Math.max(0,Math.min(0.85,1-p.r/(R*1.25)));
        ctx.beginPath(); ctx.arc(x,y,p.sz,0,7); ctx.fillStyle='rgba('+p.c+','+(al*0.7+0.12).toFixed(3)+')'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(0,0,R*0.16,0,7); const gg=ctx.createRadialGradient(0,0,1,0,0,R*0.16); gg.addColorStop(0,'rgba(255,255,255,0.5)'); gg.addColorStop(1,'rgba(167,139,250,0)'); ctx.fillStyle=gg; ctx.fill();
      ctx.restore(); raf=requestAnimationFrame(draw);
    }
    if(reduce){ ctx.fillStyle='#06070f'; ctx.fillRect(0,0,w,h); ctx.save(); ctx.translate(cx,cy); ctx.strokeStyle='rgba(167,139,250,0.45)'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,0,R,R*0.6,0,0,7); ctx.stroke(); ctx.restore(); return ()=>{}; }
    ctx.fillStyle='#06070f'; ctx.fillRect(0,0,w,h); draw(); return ()=>cancelAnimationFrame(raf);
  };}

  const reg={portal,flock,path,wire};
  document.querySelectorAll('canvas[data-demo]').forEach(c=>{ const fn=reg[c.getAttribute('data-demo')]; if(fn) runWhenVisible(c, fn(c)); });
})();
