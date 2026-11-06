// Proposed schedule, relative to the festival dates; no completion tracking.
(function () {
  const boundaries = {"1.1": [-84, -82, -80, -78, -76], "1.2": [-76, -73, -70, -2, 0], "2.1": [-76, -73, -71, -70, -68], "2.2": [-68, -67, -56, -7, 0], "3.1": [-68, -64, -51, -42, -35], "3.2": [-35, -28, -21, -2, 1], "3.3": [-63, -56, -42, -28, -7], "4.1": [-70, -66, -61, -58, -56], "4.2": [-56, -55, -53, -52, -51], "4.3": [-35, -32, -29, -26, -25], "4.4": [-51, -47, -42, -35, -1], "4.5": [-21, -17, -12, -7, 1], "5.1": [-68, -63, -49, -42, -35], "5.2": [-35, -32, -28, -25, -21], "5.3": [-21, -14, -10, -7, 1], "5.4": [-35, -28, -21, -14, 1], "6.1": [-63, -59, -49, -42, -35], "6.2": [-35, -28, -21, -14, -2], "7.1": [-49, -42, -35, -28, -1], "7.2": [-76, -70, -66, -63, -60], "7.3": [-60, -53, -42, -1, 1], "7.4": [-53, -42, -14, -1, 1], "7.5": [-49, -42, -35, -1, 1], "7.6": [-49, -42, -35, -1, 1], "7.7": [-42, -28, -7, -1, 1], "7.8": [-56, -49, -35, -3, -1, 1], "7.9": [-49, -42, -28, -1, 1], "7.10": [-42, -35, -21, -2, 0], "7.11": [-28, -21, -14, -2, 1], "8.1": [-63, -56, -49, -2, 1], "8.2": [-56, -49, -35, -7, 1], "8.3": [-42, -35, -14, -1, 1], "8.4": [-42, -35, -28, -7, 1], "8.5": [-56, -49, -35, -14, 1], "8.6": [-35, -28, -7, -1, 1], "8.7": [-35, -28, -21, -7, 1], "9.1": [-56, -49, -28, -14, 1], "9.2": [-14, -10, -3, 0, 1], "9.3": [-28, -21, -7, -2, 1], "10.1": [-63, -60, -57, -55, -54], "10.2": [-28, -21, -7, -2, 1], "10.3": [-28, -21, -14, -2, 1], "11.1": [-28, -21, -7, -1, 1], "11.2": [-42, -35, -28, -14, 1], "11.3": [-28, -21, -14, -7, 1], "11.4": [-21, -14, -7, -2, 1], "12.1": [-76, -73, -68, -21, -14], "12.2": [-63, -56, -49, -21, -14], "12.3": [-68, -63, -56, -49, -42], "13.1": [0, 1, 2, 4, 6], "13.2": [0, 2, 3, 5, 7], "13.3": [2, 5, 7, 9, 12]};
  const DAY = 86400000;
  const parseDate = value => new Date(value + 'T12:00:00Z');
  const opening = parseDate(state.event.startDate);
  const ending = parseDate(state.event.endDate);
  const afterEvent = Math.round((ending - opening) / DAY) + 1;
  const firstOffset = -84;
  const lastOffset = Math.max(13, afterEvent + 11);
  const weekCount = Math.ceil((lastOffset - firstOffset + 1) / 7);
  const formatDate = offset => new Date(opening.getTime() + offset * DAY).toLocaleDateString('en-GB', {day:'numeric',month:'short',timeZone:'UTC'});
  const chart = document.querySelector('#gantt-view');
  const rows = Array.from(chart.querySelectorAll('tbody tr'));
  const numberOf = row => row.querySelector('.gantt-outline-number, .gantt-category-number').textContent.trim().replace(/\.$/, '');
  const ranges = new Map();
  rows.filter(row => row.classList.contains('gantt-subtask')).forEach(row => {
    const number = numberOf(row);
    const parts = number.split('.');
    const group = parts.slice(0,2).join('.');
    const index = Number(parts[2]) - 1;
    const points = boundaries[group];
    if (!points || index + 1 >= points.length) throw new Error('Missing schedule: ' + number);
    const shift = group.startsWith('13.') ? afterEvent : 0;
    ranges.set(row, {start:points[index] + shift, end:points[index+1] - 1 + shift});
  });
  rows.slice().reverse().forEach(row => {
    if (ranges.has(row)) return;
    const prefix = numberOf(row) + '.';
    const descendants = rows.filter(child => numberOf(child).startsWith(prefix) && ranges.has(child)).map(child => ranges.get(child));
    ranges.set(row, {start:Math.min(...descendants.map(r=>r.start)),end:Math.max(...descendants.map(r=>r.end))});
  });
  chart.querySelector('.gantt-caption').textContent = `${formatDate(firstOffset)} – ${formatDate(lastOffset)} ${opening.getUTCFullYear()} · Festival ${formatDate(0)} – ${formatDate(afterEvent-1)} · Proposed daily schedule`;
  chart.querySelector('.gantt-empty').textContent = 'Planning template: teams work in parallel. Opening-day preparation is due before gates open. Pack-down and evaluation follow the festival. Owners are unassigned.';
  const header = chart.querySelector('thead tr');
  const table = chart.querySelector('table');
  const expanded = new Set(Array.from({length:weekCount},(_,i)=>i+1));
  function draw() {
    while(header.children.length>2)header.lastElementChild.remove();
    rows.forEach(row=>{while(row.children.length>2)row.lastElementChild.remove();});
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
          button.textContent=`${daily?'−':'+'} W${week}`;
          button.setAttribute('aria-label',`${daily?'Collapse':'Expand'} Week ${week}${daily?' to week view':' to day view'}`);
          button.setAttribute('aria-expanded',String(daily));
          button.onclick=()=>{daily?expanded.delete(week):expanded.add(week);draw();header.querySelector(`[data-week="${week}"]`).focus();};
          th.append(button);
        }
        const label=document.createElement('span');label.className='gantt-day-label';label.textContent=daily?formatDate(span.start):`${formatDate(start)}–${formatDate(end)}`;th.append(label);
        const festival=span.start<=afterEvent-1&&span.end>=0;
        if(festival){th.classList.add('gantt-festival-day');th.title='Festival days; preparation due before gates open';}
        header.append(th);
        rows.forEach(row=>{
          const cell=document.createElement('td');cell.className=daily?'gantt-day-cell':'gantt-week';
          if(festival)cell.classList.add('gantt-festival-day');
          const range=ranges.get(row);
          if(range.start<=span.end&&range.end>=span.start){
            const bar=document.createElement('span');bar.className='gantt-schedule-bar';
            const left=Math.max(range.start,span.start),right=Math.min(range.end,span.end);
            bar.style.left=`${(left-span.start)/(span.end-span.start+1)*100}%`;
            bar.style.width=`${(right-left+1)/(span.end-span.start+1)*100}%`;
            const title=`${formatDate(range.start)} – ${formatDate(range.end)}${range.end===0&&!numberOf(row).startsWith('13.')?' · finish before gates open':''}`;
            cell.title=title;bar.setAttribute('aria-hidden','true');cell.append(bar);
          }
          row.append(cell);
        });
      });
    }
    table.style.width=`${380+timelineWidth}px`;
    table.style.minWidth='100%';

  }
  const controls=chart.querySelector('.gantt-controls');
  const weeks=document.createElement('button');weeks.type='button';weeks.className='button secondary';weeks.textContent='All weeks';weeks.onclick=()=>{expanded.clear();draw();};
  const days=document.createElement('button');days.type='button';days.className='button secondary';days.textContent='All days';days.onclick=()=>{for(let w=1;w<=weekCount;w++)expanded.add(w);draw();};
  controls.append(weeks,days);
  const checks=Array.from(ranges.entries()).filter(([row])=>row.classList.contains('gantt-subtask'));
  if(checks.length!==209||checks.some(([row,r])=>r.start>r.end||(!numberOf(row).startsWith('13.')&&r.end>0)))throw new Error('Invalid preparation schedule');
  draw();
  const scroller=chart.querySelector('.gantt-scroll');
  rows.forEach(row=>{
    const heading=row.querySelector('th');
    const label=document.createElement('div');label.className='gantt-label-preview';
    heading.title=heading.textContent.trim();
    while(heading.firstChild)label.append(heading.firstChild);
    heading.append(label);
  });
  scroller.addEventListener('scroll',()=>{
    scroller.classList.toggle('gantt-scrolled-sideways',scroller.scrollLeft>8);
  },{passive:true});
})();
