
/* ===== 溫習區 ===== */
const Review=(()=>{
  const F={c:"all",s:"all",q:"",layout:"grid",cover:false};
  let shown=ELEMENTS.slice(), spinning=false;

  function match(e){
    if(F.c!=="all"&&e.c!==F.c) return false;
    if(F.s!=="all"&&e.st!==F.s) return false;
    const q=F.q.trim().toLowerCase(); if(!q) return true;
    return String(e.n)===q||e.s.toLowerCase().startsWith(q)||e.en.toLowerCase().includes(q)||
      (e.alt||[]).some(a=>a.toLowerCase().includes(q))||e.zh.includes(q);
  }
  function tileHTML(e,i,style=""){
    const r=ST.el[e.n], tried=r&&(r.r+r.w>0);
    return `<button class="tile c-${e.c}" data-n="${e.n}" style="animation-delay:${Math.min(i*16,520)}ms;${style}" aria-label="${e.n} ${e.s} ${e.en} ${e.zh}">
      <span class="in"><span class="f"><span class="num">${e.n}</span><span class="stt" title="${STATE[e.st]}">${ST_SYM[e.st]}</span>
        <span class="sym">${e.s}</span><span class="nm">${e.en}</span><span class="zh">${e.zh}</span>${tried?`<span class="stars">${starStr(e.n)}</span>`:""}</span>
      <span class="b"><span class="num">${e.n}</span><span class="q">?</span></span></span>
      ${r&&r.w?`<span class="wrong" title="答錯 ${r.w} 次">${r.w}</span>`:""}</button>`;
  }
  function render(){
    const host=$("#gridHost"); shown=ELEMENTS.filter(match);
    const cv=F.cover?"cover":"";
    if(F.layout==="grid"){
      host.innerHTML=`<div class="grid ${cv}" id="grid">${shown.length?shown.map((e,i)=>tileHTML(e,i)).join(""):'<div class="empty">找不到符合的元素 🤔</div>'}</div>`;
    }else{
      const at={}; ELEMENTS.forEach(e=>at[e.p+"-"+e.g]=e);
      const cells=[];
      for(let p=1;p<=6;p++) for(let g=1;g<=18;g++){
        const valid=p===1?(g===1||g===18):p<=3?(g<=2||g>=13):true; if(!valid) continue;
        const e=at[p+"-"+g], pos=`grid-row:${p};grid-column:${g};`;
        if(e) cells.push(tileHTML(e,cells.length,pos+(match(e)?"":"opacity:.18;filter:grayscale(1);")));
        else cells.push(`<div class="vac" style="${pos}"></div>`);
      }
      host.innerHTML=`<div class="ptwrap"><div class="grid pt ${cv}" id="grid">${cells.join("")}</div></div>
        <p class="hint" style="margin:0 0 30px">灰色格子是不用背的元素。手機可以左右滑動，看完整個週期表。</p>`;
    }
  }
  function setCover(on){
    F.cover=on;
    $("#coverBtn").textContent=on?"👀 顯示全部答案":"🙈 遮住答案自測";
    $("#rvHint").textContent=on?"🤔 先想想是哪個元素，再點一下翻開答案；翻開後再點一次就看介紹。":"👆 點任何一格，看詳細介紹卡片。";
    render();
  }
  function spin(){
    if(spinning) return;
    const tiles=$$("#grid .tile").filter(t=>!t.style.opacity); if(!tiles.length) return;
    spinning=true; let steps=14+Math.floor(Math.random()*8), i=Math.floor(Math.random()*tiles.length), delay=55, prev=null;
    const hop=()=>{
      if(prev) prev.classList.remove("spot");
      const t=tiles[i]; t.classList.add("spot"); prev=t; sfx.tick();
      if(--steps<=0){
        setTimeout(()=>{t.classList.remove("spot"); spinning=false; sfx.pop(); openCard(+t.dataset.n);},450);
        return;
      }
      if(tiles.length>1) i=(i+1+Math.floor(Math.random()*(tiles.length-1)))%tiles.length;
      delay*=1.12; setTimeout(hop,delay);
    };
    hop();
  }

  /* ---------- 詳細介紹卡片 ---------- */
  let cardN=null, cardList=ELEMENTS, tryDone=false;
  const hl=s=>esc(s).replace(/\{([^}]*)\}/g,"<mark>$1</mark>");
  function latinWord(e){
    const w=e.lat.w, a=e.s[0], b=e.s[1];
    if(!b) return `<u>${w[0]}</u>${w.slice(1)}`;
    const j=w.toLowerCase().indexOf(b.toLowerCase(),1);
    if(j===1) return `<u>${w.slice(0,2)}</u>${w.slice(2)}`;
    return `<u>${w[0]}</u>${w.slice(1,j)}<u>${w[j]}</u>${w.slice(j+1)}`;
  }
  function openCard(n,list){
    cardList=list||(shown.some(e=>e.n===n)?shown:ELEMENTS); cardN=n;
    if(!$("#modalHost .card.el")){
      const m=openModal(`<button class="arrow l" data-nav="-1" aria-label="上一個">◀</button><div class="card el" role="dialog" aria-modal="true"></div><button class="arrow r" data-nav="1" aria-label="下一個">▶</button>`,
        {onClose:()=>{cardN=null; if(canSpeak) speechSynthesis.cancel();}, onKey});
      m.addEventListener("click",onCardClick);
      m.addEventListener("input",onTry);
      let sx=0, sy=0;
      m.addEventListener("touchstart",e=>{sx=e.touches[0].clientX; sy=e.touches[0].clientY;},{passive:true});
      m.addEventListener("touchend",e=>{
        if(e.target.closest("input")) return;
        const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
        if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.8) go(dx<0?1:-1);
      },{passive:true});
    }
    fillCard(0);
  }
  function onKey(e){
    if(e.target.tagName==="INPUT"){
      if(e.key==="Escape"){e.target.blur(); return true;}
      return e.key!=="Escape";
    }
    if(e.key==="ArrowLeft"){e.preventDefault(); go(-1); return true;}
    if(e.key==="ArrowRight"){e.preventDefault(); go(1); return true;}
    return false;
  }
  function go(d){
    if(cardN==null) return;
    const i=cardList.findIndex(x=>x.n===cardN), len=cardList.length;
    cardN=cardList[((i<0?0:i)+d+len)%len].n; sfx.flip(); fillCard(d);
  }
  function fillCard(dir){
    const e=BY_N[cardN], r=ST.el[e.n]||{w:0,r:0,k:0}, idx=cardList.findIndex(x=>x.n===cardN);
    const card=$("#modalHost .card.el"); tryDone=false;
    card.className="card el"+(dir<0?" slide-l":dir>0?" slide-r":"");
    card.setAttribute("aria-label",e.zh+" "+e.en);
    card.innerHTML=`
      <button class="x" data-close aria-label="關閉">✕</button>
      <div class="chead c-${e.c}">
        <div class="bigtile"><span class="n">${e.n}</span><span class="s">${e.s}</span><span class="emo" aria-hidden="true">${e.e}</span></div>
        <div class="ctitle">
          <h2 class="hn">${e.en}${e.alt?` <small style="font-size:15px;color:var(--muted);font-weight:600">／${e.alt.join("／")}</small>`:""}</h2>
          <div class="zhn">${e.zh}</div>
          <div class="tags"><span class="tag">原子序 ${e.n}</span><span class="tag">符號 ${e.s}</span><span class="tag ${e.c}">${CLS[e.c]} ${e.c}</span><span class="tag">${STATE[e.st]} ${ST_SYM[e.st]}</span></div>
        </div>
      </div>
      <div class="cbody">
        <div class="say">
          ${canSpeak?`<button class="btn ghost sm" data-say="name">🔊 讀英文名</button><button class="btn ghost sm" data-say="spell">🔤 逐個字母讀</button>`:""}
          <button class="btn sm" data-try>✍️ 拼寫挑戰</button>
        </div>
        <div class="sec hidden" id="trySec"><h3>✍️ 拼寫挑戰：英文名已遮住，憑記憶打出來！</h3>
          <div class="try"><input id="tryIn" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="在這裏輸入英文全稱" enterkeyhint="done"><button class="btn ghost sm" data-giveup>看答案</button></div>
          <div class="live" id="tryLive" aria-live="polite"></div></div>
        <div class="sec hn"><h3>📘 中文介紹</h3><p>${e.zi}</p></div>
        <div class="sec en hn"><h3>🌏 English</h3><p>${e.ei}</p></div>
        ${e.lat?`<div class="sec lat hn"><h3>🏛️ 為甚麼符號是 ${e.s}，不是 ${e.en.slice(0,2)}？</h3><div class="w">${latinWord(e)}</div><p>${e.lat.zh}</p><p style="margin-top:6px;font-size:14px;color:var(--muted)">${e.lat.en}</p></div>`:""}
        ${e.sp?`<div class="sec spell hn"><h3>⚠️ 易錯拼寫</h3><div class="spellword">${hl(e.sp.hl)}</div><p>${e.sp.zh}</p></div>`:""}
        ${e.mx?`<div class="sec mix hn"><h3>🔀 易混淆</h3><p>${e.mx}</p></div>`:""}
        <div class="myrec">${r.r+r.w?`我的測驗紀錄：答對 ${r.r} 次 · 答錯 ${r.w} 次 · 掌握 ${starStr(e.n)}`:"還未在測驗區考過這個元素"}</div>
      </div>
      <div class="cnav"><button class="btn ghost sm" data-nav="-1">◀ 上一個</button><span class="pos">${idx+1} / ${cardList.length}</span><button class="btn ghost sm" data-nav="1">下一個 ▶</button></div>`;
    card.scrollTop=0;
    if(!ST.seen.includes(e.n)){ST.seen.push(e.n); save(); checkAch();}
  }
  function onCardClick(ev){
    const e=BY_N[cardN]; if(!e) return;
    const nav=ev.target.closest("[data-nav]"); if(nav){go(+nav.dataset.nav); return;}
    const say=ev.target.closest("[data-say]");
    if(say){ say.dataset.say==="name"?speak(e.en,.85):speak(e.en.toUpperCase().split("").join(", "),.7); return; }
    const card=$("#modalHost .card.el");
    if(ev.target.closest("[data-try]")){
      card.classList.add("hidename"); $("#trySec").classList.remove("hidden");
      const inp=$("#tryIn"); inp.value=""; inp.disabled=false; $("#tryLive").innerHTML=""; tryDone=false; inp.focus();
      return;
    }
    if(ev.target.closest("[data-giveup]")){
      card.classList.remove("hidename"); $("#trySec").classList.add("hidden"); return;
    }
  }
  function onTry(ev){
    if(ev.target.id!=="tryIn"||tryDone) return;
    const e=BY_N[cardN], v=ev.target.value.trim().toLowerCase();
    const opts=[e.en,...(e.alt||[])].map(s=>s.toLowerCase());
    const pre=t=>{let i=0; while(i<v.length&&i<t.length&&v[i]===t[i]) i++; return i;};
    const t=opts.reduce((a,b)=>pre(b)>pre(a)?b:a);
    let html=""; for(let i=0;i<v.length;i++) html+=`<span class="${v[i]===t[i]?"ok":"no"}">${esc(v[i])}</span>`;
    if(v.length<t.length) html+=`<span class="rest">${"_".repeat(t.length-v.length)}</span>`;
    if(opts.includes(v)){
      tryDone=true; ev.target.disabled=true;
      $("#tryLive").innerHTML=`<span class="ok">✔ 完全正確！${esc(ev.target.value.trim())}</span>`;
      $("#modalHost .card.el").classList.remove("hidename");
      sfx.ok(); const b=ev.target.getBoundingClientRect(); confetti(60,b.left+b.width/2,b.top,.7);
      if(!ST.spelled.includes(e.n)){ST.spelled.push(e.n); save(); addXP(5,b.left+b.width/2,b.top); checkAch();}
      return;
    }
    $("#tryLive").innerHTML=html;
  }

  function init(){
    $("#q").addEventListener("input",e=>{F.q=e.target.value; render();});
    $("#fCls").addEventListener("click",e=>{const b=e.target.closest("button"); if(!b) return; F.c=b.dataset.c; $$("#fCls button").forEach(x=>x.classList.toggle("on",x===b)); render();});
    $("#fSt").addEventListener("click",e=>{const b=e.target.closest("button"); if(!b) return; F.s=b.dataset.s; $$("#fSt button").forEach(x=>x.classList.toggle("on",x===b)); render();});
    $("#layout").addEventListener("click",e=>{const b=e.target.closest("button"); if(!b) return; F.layout=b.dataset.l; $$("#layout button").forEach(x=>x.classList.toggle("on",x===b)); render();});
    $("#coverBtn").addEventListener("click",()=>setCover(!F.cover));
    $("#spinBtn").addEventListener("click",spin);
    $("#gridHost").addEventListener("click",ev=>{
      const t=ev.target.closest(".tile"); if(!t) return;
      if(F.cover&&!t.classList.contains("open")){t.classList.add("open"); sfx.flip(); return;}
      openCard(+t.dataset.n);
    });
  }
  return {init,render,openCard,onShow:render};
})();
