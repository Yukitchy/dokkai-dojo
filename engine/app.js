// Dokkai Dojo engine: loads rules/levels.json + packs/<name>/pack.json + <level>.json. No content lives here.
const $=s=>document.querySelector(s);
const Q=new URLSearchParams(location.search);
const packName=(Q.get('pack')||'animesensei').replace(/[^a-z0-9_-]/gi,'');
const KAN='一-龯々〆ヶ',RUBY=new RegExp(`([${KAN}]+)\\{([^}]*)\\}`,'g');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const plain=s=>s.replace(RUBY,'$1');
const ruby=s=>esc(s).replace(RUBY,'<ruby>$1<rt>$2</rt></ruby>');
let RULES,META,LV,DATA,S,KEY,timer;

// ruby-aware highlight: marks the units whose plain-text span overlaps [a,b)
function marked(s,a,b){
  let out='',i=0,re=new RegExp(RUBY.source,'y'),k=0;
  while(k<s.length){re.lastIndex=k;const m=re.exec(s);
    const [html,len,step]=m?[`<ruby>${esc(m[1])}<rt>${esc(m[2])}</rt></ruby>`,m[1].length,m[0].length]:[esc(s[k]),1,1];
    out+=(i<b&&i+len>a)?`<mark>${html}</mark>`:html;i+=len;k+=step;}
  return out;
}
const withEv=(s,ev)=>{const i=ev?plain(s).indexOf(plain(ev)):-1;return i<0?ruby(s):marked(s,i,i+plain(ev).length);};

function load(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return{};}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

async function init(){
  RULES=(await (await fetch('rules/levels.json')).json()).levels;
  META=await (await fetch(`packs/${packName}/pack.json`)).json();
  LV=META.levels.includes(Q.get('lv'))?Q.get('lv'):META.levels[0];
  DATA=await (await fetch(`packs/${packName}/${LV}.json`)).json();
  KEY='dokkai-dojo:'+packName;S=load();
  document.title=`${META.title} ${RULES[LV].jlpt}`;
  $('#brand').textContent=META.title;$('#title').textContent=`${META.title} — ${RULES[LV].jlpt}`;
  $('#eyebrow').textContent=`JLPT 読解 · ${META.name}`;
  $('#tabs').innerHTML=META.levels.map(l=>`<option value="${l}"${l===LV?' selected':''}>${RULES[l].jlpt}</option>`).join('');
  $('#tabs').onchange=e=>location.search=`?pack=${packName}&lv=${e.target.value}`;
  $('#foot').innerHTML=`${esc(RULES[LV].reader)}<br>レベル設計の参考: NPO多言語多読「レベル分けの目安」「語彙表」「文型表」 <a href="https://tadoku.org/japanese/">tadoku.org</a>`;
  $('#ruby').onchange=()=>document.body.classList.toggle('noruby',!$('#ruby').checked);
  $('#exam').onchange=()=>{if($('#exam').checked){$('#ruby').checked=false;$('#ruby').onchange();}if(!$('#view').hidden)open(cur.id);};
  $('#print').onclick=printLevel;
  $('#ankiLv').onclick=()=>anki(DATA.passages.flatMap(p=>p.words||[]),`dokkai-${LV}.txt`);
  if(Q.get('print'))buildPrint(); // ?print=1 lets headless Chrome render the handout
  const id=Q.get('p');id&&DATA.passages.some(p=>p.id===id)?open(id):list();
}
// Anki import file (File > Import): front=word, back=reading + meaning, deck per level
function anki(ws,name){const seen=new Set(),rows=ws.filter(w=>!seen.has(w[0])&&seen.add(w[0])).map(w=>`${w[0]}\t${esc(w[1])}<br>${esc(w[2])}`);
  const t=`#separator:tab\n#html:true\n#deck:Dokkai Dojo::${RULES[LV].jlpt}\n#tags:dokkai-dojo ${LV}\n${rows.join('\n')}\n`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain'}));a.download=name;a.click();}
const sec=p=>RULES[LV].sections.find(s=>s.type===p.type)||{name:p.type,min:5};

function list(){
  clearInterval(timer);$('#view').hidden=true;$('.hero').hidden=false;$('#list').hidden=false;
  let last='';
  $('#list').innerHTML=DATA.passages.map(p=>{const s=sec(p),r=S[p.id],n=p.questions.length;
    const ok=r?.done?p.questions.filter((q,i)=>r.picked[i]===q.a).length:null;
    const h=s.name!==last?`<h2 class="sec">${esc(s.name)}</h2>`:'';last=s.name;
    return `${h}<button class="card" data-id="${p.id}"><div class="meta"><span class="mono">${p.id}</span><span>${ruby(p.genre||'')}</span><span>目安 ${s.min}分</span>${ok!==null?`<span class="score${ok===n?' full':''}">${ok}/${n}</span>`:''}</div><h3>${ruby(p.title)}</h3><p class="lead">${ruby(p.lead||'')}</p></button>`;}).join('');
  document.querySelectorAll('.card').forEach(b=>b.onclick=()=>open(b.dataset.id));
}

let cur,picked,t0;
function open(id){
  cur=DATA.passages.find(p=>p.id===id);picked=S[id]?.done?[...S[id].picked]:[];
  $('#list').hidden=true;$('.hero').hidden=true;$('#view').hidden=false;history.replaceState(0,'',`?pack=${packName}&lv=${LV}&p=${id}`);
  t0=Date.now();clearInterval(timer);render();
  timer=setInterval(()=>{const t=(Date.now()-t0)/1000,el=$('#timer');if(!el)return;el.textContent=`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')} / ${sec(cur).min}:00`;el.classList.toggle('over',t>sec(cur).min*60);},500);
  scrollTo(0,0);
}
function render(){
  const p=cur,s=sec(p),exam=$('#exam').checked,done=!!S[p.id]?.done,showAll=done||!exam;
  const evs=p.questions.map((q,i)=>(showAll&&picked[i]!=null)?q.ev:null).filter(Boolean);
  const body=(t,label)=>{const ev=evs.find(e=>plain(t).includes(plain(e)));return `${label?`<span class="ab">${label}</span>\n`:''}${withEv(t,ev)}`;};
  $('#view').innerHTML=`<button class="btn ghost sm back" id="back">← 一覧</button>
  <div class="bar"><span class="mono">${p.id}</span><strong>${esc(s.name)}</strong><span class="note">${ruby(p.genre||'')}</span><span class="timer mono" id="timer"></span></div>
  <h2 style="margin-top:12px">${ruby(p.title)}</h2>
  <div class="passage${p.type==='info'?' info':''}">${body(p.text,p.textB?'A':'')}</div>
  ${p.textB?`<div class="passage">${body(p.textB,'B')}</div>`:''}
  ${p.questions.map((q,i)=>qHtml(q,i,exam&&!done)).join('')}
  ${exam&&!done?`<button class="btn red" id="grade" ${picked.filter(x=>x!=null).length<p.questions.length?'disabled':''}>答え合わせ</button>`:''}
  ${(done||!exam)&&p.words?.length?`<p class="words">覚えたい語: ${p.words.map(w=>`${esc(w[0])}（${esc(w[1])}）${esc(w[2])}`).join(' ／ ')} <button class="btn ghost sm" id="anki">Ankiに入れる</button></p>`:''}
  <p>${done?'<button class="btn red" id="copy">結果をコピーして先生に送る</button> ':''}<button class="btn ghost" id="retry">もう一度</button></p>`;
  $('#back').onclick=list;
  if($('#anki'))$('#anki').onclick=()=>anki(p.words,`dokkai-${p.id}.txt`);
  if($('#copy'))$('#copy').onclick=async()=>{const r=S[p.id],ok=p.questions.filter((q,i)=>r.picked[i]===q.a).length,t=r.sec??Math.round((Date.now()-t0)/1000);
    const txt=`${META.title} ${RULES[LV].jlpt} ${p.id}「${plain(p.title)}」 ${ok}/${p.questions.length}問正解 ${Math.floor(t/60)}分${t%60}秒（目安${s.min}分）${exam?' 本番モード':''}`;
    try{await navigator.clipboard.writeText(txt);$('#copy').textContent='コピーしました';}catch(e){prompt('この文をコピーして送ってください',txt);}};
  $('#retry').onclick=()=>{delete S[p.id];save();open(p.id);};
  document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>{const i=+b.dataset.q;if(picked[i]!=null&&!(exam&&!done))return;picked[i]=+b.dataset.c;
    if(!exam&&picked.filter(x=>x!=null).length===p.questions.length){S[p.id]={done:1,picked,sec:Math.round((Date.now()-t0)/1000)};save();}render();});
  if($('#grade'))$('#grade').onclick=()=>{S[p.id]={done:1,picked,sec:Math.round((Date.now()-t0)/1000)};save();render();};
}
function qHtml(q,i,hide){
  const pk=picked[i],shown=pk!=null&&!hide;
  return `<div class="q"><h4>問${i+1}　${ruby(q.q)}</h4>${q.c.map((c,j)=>`<button class="choice${shown&&j===q.a?' right':''}${shown&&j===pk&&j!==q.a?' wrong':''}" data-q="${i}" data-c="${j}"${pk===j?' data-picked':''}${shown?' disabled':''}><b>${j+1}</b><span>${ruby(c)}</span></button>`).join('')}
  ${shown?`<div class="exp"><span class="res ${pk===q.a?'ok':'ng'}">${pk===q.a?'正解':'不正解'}（正解は ${q.a+1}）</span><br>根拠: 本文の<mark>黄色い部分</mark><br>${esc(q.why)}<ol>${q.ng.map((n,j)=>`<li class="${j===q.a?'ans':''}">${j===q.a?'正解':esc(n)}</li>`).join('')}</ol></div>`:''}</div>`;
}
function printLevel(){buildPrint();print();}
function buildPrint(){
  $('#printout').innerHTML=`<h1>${esc(META.title)} ${RULES[LV].jlpt} 読解</h1>`+DATA.passages.map(p=>`<div class="pp"><h3>${p.id}　${esc(sec(p).name)}　${ruby(p.title)}（目安${sec(p).min}分）</h3>
    <div class="passage">${p.textB?'<span class="ab">A</span>\n':''}${ruby(p.text)}</div>${p.textB?`<div class="passage"><span class="ab">B</span>\n${ruby(p.textB)}</div>`:''}
    ${p.questions.map((q,i)=>`<div class="q"><h4>問${i+1}　${ruby(q.q)}</h4>${q.c.map((c,j)=>`<div>${j+1}　${ruby(c)}</div>`).join('')}</div>`).join('')}</div>`).join('')+
    `<div class="key"><h2>解答と解説</h2>${DATA.passages.map(p=>p.questions.map((q,i)=>`<p><b>${p.id} 問${i+1}　正解 ${q.a+1}</b>　${esc(q.why)}<br>根拠: 「${esc(plain(q.ev))}」<br>${q.ng.map((n,j)=>j===q.a?'':`${j+1}: ${esc(n)}`).filter(Boolean).join('　')}</p>`).join('')).join('')}</div>`;
}
init();
