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
    // Apple-style hover tilt: the WHOLE card tilts uniformly toward the cursor — like Apple's product
    // cards, there is no per-region special-casing. That is deliberate: any "flat over the display,
    // tilt over the body" scheme has a boundary where the tilt shifts the canvas under the cursor and
    // flips the live cursor hit-test, which is what flickered. With one uniform transform nothing
    // toggles, so the cursor stays steady and no JS ever touches it. The angle is read from a rect
    // cached on enter (so the tilt can't feed back on itself), and a gentle 5deg keeps the interactive
    // canvases accurately mappable — a couple of pixels at the very edges, ~0 near the centre.
    document.querySelectorAll('[data-tilt]').forEach(card=>{ const MAX=5; let base=null;
      card.addEventListener('pointerenter', e=>{ if(e.pointerType==='touch') return; base=card.getBoundingClientRect(); card.style.transition='transform 0.12s ease-out'; });
      card.addEventListener('pointermove', e=>{ if(e.pointerType==='touch') return; if(!base) base=card.getBoundingClientRect();
        const px=(e.clientX-base.left)/base.width-0.5, py=(e.clientY-base.top)/base.height-0.5;
        card.style.transform=`rotateY(${(px*MAX*2).toFixed(2)}deg) rotateX(${(-py*MAX*2).toFixed(2)}deg) translateY(-6px)`; }, {passive:true});
      card.addEventListener('pointerleave', ()=>{ card.style.transition='transform 0.5s cubic-bezier(0.22,1,0.36,1)'; card.style.transform=''; base=null; });
    });
  }

  })();
