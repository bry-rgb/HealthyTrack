import {calculateBMI,filterPlans,plans} from './domain.js';
const root=document.getElementById('planejador-treino');
if(!root) throw new Error('Planejador de treino não encontrado.');
const $=id=>root.querySelector('#'+id);
let selected=plans[0], session=0, checked=new Set(), latest=null, history=[];
const number=value=>Number(value.trim().replace(',','.'));
const fmt=(v,d=1)=>v.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
function renderPlans(){
 const list=filterPlans(plans,$('goal').value,$('level').value);
 if(!list.some(p=>p.id===selected?.id)){selected=list[0]||null;session=0;checked.clear();}
 $('plan-count').textContent=`${list.length} ${list.length===1?'opção':'opções'}`;
 $('empty-plans').hidden=list.length>0;
 $('plans').replaceChildren();
 for(const p of list){
  const item=document.createElement('article');item.className='plan'+(p.id===selected?.id?' selected':'');
  item.innerHTML=`<svg class="plan-icon" viewBox="0 0 40 30" aria-hidden="true"><path d="M8 15h24M5 5v20M11 9v12M29 9v12M35 5v20" fill="none" stroke="currentColor" stroke-width="4"/></svg><div class="plan-main"><h3>${p.name}</h3><p class="level">${p.level==='todos'?'Todos os níveis':p.level==='iniciante'?'Iniciante':'Intermediário'} · ${p.days}</p><p>${p.description}</p></div><div class="plan-action"><div class="duration">${p.duration}</div><button type="button" aria-label="Ver treino ${p.name}">Ver treino →</button></div>`;
  item.querySelector('button').addEventListener('click',()=>{selected=p;session=0;checked.clear();renderPlans();});$('plans').append(item);
 }
 root.querySelectorAll('[data-goal]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.goal===$('goal').value)));
 renderWorkout();
}
function renderWorkout(){
 root.querySelector('.workout').hidden=!selected;
 if(!selected)return;
 const current=selected.sessions[session];$('workout-title').textContent=current.name;$('schedule').textContent=selected.schedule.join(' / ');$('sessions').replaceChildren();
 selected.sessions.forEach((s,i)=>{const b=document.createElement('button');b.textContent=`Treino ${String.fromCharCode(65+i)}`;b.setAttribute('aria-pressed',String(session===i));b.onclick=()=>{session=i;checked.clear();renderWorkout();};$('sessions').append(b);});
 $('exercises').replaceChildren();current.exercises.forEach((row,i)=>{const tr=document.createElement('tr');const td=document.createElement('td');const cb=document.createElement('input');cb.type='checkbox';cb.setAttribute('aria-label',`Concluir ${row[0]}`);cb.checked=checked.has(i);tr.classList.toggle('done',cb.checked);cb.onchange=()=>{cb.checked?checked.add(i):checked.delete(i);tr.classList.toggle('done',cb.checked);updateCompleted();};td.append(cb);tr.append(td);row.forEach(v=>{const cell=document.createElement('td');cell.textContent=v;tr.append(cell);});$('exercises').append(tr);});updateCompleted();
}
function updateCompleted(){const total=selected?.sessions[session]?.exercises.length||0;$('completed').textContent=`${checked.size} de ${total} exercícios concluídos`+(checked.size===total&&total?' · Sessão concluída!':'');}
$('goal').onchange=renderPlans;$('level').onchange=renderPlans;root.querySelectorAll('[data-goal]').forEach(b=>b.onclick=()=>{$('goal').value=b.dataset.goal;renderPlans();});$('reset-workout').onclick=()=>{checked.clear();renderWorkout();};
$('bmi-form').onsubmit=e=>{e.preventDefault();try{const weight=number($('weight').value),height=number($('height').value);const bmi=calculateBMI(weight,height);latest={weight,height,...bmi};$('error').textContent='';$('result').hidden=false;$('bmi-value').textContent=fmt(bmi.value);$('category').textContent=bmi.category;$('record').disabled=false;window.dispatchEvent(new CustomEvent('healthytrack:bmi-calculated',{detail:{...latest}}));}catch(err){latest=null;$('result').hidden=true;$('record').disabled=true;$('error').textContent=err.message;}};
['weight','height'].forEach(id=>$(id).addEventListener('input',()=>{latest=null;$('record').disabled=true;$('result').hidden=true;$('error').textContent='';}));
$('record').onclick=()=>{if(!latest)return;const entry={...latest,recordedAt:new Date().toISOString()};history.push(entry);renderHistory();window.dispatchEvent(new CustomEvent('healthytrack:measurement-recorded',{detail:{...entry}}));};
$('clear-history').onclick=()=>{history=[];renderHistory();};
function renderHistory(){
 $('history-empty').hidden=history.length>0;$('clear-history').hidden=history.length===0;$('weight-chart').toggleAttribute('hidden',history.length===0);$('history-list').replaceChildren();
 for(const entry of history.slice(-5).reverse()){const li=document.createElement('li');li.textContent=`${new Date(entry.recordedAt).toLocaleDateString('pt-BR')} · ${fmt(entry.weight)} kg · IMC ${fmt(entry.value)}`;$('history-list').append(li);}
 const values=history.slice(-8),weights=values.map(v=>v.weight),min=Math.min(...weights)-1,max=Math.max(...weights)+1;
 const pts=values.map((v,i)=>[values.length===1?200:25+i*350/(values.length-1),115-(v.weight-min)/(max-min)*90]);
 const ns='http://www.w3.org/2000/svg',svg=$('weight-chart');svg.replaceChildren();
 const el=(name,attrs)=>{const node=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,String(v)));svg.append(node);return node;};
 [25,70,115].forEach(y=>el('line',{x1:15,x2:385,y1:y,y2:y}));el('polyline',{points:pts.map(p=>p.join(',')).join(' ')});pts.forEach(([x,y],i)=>{el('circle',{cx:x,cy:y,r:4});el('text',{x,y:140,'text-anchor':'middle'}).textContent=String(i+1);});
}
renderPlans();
