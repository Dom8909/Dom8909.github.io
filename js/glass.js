// Liquid-glass backdrop refraction. Chromium only; other browsers use the CSS frost fallback.
(function(){
  const isChromium = PF.isChromium;
  const NS='http://www.w3.org/2000/svg';
  const defs=document.getElementById('lg-defs');
  function buildMap(w,h,r,bezel){
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const ctx=cv.getContext('2d'); const im=ctx.createImageData(w,h); const d=im.data;
    const sd=(x,y)=>{ const qx=Math.abs(x-w/2)-(w/2-r), qy=Math.abs(y-h/2)-(h/2-r); const ax=Math.max(qx,0),ay=Math.max(qy,0); return Math.hypot(ax,ay)+Math.min(Math.max(qx,qy),0)-r; };
    const ss=t=>t*t*t*(t*(t*6-15)+10);
    for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ const s=sd(x+0.5,y+0.5); const inset=-s; let nx=0,ny=0;
      if(inset>=0&&inset<bezel){ const t=inset/bezel; const mag=1-ss(t); const gx=sd(x+1,y)-sd(x-1,y), gy=sd(x,y+1)-sd(x,y-1); const len=Math.hypot(gx,gy)||1; nx=-(gx/len)*mag; ny=-(gy/len)*mag; }
      const i=(y*w+x)*4; d[i]=128+nx*127; d[i+1]=128+ny*127; d[i+2]=128; d[i+3]=255; } }
    ctx.putImageData(im,0,0); return cv.toDataURL();
  }
  function applyGlass(el){
    const rect=el.getBoundingClientRect(); const w=Math.round(rect.width), h=Math.round(rect.height); if(!w||!h) return;
    if(el._lgW===w&&el._lgH===h) return; el._lgW=w; el._lgH=h;
    let r=parseFloat(getComputedStyle(el).borderTopLeftRadius)||0; r=Math.min(r,w/2,h/2);
    const bezel=Math.min(parseFloat(el.dataset.glass)||16, w/2-1, h/2-1); const scale=Math.round(bezel*3.5); const url=buildMap(w,h,r,bezel);
    let id=el._lgId, filter;
    if(!id){ id=el._lgId='lg'+Math.random().toString(36).slice(2,9); filter=document.createElementNS(NS,'filter'); filter.setAttribute('id',id);
      filter.setAttribute('filterUnits','userSpaceOnUse'); filter.setAttribute('primitiveUnits','userSpaceOnUse'); filter.setAttribute('color-interpolation-filters','sRGB'); filter.setAttribute('x','0'); filter.setAttribute('y','0');
      const fe=document.createElementNS(NS,'feImage'); fe.setAttribute('result','map'); const dm=document.createElementNS(NS,'feDisplacementMap'); dm.setAttribute('in','SourceGraphic'); dm.setAttribute('in2','map'); dm.setAttribute('xChannelSelector','R'); dm.setAttribute('yChannelSelector','G');
      filter.appendChild(fe); filter.appendChild(dm); defs.appendChild(filter); el._lgFe=fe; el._lgDm=dm; el._lgFilter=filter;
    } else filter=el._lgFilter;
    filter.setAttribute('width',w); filter.setAttribute('height',h); el._lgFe.setAttribute('width',w); el._lgFe.setAttribute('height',h); el._lgFe.setAttribute('x','0'); el._lgFe.setAttribute('y','0');
    el._lgFe.setAttributeNS('http://www.w3.org/1999/xlink','href',url); el._lgFe.setAttribute('href',url); el._lgDm.setAttribute('scale',scale);
    el.style.backdropFilter=`blur(10px) saturate(195%) brightness(1.14) url(#${id})`;
  }
  if(isChromium){ const targets=[...document.querySelectorAll('[data-glass]')]; const run=()=>targets.forEach(applyGlass);
    requestAnimationFrame(()=>requestAnimationFrame(run)); addEventListener('load',run);
    if('ResizeObserver' in window){ const ro=new ResizeObserver(()=>{ clearTimeout(window._lgT); window._lgT=setTimeout(run,120); }); targets.forEach(t=>ro.observe(t)); }
  }

  })();
