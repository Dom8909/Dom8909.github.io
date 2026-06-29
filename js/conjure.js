/* conjure: type-and-drag spawner (+ Iconify lookup) — part of Dominic Iannopollo's portfolio. Shared flags live in core.js (window.PF). */
(function(){
  var input=document.getElementById('spawnInput'), btn=document.getElementById('spawnBtn'); if(!input) return;
  var PIECES={queen:'q',king:'k',rook:'r',bishop:'b',knight:'n',horse:'n',pawn:'p'};
  var GLY={k:'\u265A',q:'\u265B',r:'\u265C',b:'\u265D',n:'\u265E',p:'\u265F'};

  function makeDraggable(el){ var ox=0,oy=0,drag=false;
    el.addEventListener('pointerdown', function(e){ drag=true; el.classList.add('grabbing'); try{el.setPointerCapture(e.pointerId);}catch(_){} ox=e.clientX-el._x; oy=e.clientY-el._y; e.preventDefault(); e.stopPropagation(); });
    el.addEventListener('pointermove', function(e){ if(!drag) return; el._x=e.clientX-ox; el._y=e.clientY-oy; place(el); });
    el.addEventListener('pointerup', function(e){ if(!drag) return; drag=false; el.classList.remove('grabbing'); try{el.releasePointerCapture(e.pointerId);}catch(_){} onDrop(el,e.clientX,e.clientY); });
    el.addEventListener('click', function(e){ e.stopPropagation(); });
  }
  function place(el){ el.style.transform='translate('+(el._x-el.offsetWidth/2)+'px,'+(el._y-el.offsetHeight/2)+'px)'; }

  function consume(el){ el.style.opacity='0'; setTimeout(function(){ el.remove(); }, 220); }
  function onDrop(el,x,y){
    /* 1) chess: drop a conjured piece onto a board square (only on your turn).
          dropping onto an enemy king captures it; taking/checking ALL enemy kings wins. */
    var cg=window.chessGame;
    if(el.dataset.piece && cg && cg.canPlace && cg.canPlace()){ var idx=cg.squareAt(x,y); if(idx>=0 && cg.placePiece(idx, el.dataset.piece, el.dataset.color)){ consume(el); return; } }
    /* otherwise leave it where dropped */
  }

  /* upgrade a text chip to a matching icon from Iconify (free, no key, CORS).
     if nothing matches or the network is unavailable, the text chip stays. */
  function addIcon(el,text){ var q=text.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); if(!q) return;
    fetch('https://api.iconify.design/search?query='+encodeURIComponent(q)+'&limit=6')
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(j){ if(!j||!j.icons||!j.icons.length) return; var name=j.icons[0];
        var img=new Image(); img.className='ico'; img.alt=text; img.draggable=false; img.decoding='async';
        img.onload=function(){ if(el.isConnected){ el.innerHTML=''; el.appendChild(img); place(el); el._payload={kind:'img', img:img}; } };
        img.src='https://api.iconify.design/'+name.replace(':','/')+'.svg?height=44&color=%23f4f4ef';
      })
      .catch(function(){});
  }

  function spawn(text){ text=(text||'').trim(); if(!text) return; var lo=text.toLowerCase();
    var el=document.createElement('div'); el.className='spawn-item';
    var piece=null; for(var k in PIECES){ if(lo.indexOf(k)>=0){ piece=PIECES[k]; break; } }
    if(piece){ var color=lo.indexOf('black')>=0?'b':'w'; var g=document.createElement('span'); g.className='pcg '+(color==='w'?'w':'bk'); g.textContent=GLY[piece]; el.appendChild(g); el.dataset.piece=piece; el.dataset.color=color; el._payload={kind:'glyph', ch:GLY[piece], dark:(color==='b')}; }
    else { var l=document.createElement('span'); l.className='lbl'; l.textContent=text; el.appendChild(l); el._payload={kind:'text', text:text}; }
    document.body.appendChild(el);
    var r=input.getBoundingClientRect(); el._x=r.left+r.width/2+(Math.random()*40-20); el._y=r.top-44; place(el);
    requestAnimationFrame(function(){ el.style.opacity='1'; });
    makeDraggable(el);
    if(!piece) addIcon(el,text);
  }
  function go(){ spawn(input.value); input.value=''; input.focus(); }
  if(btn) btn.addEventListener('click', go);
  input.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); go(); } });
})();
