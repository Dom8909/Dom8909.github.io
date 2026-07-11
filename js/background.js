// Background grid: click cells to fill them; completing a same-color square clears it.
(function(){
  const reduce = PF.reduce;
  (function(){
    const cv=document.getElementById('grid'); if(!cv) return; const ctx=cv.getContext('2d');
    function rr(x,y,w,h,r){ ctx.beginPath(); if(ctx.roundRect){ ctx.roundRect(x,y,w,h,r); } else { ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); } }
    const cell=92, pad=8, rad=18, lw=4; let cols=0, dpr=1; const on=new Map(), hits=new Map(); let hoverKey=null;
    // Full spectrum, ordered so each successive click on a tile jumps ~150 deg in hue (no two steps blend together).
    const palette=['#e05a5a','#3fbfae','#d45aa0','#9bd44a','#8a6ae0','#e8954a','#4ab9d4','#e05a82','#4ec07a','#b15ad4','#e6cf4a','#5a82e0'];
    function resize(){ dpr=Math.min(devicePixelRatio||1, matchMedia('(hover: none) and (pointer: coarse)').matches?1:2); cv.width=innerWidth*dpr; cv.height=innerHeight*dpr; cv.style.width=innerWidth+'px'; cv.style.height=innerHeight+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); cols=Math.ceil(innerWidth/cell); draw(); }
    function draw(){ ctx.clearRect(0,0,innerWidth,innerHeight);
      const nc=Math.ceil(innerWidth/cell), nr=Math.ceil(innerHeight/cell);
      ctx.strokeStyle='rgba(255,255,255,0.09)'; ctx.lineWidth=lw;
      for(let r=0;r<nr;r++){ for(let c=0;c<nc;c++){ rr(c*cell+pad, r*cell+pad, cell-pad*2, cell-pad*2, rad); ctx.stroke(); } }
      on.forEach((col,key)=>{ const p=key.split(','); const x=p[1]*cell, y=p[0]*cell; ctx.fillStyle=col; ctx.shadowBlur=4; ctx.shadowColor=col; rr(x+pad,y+pad,cell-pad*2,cell-pad*2,rad); ctx.fill(); }); ctx.shadowBlur=0;
      if(hoverKey && !on.has(hoverKey)){ const p=hoverKey.split(','); ctx.fillStyle='rgba(255,255,255,0.06)'; rr(p[1]*cell+pad,p[0]*cell+pad,cell-pad*2,cell-pad*2,rad); ctx.fill(); }
    }
    // largest same-color square (size 8/6/4/2) covering r,c, or null
    function checkMatch(r,c){ const col=on.get(r+','+c); if(!col) return null;
      for(const s of [8,6,4,2]){
        for(let r0=r-s+1;r0<=r;r0++){ for(let c0=c-s+1;c0<=c;c0++){ let ok=true;
          for(let dr=0;dr<s&&ok;dr++){ for(let dc=0;dc<s;dc++){ if(on.get((r0+dr)+','+(c0+dc))!==col){ ok=false; break; } } }
          if(ok) return {s,r0,c0}; } }
      }
      return null; }
    // expanding ring burst drawn with grid cells
    let bursts=[], fwRaf=null, fwStart=0;
    function startFireworks(br,bc,size){ bursts=[]; const n=Math.max(2,Math.round(size));
      for(let i=0;i<n;i++){ const ang=Math.random()*6.283, dist=Math.random()*size*0.55;
        bursts.push({ br:Math.round(br+Math.sin(ang)*dist), bc:Math.round(bc+Math.cos(ang)*dist),
          delay:i*(120+Math.random()*140), col:palette[Math.floor(Math.random()*palette.length)],
          maxR:Math.max(2,Math.round(size*0.6)+2), dur:520+Math.random()*240 }); }
      fwStart=performance.now(); if(!fwRaf) fwLoop(); }
    function fwLoop(){ const el=performance.now()-fwStart; const eff=new Map(); let alive=false;
      for(const b of bursts){ const age=el-b.delay; if(age<0){ alive=true; continue; } if(age>b.dur+120) continue; alive=true;
        const radius=(age/b.dur)*b.maxR, R=Math.ceil(b.maxR);
        for(let dr=-R;dr<=R;dr++){ for(let dc=-R;dc<=R;dc++){ const d=Math.hypot(dr,dc); const inten=1-Math.abs(d-radius)/0.95;
          if(inten>0.06){ const rr2=b.br+dr, cc=b.bc+dc; if(rr2<0||cc<0) continue; const key=rr2+','+cc;
            const a=Math.min(inten*(1-age/(b.dur+120)),1); const prev=eff.get(key); if(!prev||a>prev.a) eff.set(key,{col:b.col,a}); } } }
      }
      draw();
      eff.forEach((v,key)=>{ const p=key.split(','); const x=p[1]*cell, y=p[0]*cell; ctx.globalAlpha=Math.max(v.a,0); ctx.fillStyle=v.col; ctx.shadowBlur=8; ctx.shadowColor=v.col; rr(x+pad,y+pad,cell-pad*2,cell-pad*2,rad); ctx.fill(); });
      ctx.globalAlpha=1; ctx.shadowBlur=0;
      if(alive){ fwRaf=requestAnimationFrame(fwLoop); } else { fwRaf=null; draw(); } }
    // Fusion: before the burst, the matched tiles rush together into a bright core, which then erupts.
    let fusion=null, fusRaf=null;
    function startFusion(cells, col, br, bc, size){
      fusion={ cells:cells.map(k=>{ const p=k.split(','); return {r:+p[0], c:+p[1]}; }), col, br, bc, size, start:performance.now(), dur:560 };
      fusionLoop(); }
    function fusionLoop(){ if(!fusion) return;
      const p=Math.min(1,(performance.now()-fusion.start)/fusion.dur), conv=1-Math.pow(1-p,3);
      const cx=(fusion.bc+0.5)*cell, cy=(fusion.br+0.5)*cell;
      draw();
      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(const t of fusion.cells){ const ocx=(t.c+0.5)*cell, ocy=(t.r+0.5)*cell;
        const x=ocx+(cx-ocx)*conv, y=ocy+(cy-ocy)*conv, sz=(cell-pad*2)*(1-0.42*conv);
        ctx.fillStyle=fusion.col; ctx.shadowBlur=8+26*p; ctx.shadowColor=fusion.col;
        rr(x-sz/2, y-sz/2, sz, sz, rad); ctx.fill(); }
      if(p>0.4){ const cp=(p-0.4)/0.6, R=cell*(0.35+0.8*cp);   // white-hot core builds up in the second half
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
        g.addColorStop(0,'rgba(255,255,255,'+(0.55+0.45*cp).toFixed(3)+')'); g.addColorStop(0.45,fusion.col); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R,0,6.283); ctx.fill(); }
      ctx.restore(); ctx.shadowBlur=0;
      if(p<1){ fusRaf=requestAnimationFrame(fusionLoop); }
      else { const f=fusion; fusion=null; fusRaf=null; startFireworks(f.br, f.bc, f.size); } }
    addEventListener('resize', ()=>{ clearTimeout(window._gT); window._gT=setTimeout(resize,120); });
    addEventListener('click', e=>{ if(e.target.closest('.lg, canvas, a, button, .hero-copy, .spawn-item')) return; const r=Math.floor(e.clientY/cell), c=Math.floor(e.clientX/cell), key=r+','+c;
      if(!on.has(key)){ on.set(key, palette[Math.floor(Math.random()*palette.length)]); hits.set(key,1); }  // first tap starts on a random colour, so squares don't line up by accident
      else { const n=(hits.get(key)||1)+1;                          // repeat taps step through the whole list in order, then clear
        if(n>palette.length){ on.delete(key); hits.delete(key); draw(); return; }
        on.set(key, palette[(palette.indexOf(on.get(key))+1)%palette.length]); hits.set(key,n); }
      const m=checkMatch(r,c);
      if(m){ const cells=[]; for(let dr=0;dr<m.s;dr++)for(let dc=0;dc<m.s;dc++) cells.push((m.r0+dr)+','+(m.c0+dc));
        const col=on.get(cells[0]); cells.forEach(k=>{ on.delete(k); hits.delete(k); });
        if(!reduce){ startFusion(cells, col, m.r0+(m.s-1)/2, m.c0+(m.s-1)/2, m.s); return; } }  // fusion drives the redraw, then bursts
      draw(); });
    if(matchMedia('(pointer:fine)').matches){ addEventListener('mousemove', e=>{ const over=e.target.closest('.lg, canvas, a, button, .hero-copy, .spawn-item'); const key=over?null:(Math.floor(e.clientY/cell)+','+Math.floor(e.clientX/cell)); if(key!==hoverKey){ hoverKey=key; if(!fwRaf && !fusRaf) draw(); } }, {passive:true}); }
    resize();
  })();

  })();
