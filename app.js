// Festival Architect — the screen: drawing the page and reacting to clicks.
// The rules live in rules/festival-rules.js (loaded first in index.html); this file only calls them.
let state = loadState();
let selectedArtistId = null, editingId = null;
const $ = (selector) => document.querySelector(selector);
const euros = (n) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
function loadState() { return parseState(localStorage.getItem(STORAGE_KEY)); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function minutesFromInput(value) { const [h, m] = value.split(':').map(Number); return h * 60 + m; }
function render() {
  const committed = total(state);
  $('#artist-count').innerHTML = `${state.bookings.length} <small>/ 8</small>`;
  $('#committed').textContent = euros(committed); $('#remaining').textContent = euros(BUDGET - committed);
  $('#plan-status').textContent = state.final ? 'FINAL' : 'DRAFT'; $('#plan-status').classList.toggle('final', state.final);
  $('#finalise-btn').textContent = state.final ? 'Reopen as draft' : 'Finalise plan';
  $('#artist-list').innerHTML = ARTISTS.map((a) => { const booked = state.bookings.some((b) => b.artistId === a.id); return `<article class="artist-card ${booked ? 'booked' : ''}" data-artist="${a.id}"><div class="avatar" style="background:${a.colour}">${a.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div><div class="artist-name">${a.name}</div><div class="artist-meta">${a.genre} · ${a.duration} min</div></div><div class="artist-price">${euros(a.fee)}${booked ? '<div class="booked-label">BOOKED</div>' : ''}</div></article>`; }).join('');
  $('#time-axis').innerHTML = Array.from({length:10}, (_, i) => `<span>${String(14+i).padStart(2,'0')}:00</span>`).join('');
  ['A', 'B'].forEach(stage => { const bookings = state.bookings.filter(b => b.stage === stage).sort((a,b) => a.start-b.start); $(`#track-stage-${stage.toLowerCase()}`).innerHTML = bookings.map(b => { const a=artist(b.artistId), left=((b.start-START)/(END-START))*100, width=(a.duration/(END-START))*100; return `<button class="performance ${stage.toLowerCase()}" data-booking="${b.id}" style="left:${left}%;width:${width}%" title="Edit ${a.name}"><strong>${a.name}</strong><span>${timeText(b.start)}—${timeText(b.start+a.duration)}</span></button>` }).join(''); });
  $('#schedule-empty').classList.toggle('hidden', state.bookings.length > 0);
  document.querySelectorAll('.artist-card:not(.booked)').forEach(el => el.addEventListener('click', () => openBooking(el.dataset.artist)));
  document.querySelectorAll('.performance').forEach(el => el.addEventListener('click', () => openBooking(null, el.dataset.booking)));
}
function populateTimes() { $('#time-input').innerHTML = Array.from({length: 37}, (_, i) => { const t=START+i*15; return `<option value="${timeText(t)}">${timeText(t)}</option>`; }).join(''); }
function openBooking(artistId, bookingId = null) {
  if (state.final) return toast('Reopen the final plan before editing.');
  editingId = bookingId; const booking = bookingId ? state.bookings.find(b => b.id === bookingId) : null; selectedArtistId = booking ? booking.artistId : artistId; const a = artist(selectedArtistId);
  $('#dialog-step').textContent = booking ? 'EDIT PERFORMANCE' : 'CREATE PERFORMANCE'; $('#dialog-title').textContent = booking ? 'Move performance' : 'Book artist';
  $('#artist-preview').innerHTML = `<div class="avatar" style="background:${a.colour}">${a.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div><strong>${a.name}</strong><div class="artist-meta">${a.genre} · ${euros(a.fee)}</div></div>`;
  $('#duration-preview').textContent = `${a.duration} minutes`; $('#stage-input').value = booking?.stage || 'A'; $('#time-input').value = timeText(booking?.start || START); $('#save-btn').textContent = booking ? 'Save changes' : 'Add to lineup'; $('#remove-btn').classList.toggle('hidden', !booking); $('#form-message').textContent = '';
  updateEndPreview(); $('#booking-dialog').showModal();
}
function updateEndPreview() { const end=minutesFromInput($('#time-input').value)+artist(selectedArtistId).duration; $('#end-preview').textContent=timeText(end); }
function closeBooking() { $('#booking-dialog').close(); selectedArtistId = null; editingId = null; }
function toast(message) { const t=$('#toast'); t.textContent=message;t.classList.add('visible');setTimeout(()=>t.classList.remove('visible'),2600); }
$('#time-input').addEventListener('change', updateEndPreview);
$('#close-dialog').addEventListener('click', closeBooking); $('#cancel-btn').addEventListener('click', closeBooking);
$('#booking-form').addEventListener('submit', (e) => { e.preventDefault(); const booking = { id: editingId || crypto.randomUUID(), artistId: selectedArtistId, stage: $('#stage-input').value, start: minutesFromInput($('#time-input').value) }; const problem=validation(state,booking,editingId); if(problem) { $('#form-message').textContent=problem; return; } if(editingId) state.bookings=state.bookings.map(b=>b.id===editingId?booking:b); else state.bookings.push(booking); save(); closeBooking();render();toast(editingId?'Performance updated.':'Artist added to the lineup.'); });
$('#remove-btn').addEventListener('click', () => { if(!editingId)return; state.bookings=state.bookings.filter(b=>b.id!==editingId);save();closeBooking();render();toast('Booking removed and budget released.'); });
$('#finalise-btn').addEventListener('click', () => { if(state.final){state.final=false;save();render();toast('Plan reopened as a draft.');return;} const problems=finaliseProblems(state); if(problems.length){toast(problems.join(' '));return;} $('#finalise-dialog').showModal(); });
$('#confirm-finalise').addEventListener('click', () => { const problems=finaliseProblems(state); if(problems.length){toast(problems.join(' '));return;} state.final=true;save();render();toast('Lineup finalised. Your plan is now read-only.'); });
document.querySelectorAll('.sidebar-item').forEach((button) => button.addEventListener('click', () => {
  if (!['Lineup planner', 'Final checklist'].includes(button.dataset.section)) {
    toast(`${button.dataset.section} will be added in a later feature branch.`);
    return;
const $ = s => document.querySelector(s);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euros = n => new Intl.NumberFormat('en-IE', {style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
function loadState() {
  let saved; try { saved = JSON.parse(localStorage.getItem('festival-architect-v2')); } catch {}
  const result = {bookings:[], final:false, artists:ARTISTS.map(a=>({...a})), settings:{stages:2,budget:10000},event:{...DEFAULT_EVENT},...saved};
  result.settings = {...{stages:2,budget:10000},...result.settings};
  delete result.settings.required;
  result.event = {...DEFAULT_EVENT,...result.event};
  // Reset remaining daily restrictions from the retired availability editor.
  if (!result.dailyHoursResetV1) {
    result.event.startMinutes = DEFAULT_EVENT.startMinutes;
    result.event.endMinutes = DEFAULT_EVENT.endMinutes;
    delete result.event.dayHours;
    result.dailyHoursResetV1 = true;
    localStorage.setItem('festival-architect-v2', JSON.stringify(result));
  }
  // Retire saved stage overrides after removing the stage-hours editor.
  if (!result.stageHoursResetV1) {
    for (const hours of Object.values(result.event.dayHours || {})) {
      delete hours.stages;
    }
    result.stageHoursResetV1 = true;
    localStorage.setItem('festival-architect-v2', JSON.stringify(result));
  }
  result.bookings = result.bookings.filter(b=>b.type==='block'||result.artists.some(a=>a.id===b.artistId)).map(b=>({...b,date:b.date||result.event.startDate}));
  return result;
}
let state = loadState(), currentDay = state.event.startDate, selectedArtistId = null, editingId = null, editingArtistId = null;
function save(){localStorage.setItem('festival-architect-v2',JSON.stringify(state));}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function writable(){if(state.final){toast('Reopen the final plan before editing.');return false;}return true;}
function closedMarkup(start,end,axisStart){if(end<=start)return '';return `<div class="closed-time" style="--minute-offset:${start-axisStart};--set-duration:${end-start};top:${start-axisStart}px;height:${end-start}px" title="Stage closed"><span>Closed</span></div>`;}
function calendarMarkup(day){
 const bounds=calendarBounds(),height=bounds.end-bounds.start;
 return `<div class="calendar-grid" style="--print-stages:${stages().length};--print-scale:${324/height};grid-template-columns:56px repeat(${stages().length},minmax(145px,1fr))"><div class="calendar-corner">TIME</div>${stages().map(s=>`<div class="calendar-stage">Stage ${s}</div>`).join('')}<div class="vertical-times" style="height:${height}px">${Array.from({length:Math.floor(height/60)+1},(_,i)=>`<span style="--minute-offset:${i*60};top:${i*60}px">${timeText(bounds.start+i*60)}</span>`).join('')}</div>${stages().map((s,i)=>{const h=stageHours(day,s);return `<div class="vertical-track" style="height:${height}px" aria-label="Stage ${s}, available ${timeText(h.start)}–${timeText(h.end)}">${closedMarkup(bounds.start,h.start,bounds.start)}${closedMarkup(h.end,bounds.end,bounds.start)}${state.bookings.filter(b=>b.date===day&&b.stage===s).map(b=>{const a={name:entryName(b),duration:entryDuration(b)};return `<button class="vertical-performance ${isPerformance(b)?'':'calendar-block'} ${a.duration<40?'compact-appointment':''}" data-booking="${b.id}" style="--minute-offset:${b.start-bounds.start};--set-duration:${a.duration};top:${b.start-bounds.start}px;height:${a.duration}px;background:${!isPerformance(b)?'#dfe2df':i%2?'#b7e4dc':'#f5c8be'}" aria-label="${escapeHtml(a.name)} · ${timeText(b.start)}–${timeText(b.start+a.duration)}"><strong>${escapeHtml(a.name)}</strong><span>${timeText(b.start)}–${timeText(b.start+a.duration)}</span></button>`;}).join('')}</div>`;}).join('')}</div>`;
}
let pendingBudgetChange=null;
function confirmBudget(projected,apply,budget=state.settings.budget){
 // Existing over-budget plans remain editable; confirm every increase in overspend.
 const oldShortfall=Math.max(0,total()-state.settings.budget),newShortfall=Math.max(0,projected-budget);
 if(newShortfall>oldShortfall){pendingBudgetChange=apply;$('#budget-warning').textContent=`This change brings the committed total to ${euros(projected)} against a ${euros(budget)} budget — ${euros(newShortfall)} over budget. Save it anyway?`;$('#budget-dialog').showModal();}else apply();
}
$('#confirm-budget').onclick=()=>{const apply=pendingBudgetChange;pendingBudgetChange=null;if(apply)apply();};
$('#budget-dialog').addEventListener('close',()=>{pendingBudgetChange=null;});
function printPlan(){
 if(!state.final)return;
 const unique=artistCount();
 $('#print-plan-content').innerHTML=`<header><h1>Festival Architect — Final lineup</h1><p>${dateText(state.event.startDate)} – ${dateText(state.event.endDate)} ${state.event.startDate.slice(0,4)} · Daily and stage hours shown below</p><p>${unique} artists · ${performances().length} performances · ${state.settings.stages} stages</p><p>Budget: ${euros(state.settings.budget)} · Used: ${euros(total())} · Remaining: ${euros(state.settings.budget-total())}${total()>state.settings.budget?' — OVER BUDGET':''}</p></header>${days().map(day=>{const bookings=state.bookings.filter(b=>b.date===day).sort((a,b)=>a.start-b.start||a.stage.localeCompare(b.stage));return `<section class="print-day"><h2>${dateText(day)} · ${timeText(dayHours(day).start)}–${timeText(dayHours(day).end)}</h2><p>${stages().map(s=>{const h=stageHours(day,s);return `Stage ${s}: ${timeText(h.start)}–${timeText(h.end)}`;}).join(' · ')}</p><div class="print-calendar">${calendarMarkup(day)}</div><h3>Appointments and notes</h3>${bookings.length?`<table><thead><tr><th>Time</th><th>Stage</th><th>Appointment</th><th>Genre</th><th>Duration</th><th>Fee</th><th>Notes</th></tr></thead><tbody>${bookings.map(b=>{const a={name:entryName(b),genre:isPerformance(b)?artist(b.artistId).genre:'Calendar block',duration:entryDuration(b),fee:entryFee(b)};return `<tr><td>${timeText(b.start)}–${timeText(b.start+a.duration)}</td><td>${b.stage}</td><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.genre)}</td><td>${a.duration} min</td><td>${isPerformance(b)?euros(a.fee):'—'}</td><td class="printed-notes">${escapeHtml(b.notes||'—')}</td></tr>`;}).join('')}</tbody></table>`:'<p>No performances planned for this day.</p>'}</section>`;}).join('')}`;
 hidePerformanceDetails();window.print();
}
$('#print-plan').onclick=printPlan;
function render(){
 hidePerformanceDetails();
 const dates=days(),index=dates.indexOf(currentDay);
 $('#event-summary').textContent=`${dates.length} ${dates.length===1?'day':'days'} · ${dateText(dates[0])}${dates.length>1?' – '+dateText(dates.at(-1)):''}`;
 $('.hero .eyebrow').textContent=`LINEUP PLANNER / ${state.event.startDate.slice(0,4)}`;
 const unique=artistCount();
 $('#performance-count').textContent=performances().length;
 $('#committed').textContent=euros(total());$('#remaining').textContent=euros(state.settings.budget-total());$('#stage-count').textContent=state.settings.stages;
 $('.budget-metric').classList.toggle('over-budget',total()>state.settings.budget);$('#print-plan').classList.toggle('hidden',!state.final);
 $('#finalise-btn').textContent=state.final?'Reopen as draft':'Finalise plan';
 $('#budget-total').textContent=euros(state.settings.budget);$('#budget-progress').value=state.settings.budget?total()/state.settings.budget*100:0;$('#edit-settings').disabled=state.final;
 $('#settings-form').querySelectorAll('input,button').forEach(e=>e.disabled=state.final);$('#add-artist').disabled=state.final;$('#add-block').disabled=state.final;
 $('#artist-list').innerHTML=state.artists.map(a=>{const booked=state.bookings.filter(b=>b.artistId===a.id);return `<article class="artist-card"><div class="avatar" style="background:${a.colour}">${escapeHtml(a.name.slice(0,2).toUpperCase())}</div><div><div class="artist-name">${escapeHtml(a.name)}</div><div class="artist-meta">${escapeHtml(a.genre)} · ${a.duration} min</div><div class="artist-meta">${euros(a.fee)} / performance</div>${booked.length?`<div class="booked-label">${state.final?'BOOKED':'PLANNED'} · ${booked.length} performance${booked.length===1?'':'s'}</div><ul class="artist-bookings">${booked.slice().sort((x,y)=>x.date.localeCompare(y.date)||x.start-y.start).map(b=>`<li>${dateText(b.date)} · Stage ${b.stage}<br>${timeText(b.start)}–${timeText(b.start+a.duration)}</li>`).join('')}</ul>`:'<div class="artist-meta">Not planned yet</div>'}</div><div class="artist-actions"><button class="button secondary" data-edit-artist="${a.id}" ${state.final?'disabled':''}>Edit</button><button class="button primary" data-artist="${a.id}" ${state.final?'disabled':''}>Book</button></div></article>`;}).join('')||'<p>No artists yet. Add your first artist above.</p>';
 const daily=dayHours(currentDay);$('.schedule-heading .catalogue-count').textContent=`Festival open ${timeText(daily.start)}–${timeText(daily.end)}`;
 $('#current-day').innerHTML=`<strong>${dateText(currentDay)}</strong><small>Day ${index+1} of ${dates.length}</small>`;$('#previous-day').disabled=index===0;$('#next-day').disabled=index===dates.length-1;
 $('#calendar').innerHTML=calendarMarkup(currentDay);
 $('#schedule-empty').textContent='No appointments on this day. Book an artist or add a calendar block to start planning.';$('#schedule-empty').classList.toggle('hidden',state.bookings.some(b=>b.date===currentDay));
 document.querySelectorAll('[data-artist]').forEach(e=>e.onclick=()=>openBooking(e.dataset.artist));document.querySelectorAll('[data-edit-artist]').forEach(e=>e.onclick=()=>openArtist(e.dataset.editArtist));document.querySelectorAll('[data-booking]').forEach(e=>{
 e.onclick=()=>{hidePerformanceDetails();const b=state.bookings.find(b=>b.id===e.dataset.booking);if(isPerformance(b))openBooking(null,b.id);else openBlock(b.id);};
 e.onmouseenter=e.onfocus=()=>showPerformanceDetails(e);
 e.onmouseleave=e.onblur=hidePerformanceDetails;
 e.onkeydown=event=>{if(event.key==='Escape')hidePerformanceDetails();};
 });
}
function openBooking(id,bookingId=null){if(!writable())return;editingId=bookingId;const b=state.bookings.find(x=>x.id===bookingId);selectedArtistId=b?b.artistId:id;const a=artist(selectedArtistId);
 $('#dialog-title').textContent=b?'Edit performance':'Book artist';$('#artist-preview').textContent=`${a.name} · ${a.genre} · ${euros(a.fee)} per performance`;
 $('#day-input').innerHTML=days().map(d=>`<option value="${d}">${dateText(d)}</option>`).join('');$('#day-input').value=b?.date||currentDay;
 $('#stage-input').innerHTML=stages().map(s=>`<option value="${s}">Stage ${s}</option>`).join('');$('#stage-input').value=b?.stage||'A';
 $('#time-input').min='00:00';$('#time-input').max='23:59';$('#time-input').value=timeText(b?.start??stageHours(currentDay,'A').start);$('#booking-notes').value=b?.notes||'';
 $('#duration-preview').textContent=`${a.duration} minutes`;$('#remove-btn').classList.toggle('hidden',!b);$('#form-message').textContent='';$('#save-btn').textContent=b?'Save changes':'Add to lineup';updateEndPreview();$('#booking-dialog').showModal();
}
function updateEndPreview(){const start=inputMinutes($('#time-input').value);$('#end-preview').textContent=Number.isFinite(start)?timeText(start+artist(selectedArtistId).duration):'—';}
$('#time-input').oninput=updateEndPreview;$('#close-dialog').onclick=$('#cancel-btn').onclick=()=>$('#booking-dialog').close();
$('#booking-form').onsubmit=e=>{e.preventDefault();if(!writable())return;const b={id:editingId||crypto.randomUUID(),artistId:selectedArtistId,date:$('#day-input').value,stage:$('#stage-input').value,start:inputMinutes($('#time-input').value),notes:$('#booking-notes').value.trim()};const problem=validation(b,editingId);if(problem){$('#form-message').textContent=problem;return;}const old=state.bookings.find(x=>x.id===editingId);const projected=total()-(old?entryFee(old):0)+artist(b.artistId).fee;confirmBudget(projected,()=>{if(!writable())return;const issue=validation(b,editingId);if(issue){$('#form-message').textContent=issue;return;}if(editingId)state.bookings=state.bookings.map(x=>x.id===editingId?b:x);else state.bookings.push(b);currentDay=b.date;save();$('#booking-dialog').close();render();toast('Performance saved.');});};
$('#remove-btn').onclick=()=>{if(!writable())return;state.bookings=state.bookings.filter(b=>b.id!==editingId);save();$('#booking-dialog').close();render();toast('Booking removed.');};
let editingBlockId=null;
function openBlock(id=null){
 if(!writable())return;editingBlockId=id;const b=state.bookings.find(b=>b.id===id);
 $('#block-dialog-title').textContent=b?'Edit calendar block':'Add calendar block';$('#block-title').value=b?.title||'';
 $('#block-day').innerHTML=days().map(d=>`<option value="${d}">${dateText(d)}</option>`).join('');$('#block-day').value=b?.date||currentDay;
 $('#block-stage').innerHTML=stages().map(s=>`<option value="${s}">Stage ${s}</option>`).join('');$('#block-stage').value=b?.stage||'A';
 $('#block-time').value=timeText(b?.start??stageHours(currentDay,'A').start);$('#block-time').min='00:00';$('#block-time').max='23:59';
 $('#block-duration').value=b?.duration??30;$('#block-notes').value=b?.notes||'';$('#block-message').textContent='';$('#remove-block').classList.toggle('hidden',!b);$('#block-dialog').showModal();
}
$('#add-block').onclick=()=>openBlock();$('#cancel-block').onclick=()=>$('#block-dialog').close();
$('#block-form').onsubmit=e=>{e.preventDefault();if(!writable())return;const b={id:editingBlockId||crypto.randomUUID(),type:'block',title:$('#block-title').value.trim(),date:$('#block-day').value,stage:$('#block-stage').value,start:inputMinutes($('#block-time').value),duration:Number($('#block-duration').value),notes:$('#block-notes').value.trim()};
 const problem=b.title?validation(b,editingBlockId):'Enter a title for this block.';if(problem){$('#block-message').textContent=problem;return;}
 if(editingBlockId)state.bookings=state.bookings.map(x=>x.id===editingBlockId?b:x);else state.bookings.push(b);currentDay=b.date;save();$('#block-dialog').close();render();toast('Calendar block saved.');};
$('#remove-block').onclick=()=>{if(!writable())return;state.bookings=state.bookings.filter(b=>b.id!==editingBlockId);save();$('#block-dialog').close();render();toast('Calendar block removed.');};
function openArtist(id=null){if(!writable())return;editingArtistId=id;const a=artist(id);$('#artist-dialog-title').textContent=a?'Edit artist':'Add artist';$('#name-input').value=a?.name||'';$('#genre-input').value=a?.genre||'';$('#fee-input').value=a?.fee??0;$('#duration-input').value=a?.duration??60;$('#delete-artist').classList.toggle('hidden',!a);$('#artist-message').textContent='';$('#artist-dialog').showModal();}
$('#add-artist').onclick=()=>openArtist();$('#cancel-artist').onclick=()=>$('#artist-dialog').close();
$('#artist-form').onsubmit=e=>{e.preventDefault();if(!writable())return;const old=artist(editingArtistId);const a={id:editingArtistId||crypto.randomUUID(),name:$('#name-input').value.trim(),genre:$('#genre-input').value.trim(),fee:Number($('#fee-input').value),duration:Number($('#duration-input').value),colour:old?.colour||'#d8c7ed'};
 if(!a.name||!a.genre){$('#artist-message').textContent='Enter a name and genre.';return;}
 const previous=state.artists;state.artists=old?state.artists.map(x=>x.id===a.id?a:x):[...state.artists,a];
 const problem=state.bookings.filter(b=>b.artistId===a.id).map(b=>validation(b,b.id)).find(Boolean);
 const proposed=state.artists,projected=total();state.artists=previous;if(problem){$('#artist-message').textContent=problem;return;}confirmBudget(projected,()=>{state.artists=proposed;save();$('#artist-dialog').close();render();toast('Artist saved.');});};
$('#delete-artist').onclick=()=>{const count=state.bookings.filter(b=>b.artistId===editingArtistId).length;$('#delete-description').textContent=`Delete ${artist(editingArtistId).name} from the catalogue? ${count?`Their ${count} performance(s) will also be removed and their budget released.`:'They have no booked performances.'}`;$('#delete-dialog').showModal();};
$('#confirm-delete').onclick=()=>{if(!writable())return;state.artists=state.artists.filter(a=>a.id!==editingArtistId);state.bookings=state.bookings.filter(b=>b.artistId!==editingArtistId);save();$('#artist-dialog').close();render();toast('Artist deleted.');};
function hidePerformanceDetails() { $('#performance-tooltip').hidden=true;document.querySelectorAll('[data-booking]').forEach(e=>e.removeAttribute('aria-describedby')); }
function showPerformanceDetails(element) {
 const b=state.bookings.find(b=>b.id===element.dataset.booking),a={name:entryName(b),duration:entryDuration(b)},tip=$('#performance-tooltip');
 tip.innerHTML=`<strong>${escapeHtml(a.name)}</strong><span>${isPerformance(b)?escapeHtml(artist(b.artistId).genre)+' · '+euros(entryFee(b))+' per performance':'Calendar block'}</span><span>${a.duration} minutes · Stage ${b.stage}</span><span>${dateText(b.date)} · ${timeText(b.start)}–${timeText(b.start+a.duration)}</span>${b.notes?`<span class="tooltip-notes">${escapeHtml(b.notes)}</span>`:''}`;
 tip.hidden=false;element.setAttribute('aria-describedby','performance-tooltip');
 const rect=element.getBoundingClientRect(),box=tip.getBoundingClientRect();
 tip.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-box.width-8))}px`;
 tip.style.top=`${rect.bottom+box.height+16<window.innerHeight?rect.bottom+8:Math.max(8,rect.top-box.height-8)}px`;
}
window.addEventListener('scroll',()=>{const focused=document.activeElement;if(focused?.matches('[data-booking]'))showPerformanceDetails(focused);else hidePerformanceDetails();},true);window.addEventListener('resize',hidePerformanceDetails);
$('#edit-settings').onclick=()=>{if(!writable())return;$('#stages-input').value=state.settings.stages;$('#budget-input').value=state.settings.budget;$('#settings-message').textContent='';$('#settings-dialog').showModal();};
$('#cancel-settings').onclick=()=>$('#settings-dialog').close();
$('#settings-form').onsubmit=e=>{e.preventDefault();if(!writable())return;const settings={stages:Number($('#stages-input').value),budget:Number($('#budget-input').value)};if(state.bookings.some(b=>b.stage.charCodeAt(0)-65>=settings.stages)){$('#settings-message').textContent='Move or remove bookings on those stages first.';return;}confirmBudget(total(),()=>{state.settings=settings;save();render();$('#settings-dialog').close();toast('Planning settings saved.');},settings.budget);};
$('#previous-day').onclick=()=>{currentDay=days()[days().indexOf(currentDay)-1];render();};$('#next-day').onclick=()=>{currentDay=days()[days().indexOf(currentDay)+1];render();};
$('#finalise-btn').onclick=()=>{if(state.final){state.final=false;save();render();return;}$('#finalise-dialog').showModal();};
$('#confirm-finalise').onclick=()=>{state.final=true;save();render();toast('Lineup finalised.');};
document.querySelectorAll('.sidebar-item').forEach(b=>b.onclick=()=>{if(!['Lineup planner','Checklist'].includes(b.dataset.section)){toast(`${b.dataset.section} will be added in a later feature branch.`);return;}document.querySelectorAll('.sidebar-item').forEach(item=>item.classList.toggle('active',item===b));});
render();
