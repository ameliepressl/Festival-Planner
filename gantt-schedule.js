// Proposed schedule, relative to the festival dates; no completion tracking.
window.initialiseGanttTimeline = function () {
  const boundaries = window.ganttDefaultBoundaries;
  const DAY = 86400000;
  const parseDate = value => new Date(value + 'T12:00:00Z');
  const opening = parseDate(state.event.startDate);
  const ending = parseDate(state.event.endDate);
  const afterEvent = Math.round((ending - opening) / DAY) + 1;
  let firstOffset = -84;
  let lastOffset = Math.max(13, afterEvent + 11);
  let weekCount;
  const formatDate = offset => new Date(opening.getTime() + offset * DAY).toLocaleDateString('en-GB', {day:'numeric',month:'short',timeZone:'UTC'});
  const chart = document.querySelector('#gantt-view');
  const rows = Array.from(chart.querySelectorAll('tbody tr'));
  const numberOf = row => row.querySelector('.gantt-outline-number, .gantt-category-number').textContent.trim().replace(/\.$/, '');
  const ranges = new Map();
  rows.filter(row => row.classList.contains('gantt-subtask')).forEach(row => {
    const number = numberOf(row);
    const start=Math.round((parseDate(row.dataset.startDate)-opening)/DAY);
    const end=Math.round((parseDate(row.dataset.endDate)-opening)/DAY);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)return;
    ranges.set(row,{start,end});

  });
  rows.slice().reverse().forEach(row => {
    if (ranges.has(row)) return;
    const prefix = numberOf(row) + '.';
    const descendants = rows.filter(child => numberOf(child).startsWith(prefix) && ranges.has(child)).map(child => ranges.get(child));
    if(descendants.length)ranges.set(row, {start:Math.min(...descendants.map(r=>r.start)),end:Math.max(...descendants.map(r=>r.end))});
  });
  const scheduled=Array.from(ranges.values());
  firstOffset=Math.floor(Math.min(-84,...scheduled.map(r=>r.start))/7)*7;
  lastOffset=Math.max(lastOffset,...scheduled.map(r=>r.end));
  weekCount=Math.ceil((lastOffset-firstOffset+1)/7);
  chart.querySelector('.gantt-caption').textContent = `${formatDate(firstOffset)} – ${formatDate(lastOffset)} ${opening.getUTCFullYear()} · Festival ${formatDate(0)} – ${formatDate(afterEvent-1)} · Proposed daily schedule`;
  chart.querySelector('.gantt-empty').textContent = 'Head of project · Edit tasks and dates using Edit plan. Changes are saved in this browser. Owners are unassigned.';
  const header = chart.querySelector('thead tr');
  const table = chart.querySelector('table');
  const expanded = new Set(window.ganttExpandedWeeks ?? Array.from({length:weekCount},(_,i)=>i+1));
  function draw() {
    window.ganttExpandedWeeks=Array.from(expanded);
    while(header.children.length>2)header.lastElementChild.remove();
    const dateCells=new Map(rows.map(row=>[row,row.querySelector('.gantt-date-cell')]));
    rows.forEach(row=>{while(row.children.length>2)row.lastElementChild.remove();});
    const editing=chart.classList.contains('gantt-editing');
    header.children[1].textContent='Owner';
    if(editing){
      const datesHeader=document.createElement('th');datesHeader.scope='col';datesHeader.className='gantt-dates-header';datesHeader.textContent='Subtask dates';header.append(datesHeader);
      rows.forEach(row=>{const cell=dateCells.get(row)||document.createElement('td');cell.className='gantt-date-cell';row.append(cell);});
    }
    let columnCount=0, timelineWidth=0;
    for(let week=1;week<=weekCount;week++) {
      const start=firstOffset+(week-1)*7;
      const end=Math.min(start+6,lastOffset);
      const daily=expanded.has(week);
      const spans=daily?Array.from({length:end-start+1},(_,i)=>({start:start+i,end:start+i})):[{start,end}];
      spans.forEach((span,index)=>{
        columnCount++; timelineWidth += daily ? 58 : 122;
        const th=document.createElement('th');th.scope='col';
        th.className=daily?'gantt-day-header':'gantt-week-header';
        th.style.width=daily?'58px':'122px';
        if(index===0){
          const button=document.createElement('button');button.type='button';button.className='gantt-week-toggle';button.dataset.week=week;
          button.innerHTML=`<span class="gantt-chevron" aria-hidden="true">›</span><span>Week ${week}</span>`;
          button.title=daily?'Show this week as one column':'Show the seven days of this week';
          button.setAttribute('aria-label',`${daily?'Collapse':'Expand'} Week ${week}${daily?' to week view':' to day view'}`);
          button.setAttribute('aria-expanded',String(daily));
          button.onclick=()=>{const anchor=captureAnchor();daily?expanded.delete(week):expanded.add(week);draw();restoreAnchor(anchor);header.querySelector(`[data-week="${week}"]`).focus({preventScroll:true});};
          th.append(button);
        }
        const label=document.createElement('span');label.className='gantt-day-label';label.textContent=daily?formatDate(span.start):`${formatDate(start)}–${formatDate(end)}`;th.append(label);
        const festival=span.start<=afterEvent-1&&span.end>=0;
        if(festival){th.classList.add('gantt-festival-day');th.title='Festival days; preparation due before gates open';}
        th.dataset.start=span.start;th.dataset.end=span.end;
        header.append(th);
        rows.forEach(row=>{
          const cell=document.createElement('td');cell.className=daily?'gantt-day-cell':'gantt-week';
          if(festival)cell.classList.add('gantt-festival-day');
          const range=ranges.get(row);
          if(range&&range.start<=span.end&&range.end>=span.start){
            const bar=document.createElement('span');bar.className='gantt-schedule-bar';
            const left=Math.max(range.start,span.start),right=Math.min(range.end,span.end);
            bar.style.left=`${(left-span.start)/(span.end-span.start+1)*100}%`;
            bar.style.width=`${(right-left+1)/(span.end-span.start+1)*100}%`;
            const title=`${formatDate(range.start)} – ${formatDate(range.end)}${range.end===0&&!numberOf(row).startsWith('13.')?' · finish before gates open':''}`;
            cell.title=title;bar.setAttribute('aria-hidden','true');cell.append(bar);
          }
          cell.dataset.start=span.start;cell.dataset.end=span.end;
          row.append(cell);
        });
      });
    }
    table.dataset.timelineWidth=timelineWidth;
    const taskWidth=!chart.classList.contains('gantt-editing')&&chart.querySelector('.gantt-scroll').scrollLeft>8?160:270;
    table.style.setProperty('--gantt-task-width',taskWidth+'px');
    table.style.width=`${taskWidth+110+(chart.classList.contains('gantt-editing')?260:0)+timelineWidth}px`;
    table.style.minWidth='100%';
    updateTimelineState();
    updateToday(true);

  }
  function updateTimelineState() {
    const mode=expanded.size===0?'weeks':expanded.size===weekCount?'days':'custom';
    chart.querySelectorAll('[data-timeline]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.timeline===mode)));
    chart.querySelector('#timeline-state').textContent=mode==='custom'?'Custom':'';
  }
  function captureAnchor() {
    const position=chart.querySelector('.gantt-scroll').scrollLeft;
    let offset=0;
    for(const cell of header.querySelectorAll('th[data-start]')){
      const width=parseFloat(cell.style.width);
      if(offset+width>position)return Number(cell.dataset.start)+(position-offset)/width*(Number(cell.dataset.end)-Number(cell.dataset.start)+1);
      offset+=width;
    }
    return firstOffset;
  }
  function restoreAnchor(anchor) {
    let offset=0;
    for(const cell of header.querySelectorAll('th[data-start]')){
      const start=Number(cell.dataset.start),end=Number(cell.dataset.end),width=parseFloat(cell.style.width);
      if(anchor>=start&&anchor<end+1){offset+=(anchor-start)/(end-start+1)*width;break;}
      offset+=width;
    }
    chart.querySelector('.gantt-scroll').scrollLeft=offset;
  }
  chart.querySelectorAll('[data-timeline]').forEach(button=>button.onclick=()=>{
    const anchor=captureAnchor();expanded.clear();
    if(button.dataset.timeline==='days')for(let week=1;week<=weekCount;week++)expanded.add(week);
    draw();restoreAnchor(anchor);
  });
  const preview=document.querySelector('#gantt-preview-chart');
  if(preview){
    preview.replaceChildren();const duration=lastOffset-firstOffset+1;
    const headerLine=document.createElement('span');headerLine.className='gantt-preview-row gantt-preview-weeks';
    const label=document.createElement('span');label.textContent='Project weeks';
    const scale=document.createElement('span');scale.className='gantt-preview-scale';
    for(let week=1;week<=weekCount;week++){
      const tick=document.createElement('span');tick.textContent=week;
      tick.style.flexGrow=Math.min(7,duration-(week-1)*7);
      scale.append(tick);
    }
    headerLine.append(label,scale);preview.append(headerLine);
    rows.filter(row=>row.classList.contains('gantt-category')).forEach(row=>{
      const line=document.createElement('span');line.className='gantt-preview-row';line.setAttribute('style',row.getAttribute('style'));
      const name=document.createElement('span');name.className='gantt-preview-name';name.textContent=(row.querySelector('th').title||row.querySelector('th').textContent).trim().replace(/^›\s*/,'');
      const track=document.createElement('span');track.className='gantt-preview-track';const range=ranges.get(row);
      if(range){const bar=document.createElement('span');bar.className='gantt-preview-bar';bar.style.left=((range.start-firstOffset)/duration*100)+'%';bar.style.width=((range.end-range.start+1)/duration*100)+'%';track.append(bar);}
      line.append(name,track);preview.append(line);
    });
  }
  const todayFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'});
  let lastToday;
  function updateToday(force=false){
    const {year,month,day}=Object.fromEntries(todayFormat.formatToParts(new Date()).map(({type,value})=>[type,value]));
    const today=Math.round((parseDate(year+'-'+month+'-'+day)-opening)/DAY);
    if(!force&&today===lastToday)return;
    lastToday=today;
    chart.querySelectorAll('.gantt-today').forEach(cell=>cell.classList.remove('gantt-today'));
    chart.querySelector('.gantt-today-label')?.remove();
    if(today>=firstOffset&&today<=lastOffset){
      const column=Array.from(header.querySelectorAll('[data-start]')).find(cell=>today>=Number(cell.dataset.start)&&today<=Number(cell.dataset.end));
      if(column){
        const start=Number(column.dataset.start),end=Number(column.dataset.end);
        const position=(today-start+.5)/(end-start+1)*100+'%';
        for(const cell of [column,...rows.map(row=>row.cells[column.cellIndex])]){
          cell.style.setProperty('--today-position',position);
          cell.classList.add('gantt-today');
        }
        const badge=document.createElement('span');badge.className='gantt-today-label';badge.textContent='Today';column.append(badge);
      }
    }
    if(preview){
      preview.classList.toggle('gantt-preview-has-today',today>=firstOffset&&today<=lastOffset);
      preview.style.setProperty('--today-position',(today-firstOffset+.5)/(lastOffset-firstOffset+1)*100+'%');
    }
  }
  draw();
  clearInterval(window.ganttTodayTimer);
  window.ganttTodayTimer=setInterval(updateToday,60000);
  const scroller=chart.querySelector('.gantt-scroll');
  rows.forEach(row=>{
    const heading=row.querySelector('th');
    if(heading.querySelector('.gantt-label-preview'))return;
    const label=document.createElement('div');label.className='gantt-label-preview';
    heading.title=heading.textContent.trim();
    while(heading.firstChild)label.append(heading.firstChild);
    heading.append(label);
  });
  function alignFrozenColumn(){
    const sideways=scroller.scrollLeft>8;
    const editing=chart.classList.contains('gantt-editing');
    const width=sideways&&!editing?160:270;
    scroller.classList.toggle('gantt-scrolled-sideways',sideways);
    table.style.setProperty('--gantt-task-width',width+'px');
    table.style.width=(width+110+(editing?260:0)+Number(table.dataset.timelineWidth))+'px';
  }
  scroller.onscroll=alignFrozenColumn;
  alignFrozenColumn();
};
window.initialiseGanttTimeline();
