// Browser-local Gantt project and committed schedule shared with Overview.
(function () {
  const KEY='festival-gantt-project-v1';
  const DAY=86400000;
  const iso=date=>date.toISOString().slice(0,10);
  const dateMillis=value=>new Date(value+'T12:00:00Z').getTime();
  const shiftDate=(value,days)=>iso(new Date(dateMillis(value)+days*DAY));
  const dayDifference=(from,to)=>Math.round((dateMillis(to)-dateMillis(from))/DAY);
  const cloneProject=value=>JSON.parse(JSON.stringify(value));
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
      task.subtasks.push({id:number,title,start:boundaries[index],end:boundaries[index+1]-1});
    }
  });
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&iso(new Date(value+'T12:00:00Z'))===value;}
  function validPlan(plan){return Array.isArray(plan)&&plan.length===13&&plan.every(a=>typeof a.title==='string'&&Array.isArray(a.tasks)&&a.tasks.every(t=>typeof t.title==='string'&&Array.isArray(t.subtasks)&&t.subtasks.every(s=>typeof s.title==='string'&&s.title.trim()&&validDate(s.start)&&validDate(s.end)&&s.start<=s.end)));}
  function defaultProject() {
    const current = cloneProject(defaults);
    current.forEach(area => {
      const anchor = area.id === '13' ? shiftDate(state.event.endDate, 1) : state.event.startDate;
      area.tasks.forEach(task => task.subtasks.forEach(step => {
        step.start = shiftDate(anchor, step.start);
        step.end = shiftDate(anchor, step.end);
      }));
    });
    return current;
  }

  function shiftProject(plan, previousStart, previousEnd) {
    const startShift = dayDifference(previousStart, state.event.startDate);
    const endShift = previousEnd ? dayDifference(previousEnd, state.event.endDate) : startShift;
    const next = cloneProject(plan);
    next.forEach(area => {
      const shift = area.id === '13' ? endShift : startShift;
      if (!shift) return;
      area.tasks.forEach(task => task.subtasks.forEach(step => {
        step.start = shiftDate(step.start, shift);
        step.end = shiftDate(step.end, shift);
      }));
    });
    return next;
  }

  const anchorKey = 'festival-gantt-date-anchor';
  const endAnchorKey = 'festival-gantt-end-date-anchor';
  let project = defaultProject();
  let customPlan = false;
  let eventStart = state.event.startDate;
  let eventEnd = state.event.endDate;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (validPlan(saved)) {
      const storedStart = localStorage.getItem(anchorKey);
      const storedEnd = localStorage.getItem(endAnchorKey);
      project = shiftProject(saved, validDate(storedStart) ? storedStart : '2026-10-15', validDate(storedEnd) ? storedEnd : null);
      customPlan = true;
    }
  } catch {}
  let editing = false;
  const chart = document.querySelector('#gantt-view');
  let savedProject;

  window.getSavedGanttPlan = () => cloneProject(editing ? savedProject : project);
  const publishProject = () => window.dispatchEvent(new Event('gantt-project-changed'));
  window.refreshGanttFestivalDates = () => {
    if (eventStart === state.event.startDate && eventEnd === state.event.endDate) return;
    const committed = editing ? savedProject : project;
    const next = customPlan ? shiftProject(committed, eventStart, eventEnd) : defaultProject();
    if (customPlan) {
      try { persistProject(next); }
      catch { toast('The updated timeline dates could not be saved in this browser.'); }
    }
    if (editing) {
      project = shiftProject(project, eventStart, eventEnd);
      savedProject = next;
    } else {
      project = next;
    }
    eventStart = state.event.startDate;
    eventEnd = state.event.endDate;
    refresh();
    publishProject();
  };
  function persistProject(plan) {
    localStorage.setItem(KEY, JSON.stringify(plan));
    localStorage.setItem(anchorKey, state.event.startDate);
    localStorage.setItem(endAnchorKey, state.event.endDate);
    customPlan = true;
  }

  window.addBoardSubtask = ({areaId, taskId, parentName, title, start, end}) => {
    if (!canFestival('lineup')) throw new Error('Your role cannot add tasks.');
    if (editing) throw new Error('Save or cancel your timeline edits before adding a task here.');
    if (!title.trim() || !validDate(start) || !validDate(end) || start > end) {
      throw new Error('Enter a task name and valid dates. The end date must be on or after the start date.');
    }
    const next = structuredClone(project);
    const area = next.find(entry => String(entry.id) === areaId);
    if (!area) throw new Error('Choose a work area.');
    let task = area.tasks.find(entry => String(entry.id) === taskId);
    if (!taskId) {
      if (!parentName.trim()) throw new Error('Enter a name for the new parent task.');
      task = {id:crypto.randomUUID(),title:parentName.trim(),subtasks:[]};
      area.tasks.push(task);
    }
    if (!task) throw new Error('Choose a parent task.');
    const step = {id:crypto.randomUUID(),title:title.trim(),start,end};
    task.subtasks.push(step);
    try { persistProject(next); }
    catch { throw new Error('Could not save the task in this browser.'); }
    project = next;
    window.ganttOutlineState['area-'+area.id] = true;
    window.ganttOutlineState['task-'+task.id] = true;
    refresh();
    publishProject();
    return step.id;
  };
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
    renderOwners();
  }

  let draftAssignments = null;
  function renderOwners(){
    const assignments=window.taskAssignments;
    const team=assignments.people();
    const canAssign=editing&&assignments.canAssign();
    const current=editing&&draftAssignments?draftAssignments:assignments.read();
    project.forEach(area=>area.tasks.forEach(task=>{
      const taskId=String(task.id);
      const cell=tbody.querySelector(`[data-key="task-${CSS.escape(taskId)}"]`)?.children[1];
      if(cell){cell.className='gantt-owner';cell.replaceChildren();}
      task.subtasks.forEach(step=>{
        const stepCell=tbody.querySelector(`[data-key="step-${CSS.escape(String(step.id))}"]`)?.children[1];
        if(!stepCell)return;
        const {userId}=assigneeOf({id:String(step.id),taskId},current,team);
        stepCell.className='gantt-owner';stepCell.replaceChildren();
        const name=document.createElement('span');name.className='gantt-owner-name';
        name.textContent=userId?assignments.nameOf(userId,team):'Nobody';stepCell.append(name);
        if(canAssign){
          const choice=document.createElement('select');choice.className='gantt-owner-select';
          choice.setAttribute('aria-label','Owner of subtask '+step.title);
          choice.add(new Option('Nobody',''));
          team.forEach(person=>choice.add(new Option(assignments.nameOf(person.userId,team),person.userId)));
          choice.value=userId||'';
          choice.onchange=()=>{
            draftAssignments.steps[String(step.id)]=choice.value||'';
            name.textContent=choice.value?assignments.nameOf(choice.value,team):'Nobody';
            updateEditState();
          };
          stepCell.append(choice);
        }
      });
    }));
  }
  window.addEventListener('task-assignments-changed',renderOwners);
  renderProject();

  const editButton=document.createElement('button');editButton.type='button';editButton.className='button primary';editButton.id='gantt-edit';editButton.textContent='Edit plan';editButton.hidden=!canFestival('lineup');document.querySelector('.gantt-controls').append(editButton);
  const toolbar=document.createElement('div');toolbar.className='gantt-inline-toolbar';toolbar.hidden=true;
  toolbar.innerHTML='<span id="inline-dirty" role="status">No unsaved changes</span><button type="button" class="button secondary" id="inline-cancel">Cancel</button><button type="button" class="button primary" id="inline-save">Save changes</button><p id="inline-error" role="alert"></p>';
  document.querySelector('.gantt-controls').append(toolbar);
  let selectedRowKey = null;
  let originalAssignments = null;
  function updateEditState() {
    if (!editing) return;
    toolbar.querySelector('#inline-dirty').textContent = JSON.stringify(project) === JSON.stringify(savedProject) && JSON.stringify(draftAssignments) === JSON.stringify(originalAssignments) ? 'No unsaved changes' : 'Unsaved changes';
    chart.querySelectorAll('tbody tr').forEach(row => row.classList.toggle('gantt-selected-row', row.dataset.key === selectedRowKey));
  }
  function selectEditRow(event) {
    if (!editing) return;
    const row = event.target.closest('tbody tr');
    if (!row) return;
    selectedRowKey = row.dataset.key;
    updateEditState();
  }
  chart.addEventListener('click', selectEditRow);
  chart.addEventListener('focusin', selectEditRow);
  chart.addEventListener('input', () => {
    const row = chart.querySelector('.gantt-selected-row');
    const label = row?.querySelector('.gantt-edit-readonly-name');
    if (label) label.textContent = row.querySelector('.gantt-inline-name').value;
    updateEditState();
  });
  function refresh(){
    const scroller=chart.querySelector('.gantt-scroll');
    const top=scroller.scrollTop,left=scroller.scrollLeft;
    renderProject();window.initialiseGanttOutline();window.initialiseGanttTimeline();
    if(editing){decorate();updateEditState();}
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
    project.forEach((area,ai)=>{
      const preview=chart.querySelector(`[data-key="area-${area.id}"] .gantt-label-preview`);
      action(preview,'+ Add task group',`Add task group to area ${ai+1}`,()=>{
        const task={id:crypto.randomUUID(),title:'New task',subtasks:[{id:crypto.randomUUID(),title:'',start:'',end:''}]};
        area.tasks.push(task);
        window.ganttOutlineState['area-'+area.id]=true;
        window.ganttOutlineState['task-'+task.id]=true;
        selectedRowKey='task-'+task.id;refresh();
        const field=chart.querySelector(`[data-key="task-${task.id}"] .gantt-inline-name`);
        field.focus();field.select();
      }).classList.add('gantt-add-task');
    });
    project.forEach((area,ai)=>area.tasks.forEach((task,ti)=>{
      function setup(row,item,label){
        const preview=row.querySelector('.gantt-label-preview');
        Array.from(preview.childNodes).filter(node=>node.nodeType===3).forEach(node=>node.remove());
        const input=document.createElement('input');input.type='text';input.className='gantt-inline-name';input.value=item.title;input.required=true;input.placeholder='Enter a name';input.maxLength=160;input.setAttribute('aria-label',label+' name');
        const text=document.createElement('span');text.className='gantt-edit-readonly-name';text.textContent=item.title;preview.append(text);
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
        window.ganttOutlineState['task-'+task.id]=true;selectedRowKey='step-'+step.id;refresh();
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
        },task.subtasks.length===1);
        if(remove.disabled)remove.title='A task needs at least one subtask';
        remove.classList.add('gantt-remove-action');
        const cell=row.querySelector('.gantt-date-cell');const dates=document.createElement('div');dates.className='gantt-inline-dates';cell.append(dates);
        ['start','end'].forEach(kind=>{
          const input=document.createElement('input');input.type='date';input.value=step[kind];input.setAttribute('aria-label',label+' '+kind+' date');dates.append(input);
          input.required=true;
          input.oninput=()=>{step[kind]=input.value;};
          input.onchange=()=>{
            if(validDate(step.start)&&validDate(step.end)&&step.start<=step.end){
              row.dataset.startDate=step.start;row.dataset.endDate=step.end;
              window.initialiseGanttTimeline();
            }
          };
        });
      });
    }));
  }
  // Use the visible calendar columns so dragging works in both week and day views.
  function timelineOffset(clientX) {
    const cells=Array.from(chart.querySelectorAll('thead [data-start]'));
    const cell=cells.find(item=>clientX>=item.getBoundingClientRect().left&&clientX<=item.getBoundingClientRect().right)
      || (clientX<cells[0].getBoundingClientRect().left?cells[0]:cells.at(-1));
    const rect=cell.getBoundingClientRect();
    return Number(cell.dataset.start)+(clientX-rect.left)/rect.width*(Number(cell.dataset.end)-Number(cell.dataset.start)+1);
  }
  chart.addEventListener('pointerdown',event=>{
    const target=event.target.closest('[data-bar-action]');
    if(!editing||!canFestival('lineup')||!target||event.button!==0)return;
    const row=target.closest('tr');
    const step=project.flatMap(area=>area.tasks.flatMap(task=>task.subtasks)).find(item=>'step-'+item.id===row.dataset.key);
    if(!step)return;
    event.preventDefault();
    selectedRowKey=row.dataset.key;updateEditState();
    const original={start:step.start,end:step.end};
    const origin=timelineOffset(event.clientX);
    const action=target.dataset.barAction;
    chart.setPointerCapture(event.pointerId);
    function shift(date,days){return iso(new Date(Date.parse(date+'T12:00:00Z')+days*DAY));}
    function move(moveEvent){
      const delta=Math.round(timelineOffset(moveEvent.clientX)-origin);
      const start=action==='end'?original.start:shift(original.start,delta);
      const end=action==='start'?original.end:shift(original.end,delta);
      if(start>end)return;
      step.start=start;step.end=end;
      row.dataset.startDate=start;row.dataset.endDate=end;
      window.initialiseGanttTimeline();
      updateEditState();

    }
    function finish(cancelled){
      chart.removeEventListener('pointermove',move);
      chart.removeEventListener('pointerup',up);
      chart.removeEventListener('pointercancel',cancel);
      if(chart.hasPointerCapture(event.pointerId))chart.releasePointerCapture(event.pointerId);
      if(cancelled){step.start=original.start;step.end=original.end;}
      const changed = !cancelled && (step.start !== original.start || step.end !== original.end);
      refresh();message(changed ? 'Dates updated. Save changes to keep them.' : '');
    }
    const up=()=>finish(false),cancel=()=>finish(true);
    chart.addEventListener('pointermove',move);
    chart.addEventListener('pointerup',up);
    chart.addEventListener('pointercancel',cancel);
  });
  function invalid(){return Array.from(chart.querySelectorAll('input')).some(input=>!input.checkValidity())||!validPlan(project)||project.some(a=>a.tasks.some(t=>!t.title.trim()||!t.subtasks.length));}
  editButton.onclick=()=>{
    if (editing || !canFestival('lineup')) return;
    selectedRowKey=null;savedProject=cloneProject(project);
    draftAssignments=JSON.parse(JSON.stringify(window.taskAssignments.read()));
    // Preserve effective owners from older group assignments as explicit subtask owners.
    project.forEach(area=>area.tasks.forEach(task=>task.subtasks.forEach(step=>{
      draftAssignments.steps[String(step.id)]=assigneeOf({id:String(step.id),taskId:String(task.id)},draftAssignments,window.taskAssignments.people()).userId||'';
    })));
    draftAssignments.groups={};originalAssignments=JSON.parse(JSON.stringify(draftAssignments));editing=true;chart.classList.add('gantt-editing');toolbar.hidden=false;editButton.hidden=true;message('');refresh();
  };
  toolbar.querySelector('#inline-cancel').onclick=()=>{
    if (!editing) return;
    project=savedProject;editing=false;chart.classList.remove('gantt-editing');toolbar.hidden=true;editButton.hidden=false;refresh();
  };
  toolbar.querySelector('#inline-save').onclick=()=>{
    if (!editing || !canFestival('lineup')) return;
    if(invalid()){message('Each task needs at least one subtask. Enter all names and both dates, with the end on or after the start.');return;}
    try{persistProject(project);if(window.taskAssignments.canAssign()&&JSON.stringify(draftAssignments)!==JSON.stringify(originalAssignments))window.taskAssignments.saveSubtaskOwners(draftAssignments);}catch{message('Could not save: browser storage is unavailable or full.');return;}
    editing=false;chart.classList.remove('gantt-editing');toolbar.hidden=true;editButton.hidden=false;refresh();
    publishProject();
  };
  window.addEventListener('beforeunload',event=>{if(editing&&(JSON.stringify(project)!==JSON.stringify(savedProject)||JSON.stringify(draftAssignments)!==JSON.stringify(originalAssignments))){event.preventDefault();event.returnValue='';}});
})();
