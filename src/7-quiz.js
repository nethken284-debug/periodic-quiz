
/* ===== 測驗區 ===== */
const Quiz=(()=>{
  const root=()=>$("#quiz");
  const SEQ=ELEMENTS.filter(e=>e.n<=20);
  const coarse=window.matchMedia&&matchMedia("(pointer:coarse)").matches;
  let view="home", Q=null, R=null, tmr=null;
  const cfg={scope:"all",count:10};
  try{Object.assign(cfg,JSON.parse(localStorage.getItem("ptq-cfg")||"{}"));}catch(e){}
  const saveCfg=()=>{try{localStorage.setItem("ptq-cfg",JSON.stringify(cfg));}catch(e){}};
  const fmt=ms=>{const s=Math.floor(ms/1000); return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");};
  const weight=n=>1+2*(ST.el[n]?ST.el[n].w:0);   // 答錯越多，權重越高
  const wrongEls=()=>ELEMENTS.filter(e=>ST.el[e.n]&&ST.el[e.n].w>0).sort((a,b)=>ST.el[b.n].w-ST.el[a.n].w);
  function scopeList(scope){
    if(scope==="20") return SEQ;
    if(scope==="wrong") return wrongEls();
    return ELEMENTS;
  }

  /* ---------- 判分 ---------- */
  function align(a,b,ci){   // 對齊兩串字（編輯距離），用來把拼錯的字母標紅
    const A=ci?a.toLowerCase():a, B=ci?b.toLowerCase():b, m=A.length, n=B.length;
    const d=Array.from({length:m+1},(_,i)=>{const r=new Array(n+1).fill(0); r[0]=i; return r;});
    for(let j=0;j<=n;j++) d[0][j]=j;
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(A[i-1]===B[j-1]?0:1));
    const ops=[]; let i=m, j=n;
    while(i>0||j>0){
      if(i>0&&j>0&&d[i][j]===d[i-1][j-1]+(A[i-1]===B[j-1]?0:1)){ops.push({t:A[i-1]===B[j-1]?"eq":"sub",a:a[i-1],b:b[j-1]}); i--; j--;}
      else if(i>0&&d[i][j]===d[i-1][j]+1){ops.push({t:"ins",a:a[i-1]}); i--;}
      else {ops.push({t:"del",b:b[j-1]}); j--;}
    }
    return ops.reverse();
  }
  const dist=(a,b)=>align(a,b,true).filter(o=>o.t!=="eq").length;
  function judgeSym(raw,el){
    const a=raw.trim();
    if(a===el.s) return {ok:true};
    if(a&&a.toLowerCase()===el.s.toLowerCase()){
      if(el.s.length===1) return {ok:false,caseOnly:true,msg:`大小寫錯了！這個符號只有一個字母，要用<b>大寫</b>：應寫成 <b>${el.s}</b>`};
      const t=[]; if(a[0]!==el.s[0]) t.push("第一個字母要<b>大寫</b>"); if(a[1]!==el.s[1]) t.push("第二個字母要<b>小寫</b>");
      return {ok:false,caseOnly:true,msg:`大小寫錯了！${t.join("，")}：應寫成 <b>${el.s}</b>`};
    }
    return {ok:false};
  }
  function judgeName(raw,el){
    const a=raw.trim().replace(/\s+/g," ").toLowerCase(), opts=[el.en,...(el.alt||[])];
    if(opts.some(o=>o.toLowerCase()===a)) return {ok:true};
    let best=opts[0], bd=Infinity;
    for(const o of opts){const d=dist(a,o); if(d<bd){bd=d; best=o;}}
    return {ok:false,target:best};
  }
  function userHTML(raw,target,ci){
    if(!raw) return '<span class="empty-ans">（未作答）</span>';
    return align(raw,target,ci).map(o=>o.t==="eq"?esc(o.a):o.t==="sub"?`<span class="w">${esc(o.a)}</span>`:
      o.t==="ins"?`<span class="xt">${esc(o.a)}</span>`:'<span class="m">_</span>').join("");
  }
  function rightHTML(raw,target,ci){
    if(!raw) return esc(target);
    return align(raw,target,ci).map(o=>o.t==="eq"?esc(o.b):o.t==="ins"?"":`<span class="h">${esc(o.b)}</span>`).join("");
  }
  function answerLine(ok,raw,target,ci){
    return ok?`<span class="ans right">${esc(raw)}</span> <span class="okmark">✔</span>`
      :`<span class="ans">${userHTML(raw,target,ci)}</span> → <span class="ans right">${rightHTML(raw,target,ci)}</span>`;
  }

  /* ---------- 選單 ---------- */
  function home(){
    view="home"; stopTimer();
    const wrong=wrongEls();
    if(cfg.scope==="wrong"&&!wrong.length) cfg.scope="all";
    const bs=ST.best.seq, br=ST.best.rand, pool=scopeList(cfg.scope);
    const tot=pool.reduce((s,e)=>s+weight(e.n),0);
    const top=pool.filter(e=>weight(e.n)>1).sort((a,b)=>weight(b.n)-weight(a.n)).slice(0,4);
    const today=ST.day.date===dstr(new Date())?ST.day.today:0;
    root().innerHTML=`
    <div class="qhome">
      <div class="mode">
        <div class="big">📜</div><h3>順序默寫</h3>
        <p>由 <b>1 號</b>開始，依次寫出每個元素的<b>符號</b>和<b>英文全稱</b>，一直到 <b>20 號</b>。完成後顯示總分、用時和錯題清單。</p>
        <button class="btn" data-go="seq">開始默寫 ▶</button>
        <div class="rec">${bs?`🏆 最佳紀錄：${bs.score}/${bs.max} 分 · ${fmt(bs.time)}`:"還未有紀錄，快來挑戰！"}</div>
      </div>
      <div class="mode">
        <div class="big">🎲</div><h3>隨機抽考</h3>
        <p>隨機抽出原子序讓你作答。<b>答錯次數越多的元素，越常被抽中</b>，專攻你的弱點！</p>
        <div class="opts">
          <span class="lab">範圍</span>
          <div class="seg" id="optScope"><button data-v="all">全部 35 個</button><button data-v="20">1–20 號</button><button data-v="wrong" ${wrong.length?"":"disabled"}>只考錯題</button></div>
          <span class="lab">題數</span>
          <div class="seg" id="optCount"><button data-v="10">10 題</button><button data-v="20">20 題</button><button data-v="0">無限挑戰</button></div>
        </div>
        <button class="btn" data-go="rand">開始抽考 ▶</button>
        <div class="rec">${top.length?`🎯 現在最常被抽中：${top.map(e=>`<b>${e.s}</b> ${Math.round(weight(e.n)/tot*100)}%`).join("、")}`:"🎯 現在每個元素被抽中的機會相同"}${br?`<br>🏆 最佳正確率：${br.pct}%（${br.n} 題）`:""}</div>
      </div>
    </div>
    <div class="box">
      <h3>📒 我的錯題本 <span class="sp"></span>
        <button class="btn sm" data-go="wrong" ${wrong.length?"":"disabled"}>🎯 只練錯題</button>
        <button class="btn danger sm" data-clear>🗑️ 清除紀錄</button></h3>
      ${wrong.length?`<p class="hint" style="margin:0 0 10px">×數字＝累積答錯次數。錯得越多，隨機抽考時越常出現。點一下可以溫習那個元素。</p>
      <div class="wchips">${wrong.map(e=>`<button class="wchip" data-n="${e.n}"><b>${e.s}</b>${e.en} ${e.zh}<span class="c">×${ST.el[e.n].w}</span></button>`).join("")}</div>`
      :'<p class="hint" style="margin:0">暫時沒有錯題 🎉 去考一考，看看自己記得多少！</p>'}
    </div>
    <div class="box">
      <h3>📈 學習進度 <span class="sp"></span><button class="btn ghost sm" data-ach>🏅 查看成就</button></h3>
      <p class="hint" style="margin:0">⭐ 已掌握 ${masteredCount()}/35（連續答對 3 次＝掌握）　·　🔥 連續 ${currentStreak()} 日　·　今日已答 ${today} 題　·　累積 ${ST.total} 題</p>
    </div>`;
    $$("#optScope button").forEach(b=>b.classList.toggle("on",b.dataset.v===cfg.scope));
    $$("#optCount button").forEach(b=>b.classList.toggle("on",+b.dataset.v===cfg.count));
  }

  /* ---------- 作答 ---------- */
  function start(mode,opts={}){
    const o=Object.assign({scope:cfg.scope,count:cfg.count},opts);
    let pool=mode==="seq"?SEQ:(o.list?o.list.map(n=>BY_N[n]):scopeList(o.scope));
    if(!pool.length) pool=ELEMENTS;
    Q={mode,opts:o,pool,total:mode==="seq"?SEQ.length:(o.count||Infinity),i:0,cur:null,last:null,answers:[],
       start:Date.now(),combo:0,maxCombo:0,score:0,max:0,locked:false,hinted:false,emptyWarn:false};
    view="play"; renderPlay(); nextQ(); startTimer();
    window.scrollTo({top:0});
  }
  function renderPlay(){
    const fin=Number.isFinite(Q.total);
    root().innerHTML=`
    <div class="qtop">
      <span class="pill">${Q.mode==="seq"?"📜 順序默寫":"🎲 隨機抽考"}</span>
      <span class="pill" id="qProg"></span><span class="pill" id="qTime">⏱ 00:00</span><span class="pill" id="qScore">得分 0</span>
      <span class="sp"></span>
      <button class="btn ghost sm" data-quit>${fin?"✕ 結束":"🏁 結束並看結果"}</button>
    </div>
    ${fin?`<div class="track" id="track">${"<i></i>".repeat(Q.total)}</div>`:""}
    <div class="qcard" id="qcard">
      <div class="combo hidden" id="combo"></div>
      <div class="mystery">
        <div class="mtile" id="mtile"><span class="face" id="face">🤔</span><span class="n" id="qNum">?</span><span class="l">原子序</span></div>
        <div class="qprompt">這是哪個元素？<br><b>寫出符號和英文全稱</b><div class="zhhint" id="zhHint"></div></div>
      </div>
      <div class="fields">
        <div class="field"><label for="inS">符號 Symbol</label><input id="inS" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" maxlength="4" placeholder="Xx"></div>
        <div class="field"><label for="inN">英文全稱 Full name</label><input id="inN" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" maxlength="24" placeholder="English name"></div>
      </div>
      <div class="qact">
        <button class="btn ghost sm" data-hint id="hintBtn">💡 提示（中文名）</button>
        <span class="sp"></span>
        <span class="kbd">符號 <kbd>Enter</kbd> → 全稱　全稱 <kbd>Enter</kbd> → 提交</span>
        <button class="btn" data-submit id="subBtn">提交 ⏎</button>
      </div>
      <div id="fb" aria-live="polite"></div>
    </div>`;
    const s=$("#inS"), n=$("#inN");
    s.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault(); if(Q&&Q.locked) nextQ(); else n.focus();}});
    n.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault(); submit();}});
  }
  function pick(pool,last){
    const cand=pool.length>1?pool.filter(e=>e.n!==last):pool;
    let r=Math.random()*cand.reduce((s,e)=>s+weight(e.n),0);
    for(const e of cand){r-=weight(e.n); if(r<0) return e;}
    return cand[cand.length-1];
  }
  function nextQ(){
    if(!Q) return;
    if(Q.i>=Q.total){finish(); return;}
    Q.locked=false; Q.hinted=false; Q.emptyWarn=false;
    const el=Q.mode==="seq"?SEQ[Q.i]:pick(Q.pool,Q.last);
    Q.cur=el; Q.last=el.n;
    const s=$("#inS"), n=$("#inN");
    s.value=""; n.value=""; s.className=""; n.className="";
    $("#fb").innerHTML=""; $("#zhHint").textContent=""; $("#hintBtn").disabled=false; $("#subBtn").textContent="提交 ⏎";
    $("#qNum").textContent=el.n; $("#face").textContent="🤔";
    const mt=$("#mtile"); mt.classList.remove("new"); void mt.offsetWidth; mt.classList.add("new");
    updateTop(); s.focus();
  }
  function updateTop(){
    const fin=Number.isFinite(Q.total), k=Q.locked?Q.i:Q.i+1;
    $("#qProg").textContent=fin?`第 ${Math.min(k,Q.total)} / ${Q.total} 題`:`第 ${k} 題`;
    $("#qScore").textContent=`得分 ${Q.score}${Q.max?" / "+Q.max:""}`;
    const tr=$("#track");
    if(tr) [...tr.children].forEach((x,j)=>{const a=Q.answers[j]; x.className=a?(a.pts===2?"ok":a.pts===1?"half":"no"):(j===Q.i&&!Q.locked?"cur":"");});
  }
  function showCombo(){
    const c=$("#combo"); if(!c) return;
    if(Q.combo>=2){c.textContent=`🔥 ${Q.combo} 連擊！`; c.classList.remove("hidden","bump"); void c.offsetWidth; c.classList.add("bump");}
    else c.classList.add("hidden");
  }
  function hint(){
    if(!Q||Q.locked||Q.hinted) return;
    Q.hinted=true; $("#zhHint").textContent="💡 中文名："+Q.cur.zh; $("#hintBtn").disabled=true; sfx.pop();
    if(!coarse) $("#inS").focus();
  }
  function submit(){
    if(view!=="play"||!Q) return;
    if(Q.locked){nextQ(); return;}
    const el=Q.cur, sIn=$("#inS").value, nIn=$("#inN").value;
    if(!sIn.trim()&&!nIn.trim()&&!Q.emptyWarn){
      Q.emptyWarn=true;
      $("#fb").innerHTML='<div class="tip">還未作答喔！想不起的話可以按「💡 提示」；再按一次「提交」就會直接看答案（當答錯計算）。</div>';
      $("#inS").focus(); return;
    }
    const rs=judgeSym(sIn,el), rn=judgeName(nIn,el), pts=(rs.ok?1:0)+(rn.ok?1:0), full=pts===2;
    Q.score+=pts; Q.max+=2; Q.i++;
    Q.answers.push({n:el.n,s:sIn.trim(),nm:nIn.trim().replace(/\s+/g," "),rs,rn,pts});
    const r=rec(el.n); if(full){r.r++; r.k++;} else {r.w++; r.k=0;}
    ST.total++; touchDay();
    const b=$("#mtile").getBoundingClientRect(), fx=b.left+b.width/2, fy=b.top;
    if(full){
      Q.combo++; Q.maxCombo=Math.max(Q.maxCombo,Q.combo); ST.maxCombo=Math.max(ST.maxCombo,Q.combo);
      save(); sfx.ok();
      floaty(`✔ ${el.s} ${el.en}`,fx,fy-6,"var(--good)");
      addXP((Q.hinted?5:10)+Math.min(Q.combo-1,10),fx,fy+34);
      if(Q.combo%5===0){sfx.combo(Q.combo); confetti(70,fx,fy,.8);}
      checkAch();
      nextQ(); if(!Q) return;
      showCombo();
      $("#face").textContent=Q.combo>=5?"😎":"😄";
      setTimeout(()=>{if(Q&&!Q.locked&&$("#face")) $("#face").textContent="🤔";},900);
    }else{
      Q.combo=0; showCombo(); save(); sfx.bad();
      if(pts===1) addXP(3,fx,fy+34);
      Q.locked=true;
      $("#face").textContent=pts===1?"😅":"😵";
      $("#inS").className=rs.ok?"ok":"no"; $("#inN").className=rn.ok?"ok":"no";
      const qc=$("#qcard"); qc.classList.remove("shake"); void qc.offsetWidth; qc.classList.add("shake");
      $("#fb").innerHTML=feedbackHTML(el,rs,rn,sIn.trim(),nIn.trim().replace(/\s+/g," "),pts);
      $("#subBtn").textContent=Q.i>=Q.total?"看結果 ⏎":"下一題 ⏎";
      $("#hintBtn").disabled=true;
      checkAch(); updateTop();
      if(coarse){document.activeElement&&document.activeElement.blur(); $("#fb").scrollIntoView({behavior:"smooth",block:"center"});}
      else $("#inN").focus();
    }
  }
  function feedbackHTML(el,rs,rn,s,n,pts){
    const tips=[];
    if(rs.caseOnly) tips.push("🔠 "+rs.msg);
    if(!rs.ok&&!rs.caseOnly&&el.lat) tips.push(`🏛️ 記住：<b>${el.s}</b> 來自拉丁文 <b>${el.lat.w}</b>，所以符號和英文名對不上。`);
    if(!rn.ok&&el.sp) tips.push("✏️ "+esc(el.sp.zh));
    if(!rn.ok&&el.alt) tips.push(`ℹ️ ${el.en} 和 ${el.alt.join("、")} 兩種拼法都算對。`);
    if(!rs.ok&&!rs.caseOnly&&el.mx) tips.push("🔀 "+esc(el.mx));
    return `<div class="fb"><h4>${pts===1?"差一點！只答對一半":"答錯了"} — ${el.n} 號是「${el.zh}」</h4>
      <div class="row"><span class="k">符號</span><span>${answerLine(rs.ok,s,el.s,false)}</span></div>
      <div class="row"><span class="k">全稱</span><span>${answerLine(rn.ok,n,rn.target||el.en,true)}</span></div>
      ${tips.map(t=>`<div class="tip">${t}</div>`).join("")}
      <div class="hint" style="margin-top:8px">紅色＝你寫錯的字母，<b>_</b>＝漏寫的字母。按 <b>Enter</b> 或「下一題」繼續。</div></div>`;
  }
  function startTimer(){stopTimer(); tmr=setInterval(()=>{const t=$("#qTime"); if(t&&Q) t.textContent="⏱ "+fmt(Date.now()-Q.start);},500);}
  function stopTimer(){if(tmr) clearInterval(tmr); tmr=null;}
  async function quit(){
    if(!Q){home(); return;}
    if(Number.isFinite(Q.total)&&Q.i<Q.total){
      const ok=await ask("要提早結束嗎？",Q.i?`已作答 ${Q.i} 題，會用目前的答案計分。`:"還未作答，會返回選單。","結束");
      if(!ok){if(Q&&!coarse) $("#inS").focus(); return;}
    }
    if(!Q.answers.length){Q=null; home(); return;}
    finish(true);
  }

  /* ---------- 結果 ---------- */
  function finish(early=false){
    stopTimer();
    const time=Date.now()-Q.start, pct=Q.max?Math.round(Q.score/Q.max*100):0;
    let newRec=false; ST.quizzes++;
    if(Q.mode==="seq"&&!early){
      const b=ST.best.seq;
      if(!b||Q.score>b.score||(Q.score===b.score&&time<b.time)){ST.best.seq={score:Q.score,max:Q.max,time}; newRec=true;}
      if(Q.score===Q.max) unlock("perfect");
      if(time<=180000&&pct>=90) unlock("fast");
    }
    if(Q.mode==="rand"&&Q.answers.length>=10){
      const b=ST.best.rand;
      if(!b||pct>b.pct||(pct===b.pct&&Q.answers.length>b.n)){ST.best.rand={pct,n:Q.answers.length}; newRec=true;}
    }
    save(); unlock("first"); checkAch();
    const wrongs=Q.answers.filter(a=>a.pts<2);
    R={mode:Q.mode,opts:Q.opts,score:Q.score,max:Q.max,time,pct,newRec,answers:Q.answers,maxCombo:Q.maxCombo,wrongNs:[...new Set(wrongs.map(a=>a.n))]};
    Q=null; view="result"; renderResult();
  }
  function renderResult(){
    const r=R, p=r.pct, wrongs=r.answers.filter(a=>a.pts<2);
    const [medal,title]=p===100?["🏆","完美！你是元素大師！"]:p>=90?["🥇","超級厲害！"]:p>=75?["🥈","做得好！"]:p>=50?["🥉","不錯，繼續加油！"]:["💪","多溫習幾次，一定得！"];
    root().innerHTML=`<div class="result">
      <div class="medal">${medal}</div><h2>${title}</h2>
      <div class="score" id="scoreNum">0 / ${r.max}</div><div class="hint">總分（每題符號 1 分＋全稱 1 分）</div>
      ${r.newRec?'<div style="margin-top:8px"><span class="newrec">🎉 新紀錄！</span></div>':""}
      <div class="rstats"><span class="pill">⏱ 用時 ${fmt(r.time)}</span><span class="pill">✅ 正確率 ${p}%</span><span class="pill">🔥 最高連擊 ${r.maxCombo}</span><span class="pill">📝 共 ${r.answers.length} 題</span></div>
      <div class="box wlist">
        <h3>❌ 錯題清單（${wrongs.length} 題）</h3>
        ${wrongs.length?'<p class="hint" style="margin:-4px 0 10px">紅色＝寫錯的字母，_＝漏寫的字母，綠色底線＝正確答案中你寫錯的位置。點一下可以溫習。</p>'+wrongs.map(a=>{const e=BY_N[a.n]; return `
          <div class="witem" data-n="${e.n}" title="點擊溫習">
            <div class="el">${e.s}<small>${e.n} ${e.zh}</small></div>
            <div class="lines">
              <div class="ln"><span class="k">符號</span>${answerLine(a.rs.ok,a.s,e.s,false)}${a.rs.caseOnly?' <span class="hint">（大小寫錯）</span>':""}</div>
              <div class="ln"><span class="k">全稱</span>${answerLine(a.rn.ok,a.nm,a.rn.target||e.en,true)}</div>
            </div></div>`;}).join(""):'<p class="hint" style="margin:0">一題錯題都沒有！🎉</p>'}
      </div>
      <div class="racts">
        <button class="btn" data-again>🔁 再來一次</button>
        ${wrongs.length?'<button class="btn ghost" data-retrywrong>🎯 練習這次的錯題</button>':""}
        <button class="btn ghost" data-home>🏠 返回選單</button>
      </div></div>`;
    const el=$("#scoreNum"), t0=performance.now();
    const step=now=>{const k=Math.min(1,(now-t0)/900); el.textContent=Math.round(r.score*(1-Math.pow(1-k,3)))+" / "+r.max; if(k<1) requestAnimationFrame(step);};
    requestAnimationFrame(step);
    if(p>=80){sfx.win(); confetti(p===100?220:120);} else sfx.pop();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  async function clearAll(){
    const ok=await ask("清除所有紀錄？","錯題紀錄、掌握星星、最佳成績、經驗值和成就都會被刪除，不能復原。","清除",true);
    if(!ok) return;
    ST=fresh(); save(); updateHeader(); home(); toast("🧹","已清除所有紀錄","可以重新開始挑戰了！");
  }

  function onClick(ev){
    const t=ev.target, has=s=>t.closest(s);
    const go=has("[data-go]");
    if(go){const g=go.dataset.go; if(g==="seq") start("seq"); else if(g==="rand") start("rand"); else start("rand",{scope:"wrong"}); return;}
    const sc=has("#optScope button"); if(sc){cfg.scope=sc.dataset.v; saveCfg(); home(); return;}
    const ct=has("#optCount button"); if(ct){cfg.count=+ct.dataset.v; saveCfg(); home(); return;}
    if(has("[data-clear]")){clearAll(); return;}
    if(has("[data-ach]")){showAch(); return;}
    if(has("[data-submit]")){submit(); return;}
    if(has("[data-hint]")){hint(); return;}
    if(has("[data-quit]")){quit(); return;}
    if(has("[data-again]")){start(R.mode,R.opts); return;}
    if(has("[data-retrywrong]")){start("rand",{list:R.wrongNs,count:Math.min(20,Math.max(6,R.wrongNs.length*2))}); return;}
    if(has("[data-home]")){home(); return;}
    const w=has("[data-n]");
    if(w){
      const list=view==="result"?R.wrongNs.map(n=>BY_N[n]):wrongEls();
      Review.openCard(+w.dataset.n,list.length?list:undefined);
    }
  }
  function init(){
    root().addEventListener("click",onClick);
    document.addEventListener("keydown",e=>{
      if(view!=="play"||!Q||!Q.locked||e.key!=="Enter"||$("#modalHost").firstElementChild||root().classList.contains("hidden")) return;
      if(e.target.tagName==="INPUT"||e.target.tagName==="BUTTON") return;
      e.preventDefault(); nextQ();
    });
    home();
  }
  function onShow(){
    if(view==="home") home();
    else if(view==="play"&&Q&&!coarse) $(Q.locked?"#inN":"#inS").focus();
  }
  return {init,onShow};
})();

/* ===== 啟動 ===== */
function setTab(t){
  const q=t==="quiz";
  $("#tabbar").classList.toggle("q",q);
  $("#tabR").classList.toggle("on",!q); $("#tabQ").classList.toggle("on",q);
  $("#tabR").setAttribute("aria-selected",String(!q)); $("#tabQ").setAttribute("aria-selected",String(q));
  $("#review").classList.toggle("hidden",q); $("#quiz").classList.toggle("hidden",!q);
  try{localStorage.setItem("ptq-tab",t);}catch(e){}
  window.scrollTo({top:0});
  if(q) Quiz.onShow(); else Review.onShow();
}
load(); sizeFX(); addEventListener("resize",sizeFX);
Review.init(); Quiz.init();
$("#tabR").addEventListener("click",()=>setTab("review"));
$("#tabQ").addEventListener("click",()=>setTab("quiz"));
$("#achBtn").addEventListener("click",showAch);
$("#sndBtn").addEventListener("click",()=>{SOUND=!SOUND; try{localStorage.setItem("ptq-sound",SOUND?"1":"0");}catch(e){} updateHeader(); if(SOUND) sfx.pop();});
document.addEventListener("pointerdown",()=>ac(),{once:true});
updateHeader();
let startTab="review"; try{if(localStorage.getItem("ptq-tab")==="quiz") startTab="quiz";}catch(e){}
setTab(startTab);
