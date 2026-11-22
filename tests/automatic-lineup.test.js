const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup(count=10) {
  const ctx = vm.createContext({console,Date,Intl});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../rules/festival-rules.js'),'utf8'),ctx);
  const run = code => vm.runInContext(code,ctx);
  run(`let plan = normalizePlan(null); plan.event={name:'Test',venue:'',startDate:'2027-03-20',endDate:'2027-03-21',startMinutes:840,endMinutes:1380};
    plan.settings.budget=10000; plan.artists=Array.from({length:${count}},(_,i)=>({id:'a'+i,name:'Artist '+i,genre:i%2?'Rock':'Pop',fee:100+i,duration:60,colour:'#b7e4dc'}));`);
  return run;
}
test('plans catalogue once, balances days/stages, highest fee closes, input stays unchanged',()=>{
 const r=setup();
 assert.equal(r(`const before=JSON.stringify(plan); const output=automaticLineup(plan); const sets=output.bookings.filter(isPerformance);
 JSON.stringify(plan)===before && sets.length===10 && new Set(sets.map(b=>b.artistId)).size===10 && new Set(sets.map(b=>b.date)).size===2 && new Set(sets.map(b=>b.stage)).size===2`),true);
 assert.equal(r(`const head=sets.find(b=>b.artistId==='a9'); head.date==='2027-03-21' && head.start+head.duration===1380 && sets.every(b=>b.date<head.date || b.start+b.duration<=head.start+head.duration)`),true);
 assert.equal(r(`planProblems({...plan,bookings:output.bookings}).length`),0);
});
test('all stage gaps are at least 15 minutes and no same-genre triple occurs',()=>{
 const r=setup(20);
 assert.equal(r(`const o=automaticLineup(plan); const sets=o.bookings.filter(isPerformance);
 eventDays(plan.event).every(date=>planStages(plan).every(stage=>{
 const seq=sets.filter(b=>b.date===date&&b.stage===stage).sort((a,b)=>a.start-b.start);
 return seq.every((b,i)=>!i || b.start>=seq[i-1].start+seq[i-1].duration+15) && seq.every((b,i)=>i<2 || !(plan.artists.find(a=>a.id===b.artistId).genre===plan.artists.find(a=>a.id===seq[i-1].artistId).genre && plan.artists.find(a=>a.id===b.artistId).genre===plan.artists.find(a=>a.id===seq[i-2].artistId).genre));
 }))`),true);
});
test('budget is respected and missing artists are reported',()=>{
 const r=setup();
 assert.equal(r(`plan.settings.budget=250;const o=automaticLineup(plan);o.bookings.filter(isPerformance).reduce((n,b)=>n+b.fee,0)<=250 && o.skipped.length>0`),true);
 assert.match(r(`plan.settings.budget=0;automaticLineup(plan).problem`),/budget/);
});
test('retains existing blocks/bookings and does not duplicate booked artists',()=>{
 const r=setup();
 assert.equal(r(`plan.bookings=[{id:'existing',artistId:'a0',date:plan.event.startDate,stage:'A',start:840,duration:60,fee:100,status:'confirmed',changeover:0,notes:''}, {id:'block',type:'block',title:'Soundcheck',date:plan.event.endDate,stage:'B',start:840,duration:90,notes:''}];
 const o=automaticLineup(plan); const trial={...plan,bookings:plan.bookings.concat(o.bookings)};
 !o.bookings.some(b=>b.artistId==='a0') && !planProblems(trial).length && o.bookings.filter(isPerformance).every(b=>!bookingProblem(b,b.id,trial))`),true);
});
test('same genre never scheduled three times per stage/day, even if not everyone fits',()=>{
 const r=setup(12);
 assert.equal(r(`plan.artists.forEach(a=>a.genre=' ROCK ');const o=automaticLineup(plan); const sets=o.bookings.filter(isPerformance);
 o.skipped.length===4 && sets.length===8`),true);
});
test('overnight festival supports closing headliner and backup restoration',()=>{
 const r=setup(4);
 assert.equal(r(`plan.event.startMinutes=1200;plan.event.endMinutes=1620;const o=automaticLineup(plan);const trial={...plan,bookings:o.bookings};
 o.bookings.some(b=>b.artistId==='a3'&&b.start+b.duration===1620) && parsePlanBackup(JSON.stringify(makePlanBackup(trial))).bookings.length===o.bookings.length`),true);
});
test('reports no closing slot, final plan and invalid changeover',()=>{
 const r=setup(2);
 assert.match(r(`automaticLineup(plan,{changeover:14}).problem`),/15/);
 assert.match(r(`plan.final=true;automaticLineup(plan).problem`),/final/);
 assert.match(r(`plan.final=false;plan.event.endMinutes=850;automaticLineup(plan).problem`),/closing slot/);
});
test('respects different stage hours and existing headliner position',()=>{
 const r=setup(4);
 assert.equal(r(`plan.event.dayHours={'2027-03-21':{start:840,end:1380,stages:{A:{start:840,end:1200}}}};const o=automaticLineup(plan);o.bookings.find(b=>b.artistId==='a3').stage`),'B');
 assert.match(r(`plan.bookings=[{id:'head',artistId:'a3',date:plan.event.startDate,stage:'A',start:840,duration:60,fee:103,status:'confirmed',changeover:0,notes:''}];automaticLineup(plan).problem`),/closing performance/);
});

function screen({allowed=true, failure=false}={}) {
 const nodes=new Map();
 function $(id){if(!nodes.has(id)) nodes.set(id,{value:'15',textContent:'',innerHTML:'',disabled:false,handlers:{},addEventListener(e,h){this.handlers[e]=h;},showModal(){this.open=true;},close(){this.open=false;this.handlers.close?.();},focus(){}});return nodes.get(id);}
 const ctx=vm.createContext({console,Date,Intl,$,document:{querySelector:$},allowed,failure});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../rules/festival-rules.js'),'utf8'),ctx);
 vm.runInContext(`let state=normalizePlan(null);let lineupLoadProblem=''; let saves=0; let messages=[];
 state.event={name:'Test',venue:'',startDate:'2027-03-20',endDate:'2027-03-21',startMinutes:840,endMinutes:1380};
 const canFestival=()=>allowed;const writable=()=>allowed&&!state.final;
 const toast=m=>messages.push(m);const render=()=>{};const euros=n=>String(n);const escapeHtml=s=>String(s);
 function save(next){if(failure)return false;state=next;saves++;return true;}`,ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../automatic-lineup.js'),'utf8'),ctx);
 const run=s=>vm.runInContext(s,ctx);
 return {$,run,preview(){ $('#auto-plan-lineup').onclick();$('#auto-plan-form').onsubmit({preventDefault(){}});}};
}
test('preview/cancel never save, apply saves once and a second apply does nothing',()=>{
 const s=screen();s.preview();assert.equal(s.run('saves'),0);s.$('#auto-plan-cancel').onclick();assert.equal(s.run('state.bookings.length'),0);
 s.preview();s.$('#auto-plan-apply').onclick();assert.equal(s.run('saves'),1);assert.equal(s.run('state.bookings.filter(isPerformance).length'),1);
 s.$('#auto-plan-apply').onclick();assert.equal(s.run('saves'),1);
});
test('changing inputs invalidates preview and changed state requires a new preview',()=>{
 const s=screen();s.preview();s.$('#auto-plan-changeover').handlers.input();assert.equal(s.$('#auto-plan-apply').disabled,true);
 s.preview();s.run('state.settings.budget=12345');s.$('#auto-plan-apply').onclick();assert.equal(s.run('saves'),0);assert.match(s.$('#auto-plan-message').textContent,/changed/);
});
test('viewer/final plans and failed saves leave bookings unchanged',()=>{
 const viewer=screen({allowed:false});assert.equal(viewer.$('#auto-plan-lineup').disabled,true);viewer.preview();viewer.$('#auto-plan-apply').onclick();assert.equal(viewer.run('saves'),0);
 const locked=screen();locked.run('state.final=true');locked.preview();locked.$('#auto-plan-apply').onclick();assert.equal(locked.run('saves'),0);
 const failed=screen({failure:true});failed.preview();failed.$('#auto-plan-apply').onclick();assert.equal(failed.run('state.bookings.length'),0);assert.match(failed.$('#auto-plan-message').textContent,/Could not save/);
});

test('performances cover opening, middle and closing with even gaps per stage/day',()=>{
 const r=setup(12);
 assert.equal(r(`const o=automaticLineup(plan); const sets=o.bookings.filter(isPerformance);
 eventDays(plan.event).every(date=>planStages(plan).every(stage=>{
 const seq=sets.filter(b=>b.date===date&&b.stage===stage).sort((a,b)=>a.start-b.start);
 const gaps=seq.slice(1).map((b,i)=>b.start-seq[i].start-seq[i].duration);
 return seq.length===3 && seq[0].start===840 && seq.at(-1).start+seq.at(-1).duration===1380 && Math.max(...gaps)-Math.min(...gaps)<=1;
 })) && planProblems({...plan,bookings:o.bookings}).length===0`),true);
});
test('re-planning replaces performances only after apply and keeps standalone blocks',()=>{
 const s=screen();s.preview();s.$('#auto-plan-apply').onclick();
 s.run(`state.bookings.push({id:'fixed',type:'block',title:'Break',date:state.event.startDate,stage:'A',start:840,duration:30,notes:''})`);
 s.$('#auto-plan-replace').checked=true;s.preview();assert.equal(s.run('saves'),1);
 s.$('#auto-plan-apply').onclick();assert.equal(s.run('saves'),2);
 assert.equal(s.run(`state.bookings.filter(isPerformance).length===1 && state.bookings.some(b=>b.id==='fixed')`),true);
});

test('realistic suggestions leave arrival/exit time, alternate stages and avoid overlaps when capacity permits',()=>{
 const r=setup(10);
 assert.equal(r(`const output=automaticLineup(plan,{realistic:true});const sets=output.bookings.filter(isPerformance);
 !output.problem && sets.length===10 && output.overlaps===0 && !planProblems({...plan,bookings:output.bookings}).length &&
 eventDays(plan.event).every(date=>{
 const seq=sets.filter(b=>b.date===date).sort((a,b)=>a.start-b.start);
 return seq.length===5 && seq[0].start>=870 && seq.at(-1).start+seq.at(-1).duration<=1365 && seq.every((b,i)=>!i || (b.start>=seq[i-1].start+seq[i-1].duration+15 && b.stage!==seq[i-1].stage));
 }) && sets.find(b=>b.artistId==='a9').start+sets.find(b=>b.artistId==='a9').duration===1365`),true);
});
test('dense realistic suggestions report needed parallel performances and keep every rule valid',()=>{
 const r=setup(20);
 assert.equal(r(`const output=automaticLineup(plan,{realistic:true});!output.problem && output.overlaps>0 && /overlap/.test(output.notice) && !planProblems({...plan,bookings:output.bookings}).length`),true);
});
test('realistic suggestions preserve fixed bookings/blocks and respect overnight and stage hours',()=>{
 const r=setup(6);
 assert.equal(r(`plan.event.startMinutes=1080;plan.event.endMinutes=1620;
 plan.bookings=[{id:'break',type:'block',title:'Break',date:plan.event.startDate,stage:'A',start:1200,duration:30,notes:''}];
 const before=JSON.stringify(plan);const output=automaticLineup(plan,{realistic:true});
 !output.problem && before===JSON.stringify(plan) && !planProblems({...plan,bookings:plan.bookings.concat(output.bookings)}).length && output.bookings.filter(isPerformance).every(b=>b.start>=1110 && b.start+b.duration<=1605)`),true);
});
test('opening suggestion generates it immediately without saving or extra controls',()=>{
 const s=screen();s.$('#auto-plan-lineup').onclick();assert.equal(s.$('#auto-plan-apply').disabled,false);assert.equal(s.run('saves'),0);
 assert.equal(s.$('#auto-plan-apply').textContent,'Use this lineup');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.equal(html.includes('id="auto-plan-replace"'),false);assert.equal(html.includes('>Preview lineup</button>'),false);
});

test('simplified suggestion keeps confirmed performances and their details on apply',()=>{
 const s=screen();
 s.run(`state.bookings=[{id:'confirmed-head',artistId:state.artists[0].id,date:state.event.endDate,stage:'A',start:1305,duration:60,fee:0,status:'confirmed',changeover:0,notes:'Keep this'}]`);
 s.$('#auto-plan-lineup').onclick();
 assert.equal(s.run('state.bookings[0].notes'),'Keep this');
 assert.equal(s.$('#auto-plan-apply').disabled,true);
 assert.equal(s.run('saves'),0);
});

test('organiser can choose the lowest-fee headliner independently of price',()=>{
 const r=setup(10);
 assert.equal(r(`const output=automaticLineup(plan,{realistic:true,headlinerId:'a0'});const sets=output.bookings.filter(isPerformance);const head=sets.find(b=>b.artistId==='a0');
 !output.problem && sets.length===10 && head.date===plan.event.endDate && head.start+head.duration===1365 && sets.every(b=>b.date<head.date||b.start+b.duration<=head.start+head.duration) && output.overlaps===0 && !planProblems({...plan,bookings:output.bookings}).length`),true);
 assert.match(r(`automaticLineup(plan,{realistic:true,headlinerId:'not-in-festival'}).problem`),/Choose a headliner/);
});
test('headliner dropdown recalculates immediately and remembers selection when used',()=>{
 const s=screen();s.run(`state.artists.push({...state.artists[0],id:'second',name:'Second',fee:20})`);
 s.$('#auto-plan-lineup').onclick();s.$('#auto-plan-headliner').value='second';s.$('#auto-plan-headliner').handlers.change();
 assert.equal(s.run('saves'),0);assert.equal(s.$('#auto-plan-apply').disabled,false);
 s.$('#auto-plan-apply').onclick();assert.equal(s.run('state.lineupHeadlinerId'),'second');
 assert.equal(s.run(`const head=state.bookings.find(b=>b.artistId==='second');head.date===state.event.endDate && head.start+head.duration===1365`),true);
});

test('compact suggestion groups every day/stage and exposes complete names and times',()=>{
 const s=screen();s.$('#auto-plan-lineup').onclick();
 const html=s.$('#auto-plan-preview').innerHTML;
 assert.equal((html.match(/class="suggest-day"/g)||[]).length,2);
 assert.equal((html.match(/class="suggest-row"/g)||[]).length,4);
 assert.match(html,/Headliner/);assert.match(html,/21:45–22:45/);
 assert.match(html,/tabindex="0" role="img" aria-label=/);
 assert.equal(html.includes('<table>'),false);
 assert.equal(s.run('saves'),0);
});
test('compact suggestion includes kept confirmed performances and calendar blocks',()=>{
 const s=screen();s.run(`state.bookings=[{id:'fixed',type:'block',title:'Soundcheck',date:state.event.startDate,stage:'A',start:840,duration:30,notes:''}]`);
 s.$('#auto-plan-lineup').onclick();const html=s.$('#auto-plan-preview').innerHTML;
 assert.match(html,/Soundcheck · 14:00–14:30/);assert.match(html,/suggest-block/);
 assert.equal(s.run('state.bookings.length'),1);assert.equal(s.run('saves'),0);
});

test('preview tooltip appears immediately on pointer/focus, stays within view and clears on scroll or refresh',()=>{
 const s=screen();s.$('#auto-plan-lineup').onclick();
 const tooltip=s.$('#auto-plan-tooltip');tooltip.style={};tooltip.getBoundingClientRect=()=>({width:220,height:44});
 const attrs={};const bar={closest:()=>bar,getAttribute:()=> 'Full artist name · 21:00–22:00',setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],getBoundingClientRect:()=>({left:990,top:10,bottom:40})};
 const area=s.$('#auto-plan-preview');area.handlers.pointerover({target:bar});
 assert.equal(tooltip.hidden,false);assert.match(tooltip.textContent,/Full artist name/);assert.equal(tooltip.style.left,'796px');assert.equal(tooltip.style.top,'48px');
 assert.equal(attrs['aria-describedby'],'auto-plan-tooltip');
 area.handlers.scroll();assert.equal(tooltip.hidden,true);assert.equal(attrs['aria-describedby'],undefined);
 area.handlers.focusin({target:bar});assert.equal(tooltip.hidden,false);
 s.$('#auto-plan-changeover').handlers.input();assert.equal(tooltip.hidden,true);
 assert.equal(s.run('saves'),0);
});
