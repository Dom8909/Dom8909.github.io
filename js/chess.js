// Chess: rules, an alpha-beta engine, and the board UI. No dependencies.
(function(){
  var boardEl=document.getElementById('chessBoard'); if(!boardEl) return;
  var statusEl=document.getElementById('chessStatus'), newBtn=document.getElementById('chessNew');
  var GLYPH={k:'\u265A',q:'\u265B',r:'\u265C',b:'\u265D',n:'\u265E',p:'\u265F'};

  // Move generation and legality.
  var KN=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  var DIR8=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var DIAG=[[-1,-1],[-1,1],[1,-1],[1,1]];
  var ORTH=[[-1,0],[1,0],[0,-1],[0,1]];
  function inb(r,c){ return r>=0&&r<8&&c>=0&&c<8; }
  function opp(c){ return c==='w'?'b':'w'; }
  function startState(){ var b=new Array(64).fill(null); var back=['r','n','b','q','k','b','n','r'];
    for(var c=0;c<8;c++){ b[c]={t:back[c],c:'b'}; b[8+c]={t:'p',c:'b'}; b[48+c]={t:'p',c:'w'}; b[56+c]={t:back[c],c:'w'}; }
    return {board:b, turn:'w', castle:{wK:true,wQ:true,bK:true,bQ:true}, ep:-1}; }
  function attacked(b,r,c,by){
    var pr=by==='w'?r+1:r-1;
    for(var k=0;k<2;k++){ var cc=c+(k?1:-1); if(inb(pr,cc)){ var p=b[pr*8+cc]; if(p&&p.c===by&&p.t==='p') return true; } }
    for(var i=0;i<KN.length;i++){ var tr=r+KN[i][0],tc=c+KN[i][1]; if(inb(tr,tc)){ var p=b[tr*8+tc]; if(p&&p.c===by&&p.t==='n') return true; } }
    for(var i=0;i<DIR8.length;i++){ var tr=r+DIR8[i][0],tc=c+DIR8[i][1]; if(inb(tr,tc)){ var p=b[tr*8+tc]; if(p&&p.c===by&&p.t==='k') return true; } }
    for(var i=0;i<DIAG.length;i++){ var tr=r+DIAG[i][0],tc=c+DIAG[i][1]; while(inb(tr,tc)){ var p=b[tr*8+tc]; if(p){ if(p.c===by&&(p.t==='b'||p.t==='q')) return true; break; } tr+=DIAG[i][0]; tc+=DIAG[i][1]; } }
    for(var i=0;i<ORTH.length;i++){ var tr=r+ORTH[i][0],tc=c+ORTH[i][1]; while(inb(tr,tc)){ var p=b[tr*8+tc]; if(p){ if(p.c===by&&(p.t==='r'||p.t==='q')) return true; break; } tr+=ORTH[i][0]; tc+=ORTH[i][1]; } }
    return false;
  }
  function kingsOf(b,color){ var a=[]; for(var i=0;i<64;i++){ var p=b[i]; if(p&&p.t==='k'&&p.c===color) a.push(i); } return a; }
  function hasSafeKing(b,color){ var ks=kingsOf(b,color); if(!ks.length) return false; for(var i=0;i<ks.length;i++){ if(!attacked(b,ks[i]>>3,ks[i]&7,opp(color))) return true; } return false; }
  function anyKingAttacked(b,color){ var ks=kingsOf(b,color); for(var i=0;i<ks.length;i++){ if(attacked(b,ks[i]>>3,ks[i]&7,opp(color))) return true; } return false; }
  function applyMove(st,m){ var b=st.board.slice(); var ca={wK:st.castle.wK,wQ:st.castle.wQ,bK:st.castle.bK,bQ:st.castle.bQ}; var ep=-1;
    var p=b[m.from]; var color=p.c; var fr=(m.from>>3), tr=(m.to>>3), tc=(m.to&7);
    b[m.to]=p; b[m.from]=null;
    if(p.t==='p'){ if(m.flag==='2'){ ep=(m.from+m.to)/2; } if(m.flag==='ep'){ b[fr*8+tc]=null; } if(tr===0||tr===7){ b[m.to]={t:'q',c:color}; } }
    if(p.t==='k'){ if(m.flag==='cK'){ b[tr*8+5]=b[tr*8+7]; b[tr*8+7]=null; } if(m.flag==='cQ'){ b[tr*8+3]=b[tr*8+0]; b[tr*8+0]=null; } if(color==='w'){ ca.wK=false; ca.wQ=false; } else { ca.bK=false; ca.bQ=false; } }
    if(p.t==='r'){ if(m.from===56) ca.wQ=false; else if(m.from===63) ca.wK=false; else if(m.from===0) ca.bQ=false; else if(m.from===7) ca.bK=false; }
    if(m.to===56) ca.wQ=false; else if(m.to===63) ca.wK=false; else if(m.to===0) ca.bQ=false; else if(m.to===7) ca.bK=false;
    return {board:b, turn:opp(color), castle:ca, ep:ep};
  }
  function genPseudo(st){ var b=st.board, color=st.turn, moves=[];
    for(var idx=0; idx<64; idx++){ var p=b[idx]; if(!p||p.c!==color) continue; var r=(idx>>3), c=(idx&7);
      if(p.t==='p'){ var dir=color==='w'?-1:1, startRow=color==='w'?6:1; var fr=r+dir;
        if(inb(fr,c)&&!b[fr*8+c]){ moves.push({from:idx,to:fr*8+c}); if(r===startRow){ var fr2=r+2*dir; if(!b[fr2*8+c]) moves.push({from:idx,to:fr2*8+c,flag:'2'}); } }
        for(var k=0;k<2;k++){ var cc=c+(k?1:-1), rr=r+dir; if(inb(rr,cc)){ var ti=rr*8+cc, tp=b[ti]; if(tp&&tp.c!==color) moves.push({from:idx,to:ti}); else if(ti===st.ep&&!tp) moves.push({from:idx,to:ti,flag:'ep'}); } }
      } else if(p.t==='n'){ for(var i=0;i<KN.length;i++){ var rr=r+KN[i][0],cc=c+KN[i][1]; if(inb(rr,cc)){ var tp=b[rr*8+cc]; if(!tp||tp.c!==color) moves.push({from:idx,to:rr*8+cc}); } }
      } else if(p.t==='k'){ for(var i=0;i<DIR8.length;i++){ var rr=r+DIR8[i][0],cc=c+DIR8[i][1]; if(inb(rr,cc)){ var tp=b[rr*8+cc]; if(!tp||tp.c!==color) moves.push({from:idx,to:rr*8+cc}); } }
        var rank=color==='w'?7:0; if(r===rank&&c===4){ var ck=color==='w'?st.castle.wK:st.castle.bK, cq=color==='w'?st.castle.wQ:st.castle.bQ, byc=opp(color);
          if(ck&&!b[rank*8+5]&&!b[rank*8+6]&&b[rank*8+7]&&b[rank*8+7].t==='r'&&b[rank*8+7].c===color&&!attacked(b,rank,4,byc)&&!attacked(b,rank,5,byc)&&!attacked(b,rank,6,byc)) moves.push({from:idx,to:rank*8+6,flag:'cK'});
          if(cq&&!b[rank*8+3]&&!b[rank*8+2]&&!b[rank*8+1]&&b[rank*8+0]&&b[rank*8+0].t==='r'&&b[rank*8+0].c===color&&!attacked(b,rank,4,byc)&&!attacked(b,rank,3,byc)&&!attacked(b,rank,2,byc)) moves.push({from:idx,to:rank*8+2,flag:'cQ'});
        }
      } else { var dirs=p.t==='b'?DIAG:p.t==='r'?ORTH:DIR8;
        for(var i=0;i<dirs.length;i++){ var rr=r+dirs[i][0],cc=c+dirs[i][1]; while(inb(rr,cc)){ var ti=rr*8+cc, tp=b[ti]; if(!tp){ moves.push({from:idx,to:ti}); } else { if(tp.c!==color) moves.push({from:idx,to:ti}); break; } rr+=dirs[i][0]; cc+=dirs[i][1]; } }
      }
    } return moves;
  }
  function genLegal(st){ var ps=genPseudo(st), out=[], color=st.turn;
    for(var i=0;i<ps.length;i++){ var ns=applyMove(st,ps[i]); if(hasSafeKing(ns.board,color)) out.push(ps[i]); }
    return out;
  }

  // Search: alpha-beta with quiescence and iterative deepening.
  var PVAL={p:100,n:320,b:330,r:500,q:900,k:20000};
  var PST={
   p:[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
   n:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
   b:[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
   r:[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
   q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
   k:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20]
  };
  function evalState(st){ var b=st.board, sc=0; for(var i=0;i<64;i++){ var p=b[i]; if(!p) continue; var r=(i>>3); var v=PVAL[p.t]+(p.c==='w'?PST[p.t][i]:PST[p.t][(7-r)*8+(i&7)]); sc+=p.c==='w'?v:-v; } return st.turn==='w'?sc:-sc; }
  var T0,TLIM,TIMEOUT={};
  function capVal(st,m){ var t=st.board[m.to]; return t?(PVAL[t.t]||0):(m.flag==='ep'?100:0); }
  function orderMoves(st,ms){ ms.sort(function(a,b){ return capVal(st,b)-capVal(st,a); }); }
  function quiesce(st,alpha,beta){ if((Date.now()-T0)>TLIM) throw TIMEOUT; var stand=evalState(st); if(stand>=beta) return beta; if(stand>alpha) alpha=stand;
    var ms=genLegal(st); orderMoves(st,ms); for(var i=0;i<ms.length;i++){ var m=ms[i]; if(!(st.board[m.to]||m.flag==='ep')) continue; var v=-quiesce(applyMove(st,m),-beta,-alpha); if(v>=beta) return beta; if(v>alpha) alpha=v; } return alpha; }
  function negamax(st,depth,alpha,beta,ply){ if((Date.now()-T0)>TLIM) throw TIMEOUT; var legal=genLegal(st);
    if(!legal.length){ if(!hasSafeKing(st.board,st.turn)) return -100000+ply; return 0; }
    if(depth<=0) return quiesce(st,alpha,beta); orderMoves(st,legal); var best=-1e9;
    for(var i=0;i<legal.length;i++){ var v=-negamax(applyMove(st,legal[i]),depth-1,-beta,-alpha,ply+1); if(v>best) best=v; if(best>alpha) alpha=best; if(alpha>=beta) break; } return best; }
  function bestMove(st,timeMs){ var legal=genLegal(st); if(!legal.length) return null; var best=legal[0]; T0=Date.now(); TLIM=timeMs;
    for(var d=1; d<=6; d++){ try{ var a=-1e9,b=1e9,bm=null,bv=-1e9; orderMoves(st,legal); for(var i=0;i<legal.length;i++){ var v=-negamax(applyMove(st,legal[i]),d-1,-b,-a,1); if(v>bv){ bv=v; bm=legal[i]; } if(bv>a) a=bv; } if(bm) best=bm; }catch(e){ if(e===TIMEOUT) break; else throw e; } if((Date.now()-T0)>timeMs) break; }
    return best; }

  // Board rendering and input.
  var state=null, selected=-1, targets=[], lastMove=null, busy=false, won=false;
  function setStatus(t){ if(statusEl) statusEl.textContent=t; }
  function updateStatus(){ var wK=kingsOf(state.board,'w').length, bK=kingsOf(state.board,'b').length;
    if(bK===0){ setStatus('Every black king has fallen \u2014 you win! \u265A'); return; }
    if(wK===0){ setStatus('All your kings have fallen \u2014 the bot wins.'); return; }
    var legal=genLegal(state);
    if(!legal.length){ if(!hasSafeKing(state.board,state.turn)) setStatus(state.turn==='w'?'Checkmate \u2014 the bot wins.':'Checkmate \u2014 you win!'); else setStatus('Stalemate \u2014 a draw.'); return; }
    if(state.turn==='w') setStatus(anyKingAttacked(state.board,'w')?'Check! \u2014 your move.':'Your move \u2014 you\u2019re White.'); else setStatus('Thinking\u2026'); }
  function gameOver(){ if(kingsOf(state.board,'w').length===0||kingsOf(state.board,'b').length===0) return true; return genLegal(state).length===0; }

  function render(){ var b=state.board; boardEl.innerHTML=''; var chk={}; ['w','b'].forEach(function(col){ var ks=kingsOf(b,col); for(var i=0;i<ks.length;i++){ if(attacked(b,ks[i]>>3,ks[i]&7,opp(col))) chk[ks[i]]=1; } });
    for(var idx=0; idx<64; idx++){ (function(idx){ var r=(idx>>3),c=(idx&7);
      var sq=document.createElement('div'); sq.className='sq '+(((r+c)%2===0)?'light':'dark'); var p=b[idx];
      if(lastMove&&(idx===lastMove.from||idx===lastMove.to)) sq.classList.add('hl');
      if(selected===idx) sq.classList.add('sel');
      if(chk[idx]) sq.classList.add('chk');
      if(p){ var sp=document.createElement('span'); sp.className='pc '+(p.c==='w'?'w':'bk'); sp.textContent=GLYPH[p.t]; sq.appendChild(sp); }
      if(targets.indexOf(idx)>=0){ var d=document.createElement('div'); d.className=p?'cap':'dot'; sq.appendChild(d); }
      sq.addEventListener('click', function(){ onSquare(idx); });
      boardEl.appendChild(sq);
    })(idx); }
  }
  function selectSq(idx){ selected=idx; targets=genLegal(state).filter(function(m){return m.from===idx;}).map(function(m){return m.to;}); render(); }
  function onSquare(idx){ if(busy||won||!state||state.turn!=='w'||gameOver()) return; var p=state.board[idx];
    if(selected>=0){ if(targets.indexOf(idx)>=0){ var mv=genLegal(state).filter(function(m){return m.from===selected&&m.to===idx;})[0]; if(mv) doMove(mv); return; } if(p&&p.c==='w'){ selectSq(idx); return; } selected=-1; targets=[]; render(); }
    else if(p&&p.c==='w'){ selectSq(idx); } }
  function doMove(mv){ state=applyMove(state,mv); lastMove={from:mv.from,to:mv.to}; selected=-1; targets=[]; render(); updateStatus(); if(!gameOver()) engineMove(); }
  function engineMove(){ busy=true; setStatus('Thinking\u2026'); setTimeout(function(){ if(won) return; var mv=bestMove(state,650); if(mv){ state=applyMove(state,mv); lastMove={from:mv.from,to:mv.to}; } selected=-1; targets=[]; render(); updateStatus(); busy=false; }, 30); }

  function newGame(){ state=startState(); selected=-1; targets=[]; lastMove=null; busy=false; won=false; render(); updateStatus(); }
  window.chessGame={
    canPlace:function(){ return !!state && !won && !busy && state.turn==='w' && genLegal(state).length>0; },
    squareAt:function(x,y){ var sqs=boardEl.querySelectorAll('.sq'); for(var i=0;i<sqs.length;i++){ var r=sqs[i].getBoundingClientRect(); if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom) return i; } return -1; },
    placePiece:function(idx,type,color){ if(idx<0||idx>63||!state||won||busy||state.turn!=='w') return false; var tgt=state.board[idx]; if(tgt&&tgt.t==='k'&&tgt.c===color) return false;
      state.board[idx]={t:type,c:color}; state.ep=-1; state.turn='b'; lastMove={from:idx,to:idx}; selected=-1; targets=[]; render();
      if(gameOver()){ if(kingsOf(state.board,'b').length===0) won=true; updateStatus(); } else { engineMove(); } return true; }
  };
  if(newBtn) newBtn.addEventListener('click', newGame);
  newGame();
})();
