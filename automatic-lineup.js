// Compact, read-only timetable using the same minute positions as the full calendar.
function lineupSuggestionMarkup(plan, headlinerBookings) {
  return eventDays(plan.event).map(date=>{
    const hours=dayHours(date,plan.event), span=hours.end-hours.start;
    const position=minute=>100*(minute-hours.start)/span;
    const ticks=[hours.start];
    for(let t=Math.ceil(hours.start/120)*120;t<hours.end;t+=120) if(t>hours.start+30&&t<hours.end-30)ticks.push(t);
    ticks.push(hours.end);
    return `<section class="suggest-day" aria-label="${escapeHtml(dateText(date))}"><h3>${escapeHtml(dateText(date))}</h3>
      <div class="suggest-axis"><span>Stage</span><div>${ticks.map((t,i)=>`<span class="${i===0?'first':i===ticks.length-1?'last':''}" style="left:${position(t)}%">${timeText(t)}</span>`).join('')}</div></div>
      ${planStages(plan).map((stage,index)=>{
        const h=stageHours(date,stage,plan.event);
        const closed=(start,end)=>end>start?`<span class="suggest-closed" style="left:${position(start)}%;width:${100*(end-start)/span}%" title="Stage closed"></span>`:'';
        const entries=plan.bookings.filter(b=>b.date===date&&b.stage===stage).sort((a,b)=>a.start-b.start);
        return `<div class="suggest-row" role="group" aria-label="${escapeHtml(stageName(stage,plan))}"><span class="suggest-stage" title="${escapeHtml(stageName(stage,plan))}">${escapeHtml(stageName(stage,plan))}</span>
          <div class="suggest-track" style="--suggest-hour:${6000/span}%;--suggest-stage-colour:${index%2?'#b7e4dc':'#f5c8be'}">
          ${closed(hours.start,h.start)}${closed(h.end,hours.end)}
          ${entries.map(b=>{
            const performance=isPerformance(b), name=entryName(b,plan), end=b.start+entryDuration(b,plan);
            const headline=performance&&b.id===headlinerBookings[date];
            const description=`${name}${headline?' · Headliner':''} · ${timeText(b.start)}–${timeText(end)}${end>1440?' (+1 day)':''}${performance?' · '+bookingStatus(b):''}`;
            return `<span tabindex="0" role="img" aria-label="${escapeHtml(description)}" class="suggest-set ${performance?'':'suggest-block'} ${headline?'suggest-headliner':''}" style="left:${position(b.start)}%;width:${100*(end-b.start)/span}%">${performance?`<strong>${escapeHtml(name)}</strong>`:''}</span>`;
          }).join('')}</div></div>`;
      }).join('')}</section>`;
  }).join('');
}

// Configuration and review for the pure automaticLineup rule.
(function () {
  const button = $('#auto-plan-lineup'), dialog = $('#auto-plan-dialog');
  let preview = null, source = null, base = null;
  let headlinerFields = [];
  const previewArea=$('#auto-plan-preview'), detail=$('#auto-plan-tooltip');
  let activeBar=null;
  function hideDetail() {
    activeBar?.removeAttribute('aria-describedby');
    activeBar=null; detail.hidden=true;
  }
  function showDetail(event) {
    const bar=event.target.closest?.('.suggest-set');
    if(!bar)return;
    hideDetail();activeBar=bar;
    detail.textContent=bar.getAttribute('aria-label');
    detail.hidden=false;
    bar.setAttribute('aria-describedby','auto-plan-tooltip');
    const rect=bar.getBoundingClientRect(), box=detail.getBoundingClientRect();
    const width=document.documentElement?.clientWidth||1024;
    const height=document.documentElement?.clientHeight||768;
    detail.style.left=Math.max(8,Math.min(rect.left,width-box.width-8))+'px';
    const above=rect.top-box.height-8;
    detail.style.top=Math.max(8,Math.min(above>=8?above:rect.bottom+8,height-box.height-8))+'px';
  }
  previewArea.addEventListener('pointerover',showDetail);
  previewArea.addEventListener('focusin',showDetail);
  previewArea.addEventListener('click',showDetail);
  previewArea.addEventListener('pointerout',event=>{
    if(activeBar&&event.relatedTarget?.closest?.('.suggest-set')===activeBar)return;
    hideDetail();
  });
  previewArea.addEventListener('focusout',hideDetail);
  previewArea.addEventListener('scroll',hideDetail);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape')hideDetail();});

  function invalidate() {
    hideDetail();
    preview = null; source = null; base = null;
    $('#auto-plan-apply').disabled = true;
    $('#auto-plan-preview').innerHTML = '';
    $('#auto-plan-message').textContent = '';
    $('#auto-plan-timing').textContent = '';
  }
  function updateAccess() {
    button.disabled = !canFestival('lineup') || state.final || Boolean(lineupLoadProblem);
  }
  document.querySelector('[data-section="Lineup planner"]').addEventListener('click', updateAccess);
  function showHeadlinerFields() {
    const dates = eventDays(state.event);
    const confirmed = state.bookings.filter(b => isPerformance(b) && b.status === 'confirmed');
    const booked = new Set(confirmed.map(b => b.artistId));
    const selections = new Map(), used = new Set();
    function select(date, id) {
      if (!id || selections.has(date) || used.has(id) || !state.artists.some(artist => artist.id === id)) return;
      if (booked.has(id) && !confirmed.some(b => b.artistId === id && b.date === date)) return;
      selections.set(date, id);
      used.add(id);
    }
    dates.forEach(date => select(date, state.lineupHeadliners?.[date]));
    select(dates.at(-1), state.lineupHeadlinerId);
    dates.forEach(date => {
      const closing = confirmed.filter(b => b.date === date).sort((a,b) => b.start + b.duration - a.start - a.duration)[0];
      select(date, closing?.artistId);
    });
    dates.forEach(date => select(date, state.artists.find(a => !used.has(a.id) && !booked.has(a.id))?.id));
    const options = '<option value="">Choose an artist</option>' +
      state.artists.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
    headlinerFields = dates.map((date, index) => [date, index === dates.length - 1 ? 'auto-plan-headliner' : 'auto-plan-headliner-' + index]);
    $('#auto-plan-headliners').innerHTML = headlinerFields.map(([date, id]) =>
      `<label>Headliner · ${escapeHtml(dateText(date))}<select id="${id}" required>${options}</select></label>`).join('');
    for (const [date, id] of headlinerFields) {
      const field = $('#' + id);
      field.value = selections.get(date) || '';
      field.onchange = suggest;
    }
  }
  button.onclick = () => {
    if (!writable()) return;
    showHeadlinerFields();
    dialog.showModal();
    suggest();
  };
  $('#auto-plan-changeover').addEventListener('input', invalidate);
  $('#auto-plan-changeover').addEventListener('change', suggest);
  $('#auto-plan-cancel').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { invalidate(); button.focus(); updateAccess(); });
  $('#auto-plan-form').onsubmit = event => { event.preventDefault(); suggest(); };
  function suggest() {
    invalidate();
    if (!writable()) return;
    const raw = $('#auto-plan-changeover').value;
    const confirmedIds=new Set(state.bookings.filter(b=>isPerformance(b)&&b.status==='confirmed').map(b=>b.id));
    base={...state,bookings:state.bookings.filter(b=>isPerformance(b)?confirmedIds.has(b.id):!b.linkedTo||confirmedIds.has(b.linkedTo))};
    const replaced=state.bookings.filter(b=>isPerformance(b)&&!confirmedIds.has(b.id)).length;
    $('#auto-plan-context').textContent=replaced ? `Using this suggestion replaces ${replaced} tentative performances. Confirmed performances and calendar blocks stay.` : 'Confirmed performances and calendar blocks stay. New performances are tentative.';
    const headliners = Object.fromEntries(headlinerFields.map(([date, id]) => [date, $('#' + id).value]));
    const result = automaticLineup(base, {changeover:raw === '' ? NaN : Number(raw),realistic:true,headliners});
    $('#auto-plan-message').textContent = result.problem;
    if (result.problem) return;
    preview = { ...result, headliners }; source = JSON.stringify(state);
    const sets = result.bookings.filter(isPerformance);
    const addedFee = sets.reduce((sum,b) => sum+b.fee,0);
    // Same budget rule as manual booking: going over is allowed, and shown before applying.
    const remaining = state.settings.budget-base.bookings.reduce((sum,b)=>sum+entryFee(b,base),0)-addedFee;
    const budgetText = remaining >= 0 ? `${euros(remaining)} budget remaining` : `${euros(-remaining)} over the ${euros(state.settings.budget)} artist budget`;
    $('#auto-plan-message').textContent = `${sets.length} suggested performances · ${euros(addedFee)} artist fees · ${budgetText}${result.skipped.length?' · '+result.skipped.length+' not scheduled':''}`;
    $('#auto-plan-timing').textContent=result.notice || '';
    $('#auto-plan-preview').innerHTML = lineupSuggestionMarkup({...base,bookings:base.bookings.concat(result.bookings)},result.headlinerBookings) + (result.skipped.length ? '<h3>Not scheduled</h3><ul>'+result.skipped.map(x => `<li><strong>${escapeHtml(artist(x.artistId).name)}</strong> — ${escapeHtml(x.reason)}</li>`).join('')+'</ul>' : '');
    $('#auto-plan-apply').textContent = result.skipped.length ? 'Use partial lineup' : 'Use this lineup';
    $('#auto-plan-apply').disabled = !sets.length;
  };
  $('#auto-plan-apply').onclick = () => {
    if (!writable() || !preview) return;
    if (JSON.stringify(state) !== source) {
      invalidate(); $('#auto-plan-message').textContent = 'The festival changed. Preview the lineup again before applying.'; return;
    }
    const next = {...state, lineupHeadliners:preview.headliners, lineupHeadlinerId:preview.headliners[eventDays(state.event).at(-1)], bookings:base.bookings.concat(preview.bookings)};
    const problems = planProblems(next);
    if (problems.length) { $('#auto-plan-message').textContent = problems[0]; return; }
    const apply = () => {
      if (!writable() || JSON.stringify(state) !== source) {
        invalidate(); $('#auto-plan-message').textContent = 'The festival changed. Preview the lineup again before applying.'; return;
      }
      if (!save(next)) { $('#auto-plan-message').textContent = 'Could not save the lineup. Your previous timetable is kept.'; return; }
      dialog.close(); render(); toast('Suggested lineup saved. New performances are tentative.');
    };
    // Like a manual booking: ask first (same dialog) if this creates or increases a budget overrun.
    if (budgetOverrunGrows(state, next)) confirmBudget(next.bookings.reduce((sum,b) => sum+entryFee(b,next), 0), apply);
    else apply();
  };
  updateAccess();
})();
