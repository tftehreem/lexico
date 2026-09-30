const DEMO = {
  transcript: "Witness: The contract was signed on March 4. We made the payment on April 20, right after the invoice arrived.\nLawyer: Do you have proof of that date?\nWitness: I believe the bank sent a confirmation.",
  brief: {
    Parties: "Plaintiff: John Smith. Defendant: Acme Ltd.",
    Issue: "Dispute over when a contract payment was made.",
    "Key facts": "Contract signed March 4. Payment reported by the witness on April 20. Dispute raised May 20.",
    "Action items": "Obtain the bank statement.\nReview clause 7 on payment terms.\nConfirm the witness's date with the receipt."
  },
  timeline: [
    {date:"Mar 4", event:"Contract signed", source:"Contract.pdf, page 3"},
    {date:"Apr 12", event:"Payment received by bank", source:"PaymentReceipt.pdf"},
    {date:"May 20", event:"Dispute raised by defendant", source:"Client meeting, 04:32"}
  ],
  contradictions: [
    {testimony:"The witness says the payment was made on April 20.", record:"The payment receipt shows April 12.", source:"Witness recording, 00:41 / PaymentReceipt.pdf"}
  ]
};

const $ = id => document.getElementById(id);
let audio = null, current = null, rec = null, chunks = [], timer = null;

function el(tag, cls, txt){const e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e;}
function setMsg(t, err, busy){const m=$('msg'); m.className='msg'+(err?' err':''); m.textContent=''; if(busy){m.appendChild(el('span','spin'));} m.appendChild(document.createTextNode(t||''));}
function tab(name){document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===name));['brief','time','con'].forEach(k=>$('p-'+k).classList.toggle('on',k===name));}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.t));

function setAudio(f){audio=f; $('go').disabled=!f; $('dropTxt').textContent=f?f.name+' ('+(f.size/1048576).toFixed(1)+' MB)':'Drop an audio file here, or click to choose';}
$('file').onchange=e=>{if(e.target.files[0])setAudio(e.target.files[0]);};
const drop=$('drop');
['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('on');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('on');}));
drop.addEventListener('drop',e=>{if(e.dataTransfer.files[0])setAudio(e.dataTransfer.files[0]);});

$('rec').onclick=async()=>{
  if(rec&&rec.state==='recording'){rec.stop();return;}
  try{
    const s=await navigator.mediaDevices.getUserMedia({audio:true});
    chunks=[]; rec=new MediaRecorder(s);
    rec.ondataavailable=e=>chunks.push(e.data);
    rec.onstop=()=>{s.getTracks().forEach(t=>t.stop());clearInterval(timer);$('rec').classList.remove('rec');$('recTxt').textContent='Record audio';
      const type=rec.mimeType||'audio/webm'; setAudio(new File([new Blob(chunks,{type})],'recording.'+(type.includes('mp4')?'m4a':'webm'),{type}));};
    rec.start(); let sec=0; $('rec').classList.add('rec'); $('recTxt').textContent='Stop (0:00)';
    timer=setInterval(()=>{sec++;$('recTxt').textContent='Stop ('+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')+')';},1000);
  }catch(e){setMsg('Microphone access was blocked. Allow it in your browser, or upload a file instead.',true);}
};

function render(d){
  current=d;
  const b=$('p-brief'); b.textContent='';
  const br=d.brief;
  if(br&&typeof br==='object'){Object.keys(br).forEach(k=>{const kv=el('div','kv');kv.appendChild(el('b',null,k));kv.appendChild(el('div',null,br[k]));b.appendChild(kv);});}
  else if(br){b.appendChild(el('div','kv')).appendChild(el('div',null,br));}
  else b.appendChild(el('p','empty','Not available yet.'));
  const t=$('p-time'); t.textContent='';
  if(d.timeline&&d.timeline.length){const w=el('div','tl');d.timeline.forEach(x=>{const e=el('div','ev');e.appendChild(el('b',null,(x.date||'')+'  '+(x.event||'')));if(x.source)e.appendChild(el('small',null,'Source: '+x.source));w.appendChild(e);});t.appendChild(w);}
  else t.appendChild(el('p','empty','Not available yet.'));
  const c=$('p-con'); c.textContent='';
  const n=(d.contradictions||[]).length;
  if(n){d.contradictions.forEach(x=>{const f=el('div','flag');const h=el('b',null,'Possible contradiction');f.appendChild(h);f.appendChild(el('div',null,'Testimony: '+(x.testimony||'')));f.appendChild(el('div',null,'Record: '+(x.record||'')));if(x.source)f.appendChild(el('small',null,'Source: '+x.source));c.appendChild(f);});}
  else c.appendChild(el('p','empty','No contradictions found, or not available yet.'));
  $('cnt').textContent=n; $('cnt').hidden=!n;
  $('trTxt').textContent=d.transcript||''; $('tr').hidden=!d.transcript;
  $('copy').hidden=$('dl').hidden=false; tab('brief');
}
function asText(){const d=current||{};let s='LEXICO CASE BRIEF\n\n';const b=d.brief;if(b&&typeof b==='object')Object.keys(b).forEach(k=>s+=k+':\n'+b[k]+'\n\n');else s+=(b||'')+'\n\n';
  (d.timeline||[]).forEach(x=>s+=x.date+' - '+x.event+'\n');s+='\nAI-assisted tool. Not legal advice.';return s;}
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(asText());setMsg('Brief copied.');}catch(e){setMsg('Copy failed. Use Download instead.',true);}};
$('dl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([asText()],{type:'text/plain'}));a.download='lexico-brief.txt';a.click();};

function normalize(j){
  if(Array.isArray(j))j=j[0]||{};
  let txt=j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||j.summary||null;
  if(txt){txt=txt.replace(/<think>[\s\S]*?<\/think>\s*/gi,'').trim();return {transcript:j.transcript||'',brief:txt,timeline:j.timeline,contradictions:j.contradictions};}
  return j;
}
const steps=['Uploading audio...','Transcribing with AssemblyAI...','Analyzing the case...'];
$('go').onclick=async()=>{
  if(!WEBHOOK_URL||WEBHOOK_URL.startsWith('PASTE')){setMsg('The analysis service is not connected yet. Load the demo case to see a sample result.',true);return;}
  let i=0;setMsg(steps[0],false,true);const iv=setInterval(()=>{i=Math.min(i+1,2);setMsg(steps[i],false,true);},15000);
  $('go').disabled=true;const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),120000);
  try{
    const fd=new FormData();fd.append('data',audio,audio.name);
    const r=await fetch(WEBHOOK_URL,{method:'POST',body:fd,signal:ctl.signal});
    if(!r.ok)throw new Error('Server returned '+r.status);
    render(normalize(await r.json()));setMsg('Analysis complete. Review the results before relying on them.');
  }catch(e){setMsg((e.name==='AbortError'?'The request took longer than 2 minutes.':'Analysis failed ('+e.message+').')+' Try again, or load the demo case.',true);}
  finally{clearInterval(iv);clearTimeout(to);$('go').disabled=!audio;}
};
$('demo').onclick=()=>{render(DEMO);setMsg('Demo case loaded: Smith v. Acme Ltd. (fictional).');};
if(location.hash==='#demo')setTimeout(()=>$('demo').click(),200);