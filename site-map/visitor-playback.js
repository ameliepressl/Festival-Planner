// Read-only map playback. Disposing the panel releases the animation, observers and canvas.
const VisitorPlayback = (() => {
  function dayFor(plan, date) {
    const hours = dayHours(date, plan.event);
    const shows = plan.bookings.filter(b => b.date === date && isPerformance(b)).map(b => {
      const start = b.start < hours.start && hours.end > 1440 ? b.start + 1440 : b.start;
      return { start, end: start + entryDuration(b, plan), stage: 'stage-' + b.stage.toLowerCase(),
        label: entryName(b, plan) + ' · ' + stageName(b.stage, plan) };
    }).sort((a, b) => a.start - b.start);
    return { ...hours, shows };
  }

  function mount(view, site, visitors, stages, plan, getBox) {
    const panel = view.querySelector('#sm-simulation'), canvas = view.querySelector('#sm-visitors-canvas');
    const frame = view.querySelector('.sm-frame');
    const ctx = canvas.getContext('2d');
    const controls = panel.querySelector('.sm-sim-body');
    const select = key => controls.querySelector('[data-sim="' + key + '"]');
    const dates = eventDays(plan.event);
    controls.innerHTML = `
      <div class="sm-sim-controls">
        <label>Festival day <select data-sim="day"></select></label>
        <button class="button primary" type="button" data-sim="play">Play</button>
        <button class="button secondary" type="button" data-sim="restart" aria-label="Restart playback" title="Restart playback">↺</button>
        <label>Speed <select data-sim="speed"><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
        <label class="sm-sim-heat"><input type="checkbox" data-sim="heat" checked> Density heatmap</label>
        <button class="button secondary" type="button" data-sim="evacuate">Simulate evacuation</button>
      </div>
      <div class="sm-sim-clock"><output data-sim="clock"></output><input type="range" data-sim="time" aria-label="Simulation time" step="any"><span data-sim="count"></span></div>
      <p class="sm-sim-bill" data-sim="bill"></p>
      <div class="sm-sim-key"><span>One dot per visitor</span><span data-sim="legend"><i aria-hidden="true"></i> Low to high density</span><span data-sim="pace"></span></div>
      <p class="sm-sim-note" data-sim="note" role="status"></p>`;
    const day = select('day'), play = select('play'), speed = select('speed'), heat = select('heat');
    const restart = select('restart');
    const evacuate = select('evacuate'), clock = select('clock'), time = select('time'), count = select('count');
    const bill = select('bill'), note = select('note'), legend = select('legend'), pace = select('pace');
    for (const date of dates) day.add(new Option(dateText(date), date));
    const heatCanvas = document.createElement('canvas'), heatContext = heatCanvas.getContext('2d');
    const extent = Math.max(site.width, site.height);
    heatCanvas.width = Math.max(1, Math.ceil(site.width / extent * 96));
    heatCanvas.height = Math.max(1, Math.ceil(site.height / extent * 96));
    const cells = new Uint32Array(heatCanvas.width * heatCanvas.height);
    const heatImage = heatContext.createImageData(heatCanvas.width, heatCanvas.height);
    const positions = new Float32Array(visitors * 2);
    const area = (site.widthMetres / heatCanvas.width) * (site.height * site.widthMetres / site.width / heatCanvas.height);
    const number = new Intl.NumberFormat('en-GB');
    let model, drill, minute, snapshot, running = false, raf = 0, previous = null;
    let width = 0, height = 0, ratio = 1;
    let lastBillMinute = null;
    const end = () => drill ? drill.end : model.day.end;
    const start = () => drill ? 0 : model.day.start;
    const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };
    function pause() {
      cancelAnimationFrame(raf); running = false; previous = null;
      play.textContent = model && !model.problem && minute >= end() ? 'Replay' : 'Play';
    }
    function paint() {
      if (!model || model.problem || !width || !height) return;
      const box = getBox(), scale = Math.min(width / box.w, height / box.h);
      const left = (width - box.w * scale) / 2 - box.x * scale, top = (height - box.h * scale) / 2 - box.y * scale;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      let used = 0;
      const showHeat = heat.checked;
      cells.fill(0);
      const motionTime = drill ? snapshot + minute : minute;
      const inside = VisitorSimulation.frame(model, minute, drill, (first, last, at) => {
        // Gently shift each dot within its walkable disc, even while an audience watches a set.
        const sway = Math.min(at.r * 0.04, 0.7 / model.unit) * (1 + Math.sin(motionTime + last)) * 0.5;
        for (let i = first; i < last; i++) {
          const other = ((i + 1) % visitors) * 2;
          const x = at.x + (at.r - sway) * model.offsets[i * 2] + sway * model.offsets[other];
          const y = at.y + (at.r - sway) * model.offsets[i * 2 + 1] + sway * model.offsets[other + 1];
          positions[used++] = x * scale + left; positions[used++] = y * scale + top;
          if (showHeat) {
            const col = Math.min(heatCanvas.width - 1, Math.max(0, Math.floor(x / site.width * heatCanvas.width)));
            const row = Math.min(heatCanvas.height - 1, Math.max(0, Math.floor(y / site.height * heatCanvas.height)));
            cells[row * heatCanvas.width + col]++;
          }
        }
      });
      ctx.fillStyle = drill ? '#fff3cb' : '#ecfffa';
      ctx.globalAlpha = showHeat ? 0.6 : 0.85;
      const dot = Math.min(3.5, Math.max(0.7, scale / model.unit * 0.5));
      for (let i = 0; i < used; i += 2) ctx.fillRect(positions[i] - dot / 2, positions[i + 1] - dot / 2, dot, dot);
      ctx.globalAlpha = 1;
      if (showHeat) {
        const peak = model.safety.densityLimit > 0 ? model.safety.densityLimit : Math.max(1, cells.reduce((a,b) => Math.max(a,b), 0)) / area;
        for (let i = 0; i < cells.length; i++) {
          const value = Math.min(1, cells[i] / area / peak);
          const low = value <= 0.5, t = low ? value * 2 : value * 2 - 1;
          const p = i * 4;
          heatImage.data[p] = low ? 56 + 198 * t : 254 - 7 * t;
          heatImage.data[p + 1] = low ? 189 + 14 * t : 203 - 126 * t;
          heatImage.data[p + 2] = low ? 173 - 100 * t : 73 - 7 * t;
          heatImage.data[p + 3] = cells[i] ? 85 + 135 * value : 0;
        }
        heatContext.putImageData(heatImage, 0, 0);
        ctx.drawImage(heatCanvas, left, top, site.width * scale, site.height * scale);
      }
      const label = drill ? '+' + minute.toFixed(1) + ' min' : timeText(Math.floor(minute) % 1440) + (minute >= 1440 ? ' (+1d)' : '');
      setText(clock, label); time.value = minute; time.setAttribute('aria-valuetext', label);
      setText(count, number.format(inside) + ' on site');
      if (!drill) {
        evacuate.disabled = !inside;
        if (lastBillMinute !== Math.floor(minute)) {
          const live = model.day.shows.filter(show => show.start <= minute && minute < show.end);
          setText(bill, live.length ? live.map(show => show.label).join('  /  ') : model.day.shows.length ? 'Between performances' : 'No performances scheduled for this day');
          lastBillMinute = Math.floor(minute);
        }
      } else {
        setText(bill, minute < drill.delay && minute < end() ? 'Response delay' : number.format(drill.count - inside) + ' exited' +
          (drill.stranded ? ' · ' + number.format(drill.stranded) + ' without a walkable exit route' : '') +
          (minute >= end() && drill.unmeasured ? ' · ' + number.format(drill.unmeasured) + ' waiting at unmeasured exits' : ''));
      }
    }
    function resize() {
      width = canvas.clientWidth; height = canvas.clientHeight;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      paint();
    }
    function tick(now) {
      if (!running) return;
      if (document.hidden || !panel.getClientRects().length) { pause(); return; }
      if (previous === null) previous = now;
      if (now - previous >= 32) {
        const minutesPerSecond = drill ? 0.25 : 4;
        minute = Math.min(end(), minute + (now - previous) / 1000 * minutesPerSecond * Number(speed.value));
        previous = now; paint();
        if (minute >= end()) { pause(); return; }
      }
      raf = requestAnimationFrame(tick);
    }
    function resume() {
      if (minute >= end()) minute = start();
      running = true; play.textContent = 'Pause'; previous = null; paint();
      raf = requestAnimationFrame(tick);
    }
    function configure() {
      time.min = start(); time.max = end(); time.disabled = end() <= start();
      play.disabled = restart.disabled = time.disabled;
      evacuate.disabled = false;
      evacuate.textContent = drill ? 'Return to festival' : 'Simulate evacuation';
      pace.textContent = drill ? '1 s = 15 simulation seconds at 1×' : '1 s = 4 festival minutes at 1×';
      legend.lastChild.textContent = model.safety.densityLimit > 0 ? ' Low → ' + model.safety.densityLimit + '+ people/m²' : ' Relative density';
      setText(note, drill ? (drill.estimate.valid ? 'Peak-scenario planning estimate: ' + drill.estimate.minutes.toFixed(1) + ' min.' :
        'Peak-scenario estimate unavailable. ' + drill.estimate.detail) +
        (drill.unmeasured ? ' Visitors wait at unmeasured exits.' : '') :
        'Arrivals are staggered. Entered stage audiences guide attendance.' + (model.missing ? ' ' + model.missing + ' scheduled set(s) have no reachable mapped stage.' : ''));
      lastBillMinute = null; paint();
    }
    function loadDay() {
      pause(); drill = null;
      model = VisitorSimulation.build(site, visitors, stages, dayFor(plan, day.value));
      if (model.problem) {
        note.textContent = model.problem; clock.textContent = ''; count.textContent = ''; bill.textContent = '';
        play.disabled = time.disabled = restart.disabled = evacuate.disabled = true; ctx.clearRect(0, 0, canvas.width, canvas.height); return;
      }
      // Open on an occupied map; the slider also covers doors opening and the first arrivals.
      minute = Math.min(model.day.end, Math.max(model.day.start + Math.min(20, (model.day.end - model.day.start) / 2),
        model.day.shows[0]?.start ?? model.day.start));
      configure(); play.textContent = 'Play';
    }
    day.onchange = loadDay;
    play.onclick = () => running ? pause() : resume();
    restart.onclick = () => { minute = start(); pause(); paint(); };
    time.oninput = () => { minute = Number(time.value); pause(); paint(); };
    heat.onchange = () => { legend.hidden = !heat.checked; paint(); };
    evacuate.onclick = () => {
      pause();
      if (drill) { drill = null; minute = snapshot; configure(); play.textContent = 'Play'; return; }
      const next = VisitorSimulation.evacuation(model, minute);
      if (next.problem) { note.textContent = next.problem; return; }
      snapshot = minute; drill = next; minute = 0; configure();
      if (drill.end > 0) resume();
    };
    const onVisibility = () => { if (document.hidden) pause(); };
    canvas.hidden = false; frame.classList.add('sm-simulating');
    loadDay(); resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);
    return { paint, close() {
      pause(); observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility);
      frame.classList.remove('sm-simulating'); canvas.hidden = true;
      canvas.width = 0; canvas.height = 0; controls.replaceChildren();
      panel.open = false;
    } };
  }
  return { mount, dayFor };
})();
