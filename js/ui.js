/* ui: year, nav condense, mobile menu, scroll-reveal, card tilt — part of Dominic Iannopollo's portfolio. Shared flags live in core.js (window.PF). */
(function(){
  const reduce = PF.reduce, isChromium = PF.isChromium;
document.getElementById('year').textContent = new Date().getFullYear();

  const bar=document.getElementById('bar');
  const onScroll=()=>bar.classList.toggle('condensed', scrollY>40);
  addEventListener('scroll', onScroll, {passive:true}); onScroll();

  /* mobile nav: collapsed hamburger menu (<=560px) */
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
      card.addEventListener('mousemove', e=>{ const r=card.getBoundingClientRect(); const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
        card.style.transform=`rotateY(${(px-0.5)*max*2}deg) rotateX(${-(py-0.5)*max*2}deg) translateY(-4px)`; });
      card.addEventListener('mouseleave', ()=>{ card.style.transform=''; });
    });
  }

  })();
