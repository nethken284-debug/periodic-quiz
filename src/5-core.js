
/* ===== 核心：工具、紀錄、音效、特效、經驗值、成就 ===== */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const BY_N={}; ELEMENTS.forEach(e=>BY_N[e.n]=e);
const CLS={me:"金屬",nm:"非金屬",se:"半金屬"};
const STATE={s:"固體",l:"液體",g:"氣體"}, ST_SYM={s:"s",l:"ℓ",g:"g"};
const LATIN_NS=ELEMENTS.filter(e=>e.lat).map(e=>e.n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const reduceMotion=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 紀錄（localStorage） ---------- */
const KEY="ptq-records-v1";
const fresh=()=>({el:{},xp:0,best:{},ach:{},seen:[],spelled:[],day:{date:"",streak:0,today:0},total:0,maxCombo:0,quizzes:0});
let ST=fresh(), SOUND=true;
function load(){
  try{const raw=localStorage.getItem(KEY); if(raw) ST=Object.assign(fresh(),JSON.parse(raw));}catch(e){}
  try{SOUND=localStorage.getItem("ptq-sound")!=="0";}catch(e){}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(ST));}catch(e){}}
const rec=n=>ST.el[n]||(ST.el[n]={w:0,r:0,k:0});
const stars=n=>ST.el[n]?Math.min(ST.el[n].k,3):0;
const starStr=n=>"★".repeat(stars(n))+"☆".repeat(3-stars(n));
const masteredCount=()=>ELEMENTS.filter(e=>stars(e.n)>=3).length;

/* ---------- 每日連續 ---------- */
const dstr=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const yday=()=>{const d=new Date(); d.setDate(d.getDate()-1); return dstr(d);};
function touchDay(){
  const t=dstr(new Date());
  if(ST.day.date!==t){ST.day.streak=ST.day.date===yday()?ST.day.streak+1:1; ST.day.date=t; ST.day.today=0;}
  ST.day.today++;
}
const currentStreak=()=>(ST.day.date===dstr(new Date())||ST.day.date===yday())?ST.day.streak:0;

/* ---------- 等級 ---------- */
const LEVELS=[[0,"氫原子新手"],[60,"化學學徒"],[150,"元素見習生"],[300,"元素獵人"],[500,"週期表探險家"],[800,"實驗室高手"],[1200,"元素魔法師"],[1700,"化學大師"],[2400,"週期表王者"],[3200,"門捷列夫傳人"]];
function levelOf(xp){let i=0; while(i+1<LEVELS.length&&xp>=LEVELS[i+1][0]) i++; return i;}
function updateHeader(){
  const i=levelOf(ST.xp), lo=LEVELS[i][0], hi=LEVELS[i+1]?LEVELS[i+1][0]:lo;
  $("#lvNum").textContent=i+1; $("#lvName").textContent=LEVELS[i][1];
  $("#xpBar").style.width=(hi>lo?(ST.xp-lo)/(hi-lo)*100:100)+"%";
  $("#xpTxt").textContent=ST.xp+" XP";
  $("#dayStreak").textContent=currentStreak();
  $("#masterTxt").textContent=masteredCount();
  $("#achTxt").textContent=Object.keys(ST.ach).length+"/"+ACHS.length;
  $("#sndBtn").textContent=SOUND?"🔊":"🔇";
}
function addXP(v,x,y){
  if(v<=0) return;
  const before=levelOf(ST.xp); ST.xp+=v; save();
  if(x!=null) floaty("+"+v+" XP",x,y,"var(--accent)");
  const after=levelOf(ST.xp);
  if(after>before){sfx.level(); confetti(150); toast("🆙","升級！Lv."+(after+1)+" "+LEVELS[after][1],"繼續努力，向下一級進發！");}
  updateHeader();
}

/* ---------- 音效（Web Audio，不用外部檔案） ---------- */
let AC=null;
function ac(){
  if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(AC&&AC.state==="suspended") AC.resume();
  return AC;
}
function tone(f,d=.12,type="sine",vol=.18,delay=0){
  if(!SOUND) return; const c=ac(); if(!c) return;
  const t=c.currentTime+delay, o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+d+.05);
}
const sfx={
  ok(){tone(880,.12,"triangle",.2); tone(1320,.18,"triangle",.18,.08);},
  bad(){tone(196,.22,"sawtooth",.08); tone(150,.3,"sawtooth",.07,.1);},
  flip(){tone(620,.06,"square",.05);},
  tick(){tone(1100,.03,"square",.04);},
  pop(){tone(440,.08,"sine",.12); tone(660,.1,"sine",.1,.05);},
  combo(n){[523,659,784,1047].forEach((f,i)=>tone(f*(1+Math.min(n,20)/40),.14,"triangle",.16,i*.07));},
  level(){[523,659,784,1047,1319].forEach((f,i)=>tone(f,.2,"triangle",.18,i*.09));},
  win(){[784,988,1175,1568].forEach((f,i)=>tone(f,.25,"triangle",.17,i*.11));}
};

/* ---------- 彩紙特效 ---------- */
const FX=$("#fx"), fctx=FX.getContext("2d"); let parts=[], fxOn=false;
function sizeFX(){const d=Math.min(window.devicePixelRatio||1,2); FX.width=innerWidth*d; FX.height=innerHeight*d; fctx.setTransform(d,0,0,d,0,0);}
function confetti(n=100,x=innerWidth/2,y=innerHeight*.35,power=1){
  if(reduceMotion) return;
  const cols=["#6d4aff","#f59e0b","#10b981","#ff5ca8","#38bdf8","#facc15"];
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, v=(3+Math.random()*8)*power;
    parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-6*power,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,w:6+Math.random()*6,h:4+Math.random()*5,c:cols[i%cols.length],l:90+Math.random()*60});
  }
  if(!fxOn){fxOn=true; requestAnimationFrame(fxLoop);}
}
function fxLoop(){
  fctx.clearRect(0,0,innerWidth,innerHeight);
  parts=parts.filter(p=>p.l>0&&p.y<innerHeight+40);
  for(const p of parts){
    p.vy+=.25; p.vx*=.985; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; p.l--;
    fctx.save(); fctx.translate(p.x,p.y); fctx.rotate(p.r); fctx.globalAlpha=Math.min(1,p.l/30);
    fctx.fillStyle=p.c; fctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); fctx.restore();
  }
  if(parts.length) requestAnimationFrame(fxLoop); else {fxOn=false; fctx.clearRect(0,0,innerWidth,innerHeight);}
}
function floaty(text,x,y,color){
  const d=document.createElement("div"); d.className="floaty"; d.textContent=text;
  d.style.left=x+"px"; d.style.top=y+"px"; if(color) d.style.color=color;
  document.body.appendChild(d); setTimeout(()=>d.remove(),1150);
}
let toastQ=[], toastBusy=false;
function toast(i,t,s){toastQ.push([i,t,s]); if(!toastBusy) nextToast();}
function nextToast(){
  const it=toastQ.shift(); if(!it){toastBusy=false; return;} toastBusy=true;
  const d=document.createElement("div"); d.className="toast"; d.setAttribute("role","status");
  d.innerHTML=`<span class="i">${it[0]}</span><span><b>${esc(it[1])}</b><small>${esc(it[2]||"")}</small></span>`;
  document.body.appendChild(d);
  setTimeout(()=>{d.style.transition="opacity .3s,transform .3s"; d.style.opacity="0"; d.style.transform="translate(-50%,-30px)"; setTimeout(()=>{d.remove(); nextToast();},300);},2600);
}

/* ---------- 成就 ---------- */
const ACHS=[
  {id:"first",i:"🎉",t:"初試啼聲",d:"完成第一次測驗"},
  {id:"c5",i:"🔥",t:"五連擊",d:"測驗中連續答對 5 題"},
  {id:"c10",i:"⚡",t:"十連擊",d:"連續答對 10 題"},
  {id:"c20",i:"🌋",t:"二十連擊",d:"連續答對 20 題"},
  {id:"perfect",i:"💯",t:"完美默寫",d:"順序默寫取得滿分"},
  {id:"fast",i:"⏱️",t:"閃電默寫",d:"3 分鐘內完成順序默寫，而且得分有 90% 或以上"},
  {id:"latin",i:"🏛️",t:"拉丁文專家",d:"9 個符號來自拉丁文的元素，全部答對過"},
  {id:"speller",i:"🔤",t:"拼字達人",d:"在元素卡的「拼寫挑戰」拼對 10 個元素"},
  {id:"curious",i:"🔍",t:"好奇寶寶",d:"在溫習區打開全部 35 張元素卡"},
  {id:"m10",i:"⭐",t:"小有所成",d:"掌握 10 個元素（★★★）"},
  {id:"mall",i:"👑",t:"元素大師",d:"掌握全部 35 個元素"},
  {id:"d3",i:"📅",t:"三日不斷",d:"連續 3 日都有做測驗"},
  {id:"q100",i:"💪",t:"百題勇士",d:"累積作答 100 題"}
];
function unlock(id){
  if(ST.ach[id]) return; ST.ach[id]=Date.now(); save();
  const a=ACHS.find(x=>x.id===id); sfx.win(); confetti(90); toast(a.i,"解鎖成就："+a.t,a.d); updateHeader();
}
function checkAch(){
  if(ST.maxCombo>=5) unlock("c5"); if(ST.maxCombo>=10) unlock("c10"); if(ST.maxCombo>=20) unlock("c20");
  if(LATIN_NS.every(n=>ST.el[n]&&ST.el[n].r>0)) unlock("latin");
  if(ST.spelled.length>=10) unlock("speller");
  if(ST.seen.length>=ELEMENTS.length) unlock("curious");
  const m=masteredCount(); if(m>=10) unlock("m10"); if(m>=ELEMENTS.length) unlock("mall");
  if(currentStreak()>=3) unlock("d3"); if(ST.total>=100) unlock("q100");
}
function showAch(){
  openModal(`<div class="card" role="dialog" aria-modal="true" aria-label="成就">
    <button class="x" data-close aria-label="關閉">✕</button>
    <div class="cbody" style="padding-top:22px"><h2 style="margin:0 0 4px">🏅 成就</h2>
    <p class="hint" style="margin:0 0 14px">已解鎖 ${Object.keys(ST.ach).length} / ${ACHS.length}　·　累積作答 ${ST.total} 題　·　最高連擊 ${ST.maxCombo}</p>
    <div class="badges">${ACHS.map(a=>`<div class="badge ${ST.ach[a.id]?"":"lock"}"><div class="i">${a.i}</div><div class="t">${a.t}</div><div class="d">${a.d}</div></div>`).join("")}</div></div></div>`);
}

/* ---------- 彈出視窗 ---------- */
let modalClose=null, modalKey=null;
function openModal(html,opts={}){
  closeModal(true);
  const host=$("#modalHost"); host.innerHTML=`<div class="modal ${opts.cls||""}">${html}</div>`;
  const m=host.firstElementChild;
  m.addEventListener("click",e=>{if(e.target===m||e.target.closest("[data-close]")) closeModal();});
  modalClose=opts.onClose||null; modalKey=opts.onKey||null;
  document.body.style.overflow="hidden";
  return m;
}
function closeModal(silent){
  const host=$("#modalHost"); if(!host.firstElementChild) return;
  host.innerHTML=""; document.body.style.overflow="";
  const f=modalClose; modalClose=null; modalKey=null; if(f&&!silent) f();
}
function ask(title,msg,ok="確定",danger=false){
  return new Promise(res=>{
    const m=openModal(`<div class="card" role="alertdialog" aria-modal="true"><h3>${title}</h3><p>${msg}</p>
      <div class="row"><button class="btn ghost" data-a="0">取消</button><button class="btn ${danger?"danger":""}" data-a="1">${ok}</button></div></div>`,
      {cls:"confirm",onClose:()=>res(false)});
    m.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{closeModal(true); res(b.dataset.a==="1");});
    setTimeout(()=>{const b=m.querySelector('[data-a="1"]'); if(b) b.focus();},50);
  });
}
document.addEventListener("keydown",e=>{
  if(!$("#modalHost").firstElementChild) return;
  if(modalKey&&modalKey(e)) return;
  if(e.key==="Escape"){e.preventDefault(); closeModal();}
});

/* ---------- 讀音（瀏覽器內置語音） ---------- */
const canSpeak="speechSynthesis" in window;
let voiceEN=null;
function pickVoice(){
  if(!canSpeak) return; const v=speechSynthesis.getVoices();
  voiceEN=v.find(x=>/en[-_]GB/i.test(x.lang))||v.find(x=>/^en/i.test(x.lang))||null;
}
if(canSpeak){pickVoice(); if(speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged",pickVoice);}
function speak(text,rate=.9){
  if(!canSpeak) return; speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang="en-GB"; if(voiceEN) u.voice=voiceEN; u.rate=rate;
  speechSynthesis.speak(u);
}

/* ---------- 背景漂浮符號 ---------- */
(function(){
  const b=$("#bgAtoms"), syms=["H","He","Na","Fe","Au","O","C","Cu","Ag","Hg","K","Ca","Cl","Zn","Pb","Sn"];
  for(let i=0;i<14;i++){
    const s=document.createElement("span"); s.textContent=syms[i%syms.length];
    s.style.left=(Math.random()*94)+"%"; s.style.fontSize=(22+Math.random()*40)+"px";
    s.style.animationDuration=(18+Math.random()*22)+"s"; s.style.animationDelay=(-Math.random()*30)+"s";
    b.appendChild(s);
  }
})();
