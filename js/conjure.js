// Conjure: type a word and drag the result onto the page; chess pieces snap to the board.
(function(){
  var input=document.getElementById('spawnInput'), btn=document.getElementById('spawnBtn'); if(!input) return;
  var PIECES={queen:'q',king:'k',rook:'r',bishop:'b',knight:'n',horse:'n',pawn:'p'};
  var GLY={k:'\u265A',q:'\u265B',r:'\u265C',b:'\u265D',n:'\u265E',p:'\u265F'};

  // Drop-to-delete bin: appears only while conjured objects exist, opens its lid when one hovers it.
  var trash=document.createElement('div'); trash.className='trash'; trash.setAttribute('aria-hidden','true');
  trash.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><g class="trash-lid"><line x1="4" y1="6.5" x2="20" y2="6.5"/><path d="M9.5 6.5 V4.7 a1 1 0 0 1 1-1 h3 a1 1 0 0 1 1 1 V6.5"/></g><g class="trash-can"><path d="M6.6 7.6 L7.5 19.3 a1.6 1.6 0 0 0 1.6 1.5 h5.8 a1.6 1.6 0 0 0 1.6-1.5 L17.4 7.6"/><line x1="10.2" y1="10.6" x2="10.5" y2="17.4"/><line x1="13.8" y1="10.6" x2="13.5" y2="17.4"/></g></svg>';
  document.body.appendChild(trash);
  var liveCount=0;
  function updateTrash(){ if(liveCount>0) trash.classList.add('show'); else trash.classList.remove('show','armed'); }
  function overTrash(x,y){ if(liveCount<=0) return false; var r=trash.getBoundingClientRect(), m=16; return x>=r.left-m && x<=r.right+m && y>=r.top-m && y<=r.bottom+m; }

  function makeDraggable(el){ var ox=0,oy=0,drag=false;
    el.addEventListener('pointerdown', function(e){ drag=true; el.classList.add('grabbing'); try{el.setPointerCapture(e.pointerId);}catch(_){} ox=e.clientX-el._x; oy=e.clientY-el._y; e.preventDefault(); e.stopPropagation(); });
    el.addEventListener('pointermove', function(e){ if(!drag) return; el._x=e.clientX-ox; el._y=e.clientY-oy; place(el); trash.classList.toggle('armed', overTrash(e.clientX,e.clientY)); });
    el.addEventListener('pointerup', function(e){ if(!drag) return; drag=false; el.classList.remove('grabbing'); try{el.releasePointerCapture(e.pointerId);}catch(_){}
      var bin=overTrash(e.clientX,e.clientY); trash.classList.remove('armed'); if(bin){ consume(el); return; } onDrop(el,e.clientX,e.clientY); });
    el.addEventListener('click', function(e){ e.stopPropagation(); });
  }
  function place(el){ el.style.transform='translate('+(el._x-el.offsetWidth/2)+'px,'+(el._y-el.offsetHeight/2)+'px)'; }

  function consume(el){ if(el._gone) return; el._gone=true; el.style.opacity='0'; setTimeout(function(){ el.remove(); }, 220); liveCount=Math.max(0,liveCount-1); updateTrash(); }
  function onDrop(el,x,y){
    // A piece dropped on a board square is placed there (your turn only);
    // capturing or checking every enemy king wins.
    var cg=window.chessGame;
    if(el.dataset.piece && cg && cg.canPlace && cg.canPlace()){ var idx=cg.squareAt(x,y); if(idx>=0 && cg.placePiece(idx, el.dataset.piece, el.dataset.color)){ consume(el); return; } }
    // otherwise leave it where it was dropped
  }

  // Replace the text chip with a matching Iconify icon. On no match or a failed
  // request, the text chip is left in place.
  function addIcon(el,text){ var q=text.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); if(!q) return;
    fetch('https://api.iconify.design/search?query='+encodeURIComponent(q)+'&limit=6')
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(j){ if(!j||!j.icons||!j.icons.length) return; var name=j.icons[0];
        var img=new Image(); img.className='ico'; img.alt=text; img.draggable=false; img.decoding='async';
        img.onload=function(){ if(el.isConnected){ el.innerHTML=''; el.appendChild(img); place(el); } };
        img.src='https://api.iconify.design/'+name.replace(':','/')+'.svg?height=44&color=%23f4f4ef';
      })
      .catch(function(){});
  }

  function spawn(text){ text=(text||'').trim(); if(!text) return; var lo=text.toLowerCase();
    var el=document.createElement('div'); el.className='spawn-item';
    var piece=null; for(var k in PIECES){ if(lo.indexOf(k)>=0){ piece=PIECES[k]; break; } }
    if(piece){ var color=lo.indexOf('black')>=0?'b':'w'; var g=document.createElement('span'); g.className='pcg '+(color==='w'?'w':'bk'); g.textContent=GLY[piece]; el.appendChild(g); el.dataset.piece=piece; el.dataset.color=color; }
    else { var l=document.createElement('span'); l.className='lbl'; l.textContent=text; el.appendChild(l); }
    document.body.appendChild(el);
    var r=input.getBoundingClientRect(); el._x=r.left+r.width/2+(Math.random()*40-20); el._y=r.top-44; place(el);
    requestAnimationFrame(function(){ el.style.opacity='1'; });
    makeDraggable(el);
    liveCount++; updateTrash();
    if(!piece) addIcon(el,text);
  }
  function go(){ spawn(input.value); input.value=''; input.focus(); }
  if(btn) btn.addEventListener('click', go);
  input.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); go(); } });
})();
