// Browser-local project plan. User accounts and enforced permissions are future work.
(function () {
  const KEY='festival-gantt-project-v1';
  const DAY=86400000;
  const iso=date=>date.toISOString().slice(0,10);
  const opening=new Date(state.event.startDate+'T12:00:00Z');
  const afterEvent=Math.round((new Date(state.event.endDate+'T12:00:00Z')-opening)/DAY)+1;
  const dateAt=offset=>iso(new Date(opening.getTime()+offset*DAY));
  const tbody=document.querySelector('#gantt-view tbody');
  const defaults=[];let area,task;
  Array.from(tbody.rows).forEach(row=>{
    const heading=row.querySelector('th');
    const number=heading.querySelector('span').textContent.trim().replace(/\.$/,'');
    const title=heading.textContent.trim().slice(number.length).replace(/^\.\s*/,'').trim();
    if(row.classList.contains('gantt-category')){
      area={id:number,title,style:row.getAttribute('style'),tasks:[]};defaults.push(area);
    }else if(row.classList.contains('gantt-workstream')){
      task={id:number,title,subtasks:[]};area.tasks.push(task);
    }else{
      const index=Number(number.split('.')[2])-1;
      const boundaries=window.ganttDefaultBoundaries[task.id];
      const shift=task.id.startsWith('13.')?afterEvent:0;
      task.subtasks.push({id:number,title,start:dateAt(boundaries[index]+shift),end:dateAt(boundaries[index+1]-1+shift)});
    }
  });
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&iso(new Date(value+'T12:00:00Z'))===value;}
  function validPlan(plan){return Array.isArray(plan)&&plan.length===13&&plan.every(a=>typeof a.title==='string'&&Array.isArray(a.tasks)&&a.tasks.every(t=>typeof t.title==='string'&&Array.isArray(t.subtasks)&&t.subtasks.every(s=>typeof s.title==='string'&&s.title.trim()&&validDate(s.start)&&validDate(s.end)&&s.start<=s.end)));}
  let project=defaults;
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(validPlan(saved))project=saved;}catch{}
  let editing=false;
  const chart=document.querySelector('#gantt-view');
  let savedProject;
  function renderProject(){
    tbody.replaceChildren();let count=0,steps=0;
    project.forEach((a,ai)=>{
      function row(type,number,title,subtask,key){
        const tr=document.createElement('tr');tr.className=type;tr.dataset.key=key;tr.setAttribute('style',defaults[ai].style);
        const th=document.createElement('th');th.scope='row';if(type==='gantt-category')th.className='gantt-category-name';
        const span=document.createElement('span');span.className=type==='gantt-category'?'gantt-category-number':'gantt-outline-number';span.textContent=number;
        th.append(span,document.createTextNode(' '+title));tr.append(th,document.createElement('td'));
        if(subtask){tr.dataset.startDate=subtask.start;tr.dataset.endDate=subtask.end;tr.dataset.taskId=subtask.id;}
        tbody.append(tr);
      }
      row('gantt-category',`${ai+1}.`,a.title,null,'area-'+a.id);
      a.tasks.forEach((t,ti)=>{
        count++;row('gantt-workstream',`${ai+1}.${ti+1}`,t.title,null,'task-'+t.id);
        t.subtasks.forEach((s,si)=>{steps++;row('gantt-subtask',`${ai+1}.${ti+1}.${si+1}`,s.title,s,'step-'+s.id);});
      });
    });
    document.querySelector('.gantt-heading .eyebrow').textContent=`13 AREAS · ${count} TASKS · ${steps} SUBTASKS`;
  }
  renderProject();

  const editButton=document.createElement('button');editButton.type='button';editButton.className='button primary';editButton.id='gantt-edit';editButton.textContent='Edit plan';document.querySelector('.gantt-heading').append(editButton);
  const toolbar=document.createElement('div');toolbar.className='gantt-inline-toolbar';toolbar.hidden=true;
  toolbar.innerHTML='<div><strong>Editing plan</strong><span>Change names and dates in the chart. Drag the dotted handles to reorder rows; add steps beside each task.</span></div><button type="button" class="button secondary" id="inline-cancel">Cancel</button><button type="button" class="button primary" id="inline-save">Save changes</button><p id="inline-error" role="alert"></p>';
  document.querySelector('.gantt-controls').after(toolbar);
  function refresh(){
    const scroller=chart.querySelector('.gantt-scroll');
    const top=scroller.scrollTop,left=scroller.scrollLeft;
    renderProject();window.initialiseGanttOutline();window.initialiseGanttTimeline();
    if(editing)decorate();
    scroller.scrollTop=top;scroller.scrollLeft=left;
  }
  function action(container,text,label,callback,disabled=false){
    const button=document.createElement('button');button.type='button';button.className='gantt-row-action';button.textContent=text;button.setAttribute('aria-label',label);button.title=label;button.disabled=disabled;button.onclick=callback;container.append(button);return button;
  }
  function message(text){toolbar.querySelector('#inline-error').textContent=text;}
  function move(list,index,delta){const next=index+delta;if(next<0||next>=list.length)return;[list[index],list[next]]=[list[next],list[index]];refresh();}
  function dragHandle(row,item,list,label) {
    const handle=document.createElement('button');handle.type='button';handle.className='gantt-drag-handle';handle.textContent='⠿';
    handle.setAttribute('aria-label','Reorder '+label);handle.title='Drag to reorder. Or focus and use ↑ / ↓.';
    row.querySelector('.gantt-label-preview').prepend(handle);
    handle.onkeydown=event=>{
      if(!['ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();const index=list.indexOf(item),delta=event.key==='ArrowUp'?-1:1;
      if(index+delta<0||index+delta>=list.length)return;
      move(list,index,delta);
      const next=chart.querySelector(`[data-key="${row.dataset.key}"] .gantt-drag-handle`);next?.focus({preventScroll:true});
      message('Row moved. Save changes to keep the new order.');
    };
    handle.onpointerdown=event=>{
      if(event.button!==0)return;
      event.preventDefault();handle.setPointerCapture(event.pointerId);
      const startX=event.clientX,startY=event.clientY;
      let target=null,after=false,dragging=false;
      function clear(){chart.querySelectorAll('.gantt-drop-before,.gantt-drop-after').forEach(r=>r.classList.remove('gantt-drop-before','gantt-drop-after'));}
      handle.onpointermove=moveEvent=>{
        if(!dragging&&Math.hypot(moveEvent.clientX-startX,moveEvent.clientY-startY)<5)return;
        dragging=true;row.classList.add('gantt-dragging');chart.classList.add('gantt-is-dragging');
        const scroller=chart.querySelector('.gantt-scroll'),bounds=scroller.getBoundingClientRect();
        if(moveEvent.clientY<bounds.top+48)scroller.scrollTop-=14;
        else if(moveEvent.clientY>bounds.bottom-32)scroller.scrollTop+=14;
        clear();target=null;
        const candidate=document.elementFromPoint(moveEvent.clientX,moveEvent.clientY)?.closest('tbody tr');
        if(!candidate||candidate===row)return;
        const isTask=row.classList.contains('gantt-workstream');
        // A task may be dropped on one of a sibling task's subtask rows.
        let sibling=candidate;
        if(isTask&&candidate.classList.contains('gantt-subtask')){
          while(sibling&&!sibling.classList.contains('gantt-workstream'))sibling=sibling.previousElementSibling;
        }
        const prefix=isTask?'task-':'step-';
        const candidateItem=list.find(entry=>prefix+entry.id===sibling?.dataset.key);
        if(!candidateItem||candidateItem===item)return;
        target=candidateItem;
        const rect=sibling.getBoundingClientRect();after=moveEvent.clientY>rect.top+rect.height/2;
        sibling.classList.add(after?'gantt-drop-after':'gantt-drop-before');
      };
      function finish(cancelled){
        clear();row.classList.remove('gantt-dragging');chart.classList.remove('gantt-is-dragging');
        handle.onpointermove=null;handle.onpointerup=null;handle.onpointercancel=null;
        if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
        if(!cancelled&&target){
          list.splice(list.indexOf(item),1);const destination=list.indexOf(target)+(after?1:0);list.splice(destination,0,item);
          refresh();message('Row moved. Save changes to keep the new order.');
        }
      }
      handle.onpointerup=()=>finish(false);handle.onpointercancel=()=>finish(true);
    };
  }
  function decorate(){
    chart.querySelector('thead th:nth-child(2)').textContent='Owner';
    project.forEach((area,ai)=>area.tasks.forEach((task,ti)=>{
      function setup(row,item,label){
        const preview=row.querySelector('.gantt-label-preview');
        Array.from(preview.childNodes).filter(node=>node.nodeType===3).forEach(node=>node.remove());
        const input=document.createElement('input');input.type='text';input.className='gantt-inline-name';input.value=item.title;input.maxLength=160;input.setAttribute('aria-label',label+' name');
        input.oninput=()=>{item.title=input.value;input.setCustomValidity(input.value.trim()?'':'Enter a name.');};preview.append(input);
        const controls=document.createElement('div');controls.className='gantt-row-actions';preview.append(controls);return controls;
      }
      const row=chart.querySelector(`[data-key="task-${task.id}"]`);
      const label=`Task ${ai+1}.${ti+1}`;
      const controls=setup(row,task,label);
      dragHandle(row,task,area.tasks,label);
      action(controls,'+',`Add subtask to ${label}`,()=>{
        const last=task.subtasks.at(-1);const date=last?.end||state.event.startDate;
        const step={id:crypto.randomUUID(),title:'New subtask',start:date,end:date};task.subtasks.push(step);
        window.ganttOutlineState['task-'+task.id]=true;refresh();
        const field=chart.querySelector(`[data-key="step-${step.id}"] .gantt-inline-name`);field.focus();field.select();
      });
      task.subtasks.forEach((step,si)=>{
        const row=chart.querySelector(`[data-key="step-${step.id}"]`);
        const label=`Subtask ${ai+1}.${ti+1}.${si+1}`;
        const controls=setup(row,step,label);
        dragHandle(row,step,task.subtasks,label);
        let confirmed=false;
        const remove=action(controls,'×',`Remove ${label}`,()=>{
          if(!confirmed){confirmed=true;remove.classList.add('gantt-remove-confirm');remove.title='Click again to confirm removal';remove.setAttribute('aria-label',`Confirm remove ${label}`);return;}
          task.subtasks.splice(si,1);refresh();
        });
        remove.classList.add('gantt-remove-action');
        const cell=row.querySelector('.gantt-date-cell');const dates=document.createElement('div');dates.className='gantt-inline-dates';cell.append(dates);
        ['start','end'].forEach(kind=>{
          const input=document.createElement('input');input.type='date';input.value=step[kind];input.setAttribute('aria-label',label+' '+kind+' date');dates.append(input);
          input.onchange=()=>{
            const start=kind==='start'?input.value:step.start,end=kind==='end'?input.value:step.end;
            if(!validDate(start)||!validDate(end)||start>end){input.setCustomValidity('End date must be on or after start date.');input.setAttribute('aria-invalid','true');message(label+': enter valid dates, with end on or after start.');return;}
            input.setCustomValidity('');input.removeAttribute('aria-invalid');step.start=start;step.end=end;message('');refresh();
          };
        });
      });
    }));
  }
  function invalid(){return Array.from(chart.querySelectorAll('input')).some(input=>!input.checkValidity())||!validPlan(project)||project.some(a=>a.tasks.some(t=>!t.title.trim()));}
  editButton.onclick=()=>{
    savedProject=JSON.parse(JSON.stringify(project));editing=true;chart.classList.add('gantt-editing');toolbar.hidden=false;editButton.hidden=true;message('');refresh();
  };
  toolbar.querySelector('#inline-cancel').onclick=()=>{
    project=savedProject;editing=false;chart.classList.remove('gantt-editing');toolbar.hidden=true;editButton.hidden=false;refresh();
  };
  toolbar.querySelector('#inline-save').onclick=()=>{
    if(invalid()){message('Correct empty names or invalid date ranges before saving.');return;}
    try{localStorage.setItem(KEY,JSON.stringify(project));}catch{message('Could not save: browser storage is unavailable or full.');return;}
    editing=false;chart.classList.remove('gantt-editing');toolbar.hidden=true;editButton.hidden=false;refresh();
  };
  window.addEventListener('beforeunload',event=>{if(editing&&JSON.stringify(project)!==JSON.stringify(savedProject)){event.preventDefault();event.returnValue='';}});
})();
