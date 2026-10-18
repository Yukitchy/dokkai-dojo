#!/usr/bin/env python3
"""Pack validator: uv run --with janome python3 check.py [packname]. Exit 1 on any ✗.
Checks each passage against rules/levels.json: length, ruby, above-level grammar, vocab coverage,
question shape (4 choices, evidence quoted from the text, why + per-choice notes), and student names."""
import json,re,sys,os,glob
root=os.path.dirname(os.path.abspath(__file__))
pack=sys.argv[1] if len(sys.argv)>1 else 'animesensei'
R=json.load(open(os.path.join(root,'rules/levels.json')))['levels']
d=os.path.join(root,'packs',pack)
meta=json.load(open(os.path.join(d,'pack.json')))
KAN='一-龯々〆ヶ'
RUBY=re.compile(rf'([{KAN}]+)\{{([^}}]*)\}}')
plain=lambda s:RUBY.sub(r'\1',s)
count=lambda s:len(re.sub(r'\s|｜|\|','',plain(s)))
errs=[];warn=[];ids=set();stats=[]
clen=lambda s:len(re.sub(r'\s','',plain(s)))  # choice length, ruby-stripped (for answer-length-bias check)
len_bias_total=0;len_bias_longest=0

# vocab list (local only, see .gitignore). janome is optional; missing = reported as ✗ so it can't pass silently.
V=None;T=None
vp=os.path.join(root,'rules/npo_vocab.json')
if os.path.exists(vp):
    V={}
    for x in json.load(open(vp)):
        for w in [x['r'],*re.split('[・/]',x['w'])]:
            w=w.strip('～~ ')
            if w: V[w]=min(V.get(w,9),x['lv'])
try:
    from janome.tokenizer import Tokenizer;T=Tokenizer()
except ImportError: pass
# NPO note: numbers, weekdays, food/place/proper names are free; pack.json "allow" lists the series' own names
FREE=re.compile(r'曜日$|^[一二三四五六七八九十百千万]+[月日時分円つ]?$|^[0-9０-９]+')
ALLOW=set(meta.get('allow',[]))
POT=dict(zip('せれべえめけげてね','するぶうむくぐつぬ'))
k2h=lambda s:''.join(chr(ord(c)-0x60) if 'ァ'<=c<='ヶ' else c for c in s)
def vocab_ratio(text,tier):
    ok=n=0;miss=[]
    for t in T.tokenize(plain(text)):
        p=t.part_of_speech.split(',')
        if p[0] not in('名詞','動詞','形容詞','副詞') or p[1] in('固有名詞','数','非自立','代名詞','接尾') : continue
        n+=1;b=t.base_form
        if b not in V and len(b)>2 and b[-1]=='る' and b[-2] in POT: b=b[:-2]+POT[b[-2]]  # potential form -> dictionary form (貸せる->貸す)
        if min(V.get(b,9),V.get(k2h(t.reading),9) if t.reading!='*' else 9)<=tier or re.fullmatch(r'[ァ-ヶー]+',b) or FREE.search(b) or b in ALLOW: ok+=1
        else: miss.append(b)
    return (ok/n if n else 1),miss

# student names: keys of the local roster, never copied into the pack
names=[]
sp=os.path.expanduser('~/lesson-automation/audio-capture/students.json')
if os.path.exists(sp):
    for k in json.load(open(sp)).get('students',{}):
        names+= [w for w in re.split(r'[\s_\-]+',k) if len(w)>=3]

# originality: no 10-char run shared with the reference source (local only, see .gitignore)
refp=os.path.join(root,'rules/ref_source.txt');REF=open(refp).read() if os.path.exists(refp) else None
if REF is None: errs.append('originality check skipped (rules/ref_source.txt missing)')
prof=os.path.join(d,'profile.json');NG=json.load(open(prof)).get('ng_terms',[]) if os.path.exists(prof) else []

for lv in meta['levels']:
    rule=R[lv];sec={s['type']:s for s in rule['sections']}
    fp=os.path.join(d,f'{lv}.json')
    if not os.path.exists(fp): errs.append(f'{lv}.json missing');continue
    raw=open(fp).read();data=json.loads(raw)
    for nm in names:
        if re.search(rf'(?i)\b{re.escape(nm)}\b',raw): errs.append(f'{lv}: student name found')
    nq=0
    for p in data['passages']:
        i=p.get('id','?');E=lambda m:errs.append(f'{i}: {m}')
        if i in ids: E('dup id')
        ids.add(i)
        if not i.startswith(lv+'-'): E(f'id must start with {lv}-')
        s=sec.get(p.get('type'))
        if not s: E(f'type {p.get("type")} not allowed at {lv}');continue
        body=p['text']+('\n'+p['textB'] if p.get('textB') else '')
        if p['type']=='compare' and not p.get('textB'): E('compare needs textB')
        pb=re.sub(r'\s','',plain(body))
        if REF and any(pb[k:k+10] in REF for k in range(len(pb)-9)): E('10-char overlap with reference source')
        for w in NG:
            if re.search(rf'(?<![ァ-ヶー]){re.escape(w)}(?![ァ-ヶー])',plain(json.dumps(p,ensure_ascii=False))): E(f'ng term from existing work: {w}')
        n=count(body);lo,hi=s['chars']
        if not lo<=n<=hi: E(f'{n}字 (目安 {lo}-{hi})')
        for m in re.finditer(r'\{([^}]*)\}',body):
            if not re.fullmatch('[ぁ-ゖー]+',m.group(1)): E(f'ruby not hiragana: {m.group(0)}')
        if re.search(rf'(?<![{KAN}])\{{',body): E('ruby without kanji before it')
        if rule['all_ruby']:
            bare=re.findall(f'[{KAN}]+',RUBY.sub('',body))
            if bare: E(f'kanji without ruby: {"".join(bare)[:20]}')
        for pat,why in rule['grammar_ng']:
            m=re.search(pat,plain(body))
            if m: E(f'above-level grammar 「{m.group(0)}」 {why}')
        if rule.get('vocab'):
            if V is None or T is None: E('vocab check skipped (need rules/npo_vocab.json + janome)')
            else:
                r,miss=vocab_ratio(body,rule['vocab']['tier'])
                if r<rule['vocab']['min_ratio']: E(f'vocab {r:.0%} in list < {rule["vocab"]["min_ratio"]:.0%}; off-list: {" ".join(sorted(set(miss))[:12])}')
                else: warn.append(f'{i}: vocab {r:.0%}; off-list: {" ".join(sorted(set(miss))[:8])}')
        if not p.get('title') or not p.get('lead'): E('needs title and lead')
        Qs=p.get('questions',[])
        if len(Qs)!=s['q']: E(f'{len(Qs)} questions (want {s["q"]})')
        for k,q in enumerate(Qs,1):
            nq+=1;Eq=lambda m:E(f'Q{k} {m}')
            c=q.get('c',[])
            if len(c)!=4 or len(set(c))!=4: Eq('need 4 distinct choices')
            if q.get('a') not in range(4): Eq('a must be 0-3')
            ev=q.get('ev','')
            if not ev or plain(ev) not in plain(body): Eq('ev must be quoted from the text')
            if not q.get('why'): Eq('no why')
            ng=q.get('ng',[])
            if len(ng)!=4 or any(bool(ng[j])==(j==q.get('a')) for j in range(min(4,len(ng)))): Eq('ng: 4 notes, empty only at the answer')
            if len(c)==4 and q.get('a') in range(4):
                lens=[clen(x) for x in c];len_bias_total+=1
                if lens[q['a']]==max(lens) and lens.count(max(lens))==1: len_bias_longest+=1
        for w in p.get('words',[]):
            if len(w)!=3: E(f'words entry needs [word, reading, meaning]: {w}')
        stats.append((lv,p['type'],n,len(Qs)))
    print(f'{lv}: {len(data["passages"])} passages, {nq} questions')
for f in glob.glob(os.path.join(root,'**/*'),recursive=True):
    for nm in names:
        if nm.lower() in os.path.basename(f).lower(): errs.append(f'student name in file name: {os.path.relpath(f,root)}')
if len_bias_total:
    r=len_bias_longest/len_bias_total
    if r>0.5: errs.append(f'answer-length bias: correct choice is uniquely longest in {len_bias_longest}/{len_bias_total} ({r:.0%}) questions (>50%)')
    else: warn.append(f'answer-length bias: {len_bias_longest}/{len_bias_total} ({r:.0%})')
for w in warn: print('·',w)
for e in errs: print('✗',e)
print('names checked:',len(names),'| ng terms:',len(NG),'| ref chars:',len(REF or ''))
sys.exit(1 if errs else 0)
