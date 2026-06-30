// Page chrome: footer year, nav condense on scroll, mobile menu, scroll-reveal, and card tilt.
(function(){
  const reduce = PF.reduce, isChromium = PF.isChromium;
document.getElementById('year').textContent = new Date().getFullYear();

  const bar=document.getElementById('bar');
  const onScroll=()=>bar.classList.toggle('condensed', scrollY>40);
  addEventListener('scroll', onScroll, {passive:true}); onScroll();

  // collapsed menu toggle (<=560px)
  const menuBtn=document.getElementById('menuBtn'), navLinks=document.getElementById('navLinks');
  if(menuBtn && navLinks){
    const setMenu=open=>{ bar.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', open?'true':'false'); menuBtn.setAttribute('aria-label', open?'Close menu':'Open menu'); };
    menuBtn.addEventListener('click', e=>{ e.stopPropagation(); setMenu(!bar.classList.contains('menu-open')); });
    navLinks.querySelectorAll('a').forEach(a=>a.addEventListener('click', ()=>setMenu(false)));
    addEventListener('click', e=>{ if(!bar.contains(e.target)) setMenu(false); });
    addEventListener('keydown', e=>{ if(e.key==='Escape') setMenu(false); });
  }

  const io=new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} }); },{threshold:0.12});
  document.querySelectorAll('.reveal').forEach((el,i)=>{ el.style.transitionDelay=Math.min(i*60,280)+'ms'; io.observe(el); });

  const fineP=matchMedia('(pointer:fine)').matches;
  if(fineP && !reduce && isChromium){
    document.documentElement.classList.add('tilt-on');
    document.querySelectorAll('[data-tilt]').forEach(card=>{ const max=5;
      // Decide everything from a geometry snapshot taken when the pointer enters, never from
      // the live (tilted) layout. The tilt shifts the card, so a live hit-test would flip what
      // is under the cursor, which would flip the tilt, which would shift the card again: that
      // feedback is what made the tilt and the cursor flicker over the interactive displays.
      let base=null, zones=[];
      // measure from a forced-flat card so the zones are always from the untilted layout, and cache
      // each display's own cursor so it can be forced onto the whole card while the pointer is over it
      function snapshot(){ card.style.transition='none'; card.style.transform='';
        base=card.getBoundingClientRect();
        zones=[].map.call(card.querySelectorAll('.preview, .chess-board'), el=>{ const r=el.getBoundingClientRect();
          return { l:r.left, r:r.right, t:r.top, b:r.bottom, cur:getComputedStyle(el).cursor }; }); }
      function displayCursor(x,y){ for(const z of zones){ if(x>=z.l&&x<=z.r&&y>=z.t&&y<=z.b) return z.cur||'crosshair'; } return ''; }
      card.addEventListener('pointerenter', e=>{ if(e.pointerType!=='touch') snapshot(); });
      card.addEventListener('pointermove', e=>{ if(e.pointerType==='touch') return; if(!base) snapshot();
        const cur=displayCursor(e.clientX,e.clientY);
        // over a display: stay flat and force the display's cursor onto the whole card, so the card
        // body (which the tilt can momentarily slide under a fast-moving pointer) shows it too
        if(cur){ card.style.transition='none'; card.style.transform=''; card.style.cursor=cur; return; }
        card.style.transition=''; card.style.cursor='';
        const px=(e.clientX-base.left)/base.width, py=(e.clientY-base.top)/base.height;
        card.style.transform=`rotateY(${(px-0.5)*max*2}deg) rotateX(${-(py-0.5)*max*2}deg) translateY(-4px)`; }, {passive:true});
      card.addEventListener('pointerleave', ()=>{ card.style.transition=''; card.style.transform=''; card.style.cursor=''; base=null; });
    });
  }

  })();
