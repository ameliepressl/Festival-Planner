// Festival Architect — the Financial overview page: profit and loss, break-even, where the money goes and
// comes from, profit by ticket price, scenarios and the artist spending.
// It only READS the other pages' data (lineup, vendors, festival size) and never changes it.
// All calculations live in rules/finance-rules.js; the assumptions are saved in this browser.

(function () {
  const view = document.querySelector('#finance-view');
  const PROFIT = '#1a9a7c'; // revenue and profit (validated colour pair, also readable with colour blindness)
  const COST = '#e0563b';   // costs and losses
  let settings = parseFinance(read(FINANCE_STORAGE_KEY));

  function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function save() { try { localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(settings)); } catch { /* still works without saving */ } }
  const money = (n) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const short = (n) => (Math.abs(n) >= 1000 ? `${n < 0 ? '−' : ''}€${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1)}k` : money(n));
  const number = (n) => n.toLocaleString('en-GB');
  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayName = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  // Everything the model needs, collected fresh from the other pages each time the page is shown.
  function collect() {
    const lineup = typeof state !== 'undefined'
      ? { bookings: state.bookings, artists: state.artists, budget: state.settings.budget, stages: state.settings.stages, days: days().length }
      : { bookings: [], artists: [], budget: 0, stages: 2, days: 1 };
    const visitors = parseGround(read(GROUND_STORAGE_KEY)).visitors;
    const vendors = parsePlacements(read(VENDOR_STORAGE_KEY));
    const artists = artistSpending(lineup);
    const input = { settings, visitors, days: lineup.days, stages: lineup.stages, needs: capacityNeeds(visitors), artistFees: artists.total, pitchIncome: pitchIncome(vendors) };
    return { input, artists, lineup, vendorCount: Object.keys(vendors).length, model: financeModel(input) };
  }

  // ---------- charts (plain SVG) ----------

  // Horizontal bars, largest first, with the value and share written next to each bar.
  function barChart(rows, colour, total, label) {
    const sorted = rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
    if (!sorted.length) return '<p class="fin-empty">Nothing here yet.</p>';
    const max = sorted[0].amount;
    return `<div class="fin-bars" role="list" aria-label="${label}">${sorted.map((r) => {
      const share = total > 0 ? Math.round((r.amount / total) * 100) : 0;
      return `<div class="fin-bar-row" role="listitem" data-tip="${escape(r.label)}: ${money(r.amount)} (${share}% of ${label.toLowerCase()})">
        <span class="fin-bar-label">${escape(r.label)}</span>
        <span class="fin-bar-track"><i style="width:${Math.max(1.5, (r.amount / max) * 100)}%;background:${colour}"></i></span>
        <span class="fin-bar-value">${short(r.amount)}<small>${share}%</small></span></div>`;
    }).join('')}</div>`;
  }

  // Profit for every ticket price from €0 to €100: a line, the zero line, today's price and the break-even price.
  function priceChart(data) {
    const curve = priceCurve(data.input, 0, 100, 1);
    const W = 640; const H = 240; const L = 58; const R = 16; const T = 14; const B = 30;
    const profits = curve.map((p) => p.profit);
    const min = Math.min(0, ...profits); const max = Math.max(0, ...profits);
    const pad = (max - min) * 0.08 || 1000;
    const y = (v) => T + ((max + pad - v) / (max - min + 2 * pad)) * (H - T - B);
    const x = (price) => L + (price / 100) * (W - L - R);
    const ticks = niceTicks(min - pad, max + pad, 5);
    const line = curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.price).toFixed(1)} ${y(p.profit).toFixed(1)}`).join(' ');
    const current = Math.min(100, data.input.settings.ticketPrice);
    const currentProfit = curve[Math.round(current)].profit; // prices above €100 are shown at the right edge
    const be = data.model.breakEvenPrice;
    return `<div class="fin-chart" id="fin-price-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Profit by ticket price from €0 to €100">
        ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="fin-grid ${t === 0 ? 'zero' : ''}" /><text x="${L - 8}" y="${y(t)}" dy="0.32em" class="fin-axis" text-anchor="end">${short(t)}</text>`).join('')}
        ${[0, 20, 40, 60, 80, 100].map((p) => `<text x="${x(p)}" y="${H - 8}" class="fin-axis" text-anchor="middle">€${p}</text>`).join('')}
        ${be !== null && be > 0 && be <= 100 ? `<line x1="${x(be)}" x2="${x(be)}" y1="${T}" y2="${H - B}" class="fin-be" /><text x="${x(be) + 5}" y="${T + 10}" class="fin-axis strong">break-even €${be}</text>` : ''}
        <path d="${line}" fill="none" stroke="${PROFIT}" stroke-width="2" stroke-linejoin="round" />
        <circle cx="${x(current)}" cy="${y(currentProfit)}" r="5" fill="${currentProfit >= 0 ? PROFIT : COST}" stroke="#fffefa" stroke-width="2" />
        <text x="${x(current)}" y="${y(currentProfit) - 12}" class="fin-axis strong" text-anchor="middle">your price</text>
        <g class="fin-cross hidden"><line class="fin-cross-line" y1="${T}" y2="${H - B}" /><circle r="4" fill="${PROFIT}" stroke="#fffefa" stroke-width="2" /></g>
        <rect class="fin-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" data-curve='${JSON.stringify(curve.map((p) => [p.price, p.profit]))}' data-geo="${[L, R, T, B, W, H, min - pad, max + pad].join(',')}" />
      </svg></div>`;
  }

  // Round axis steps (1, 2, 2.5 or 5 × a power of ten).
  function niceTicks(lo, hi, count) {
    const raw = (hi - lo) / count;
    const power = 10 ** Math.floor(Math.log10(raw || 1));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) || raw;
    const ticks = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(Math.round(t) || 0); // "|| 0" turns a rounded -0 into 0
    return ticks;
  }

  // Scenario bars grow up (profit) or down (loss) from a zero line.
  function scenarioChart(rows) {
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.profit)));
    const anyLoss = rows.some((r) => r.profit < 0);
    return `<div class="fin-scenarios ${anyLoss ? 'with-loss' : ''}">${rows.map((r) => {
      const height = (Math.abs(r.profit) / max) * 100;
      return `<div class="fin-scenario" data-tip="${r.label}: ${number(r.ticketsSold)} tickets · revenue ${money(r.revenue)} · costs ${money(r.costs)} · ${r.profit >= 0 ? 'profit' : 'loss'} ${money(Math.abs(r.profit))}">
        <div class="fin-scenario-plot"><div class="fin-scenario-up">${r.profit >= 0 ? `<i style="height:${height}%;background:${PROFIT}"></i>` : ''}</div>
        <div class="fin-scenario-down">${r.profit < 0 ? `<i style="height:${height}%;background:${COST}"></i>` : ''}</div></div>
        <strong class="${r.profit >= 0 ? 'pos' : 'neg'}">${r.profit >= 0 ? '' : '−'}${short(Math.abs(r.profit))}</strong>
        <span>${r.label}</span><small>${r.sellThrough}% sold · ${number(r.ticketsSold)} tickets</small></div>`;
    }).join('')}</div>`;
  }

  // ---------- the page ----------
  function render() {
    const data = collect();
    const { model, artists, input } = data;
    const profitText = `${model.profit >= 0 ? '' : '−'}${money(Math.abs(model.profit))}`;
    const be = model.breakEvenTickets;
    const beText = be === null ? 'Not possible' : be === 0 ? 'Covered' : `${number(be)} tickets`;
    const beNote = be === null ? 'tickets are free' : be === 0 ? 'sponsors and vendors cover all costs'
      : model.breakEvenReachable ? `${Math.round((be / input.visitors) * 100)}% of ${number(input.visitors)} visitors · or price €${model.breakEvenPrice}` : `more than the ${number(input.visitors)} expected visitors`;
    const stageRows = Object.entries(artists.byStage).sort().map(([stage, amount]) => ({ label: `Stage ${stage}`, amount }));
    const dayRows = Object.entries(artists.byDay).sort().map(([day, amount]) => ({ label: dayName(day), amount }));

    view.innerHTML = `
      <section class="checklist-hero">
        <p class="eyebrow">FINANCIAL OVERVIEW</p>
        <h1>Know your numbers<br /><em>before the gates open.</em></h1>
        <p class="hero-copy">Profit and loss, break-even, scenarios and price sensitivity, calculated from your lineup, vendors and festival size. Change the assumptions at the bottom; everything updates at once.</p>
      </section>
      <div class="fin-sources">
        <span>DATA FROM</span>
        <a href="#" data-go="Lineup planner">Lineup · ${artists.performances} performance${artists.performances === 1 ? '' : 's'}</a>
        <a href="#" data-go="Vendors">Vendors · ${data.vendorCount} confirmed</a>
        <a href="#" data-go="Site map">Festival size · ${number(input.visitors)} visitors</a>
        <span>${input.days} day${input.days === 1 ? '' : 's'} · ${input.stages} stages</span>
      </div>
      <section class="fin-kpis">
        <div class="fin-kpi"><span>${model.profit >= 0 ? 'PROFIT' : 'LOSS'}</span><strong class="${model.profit >= 0 ? 'pos' : 'neg'}">${model.profit >= 0 ? '▲' : '▼'} ${profitText}</strong><small>${model.margin}% margin</small></div>
        <div class="fin-kpi"><span>REVENUE</span><strong>${money(model.totalRevenue)}</strong><small>${number(model.ticketsSold)} tickets at €${input.settings.ticketPrice}</small></div>
        <div class="fin-kpi"><span>COSTS</span><strong>${money(model.totalCosts)}</strong><small>${model.costPerVisitor === null ? 'no tickets sold' : `${money(model.costPerVisitor)} per visitor`}</small></div>
        <div class="fin-kpi"><span>BREAK-EVEN</span><strong>${beText}</strong><small>${beNote}</small></div>
      </section>
      <div class="fin-grid2">
        <section class="fin-card"><header><h2>Where the money goes</h2><span>${money(model.totalCosts)}</span></header>${barChart(model.costs, COST, model.totalCosts, 'Costs')}</section>
        <section class="fin-card"><header><h2>Where the money comes from</h2><span>${money(model.totalRevenue)}</span></header>${barChart(model.revenue, PROFIT, model.totalRevenue, 'Revenue')}</section>
      </div>
      <div class="fin-grid2 wide-left">
        <section class="fin-card"><header><h2>Profit by ticket price</h2><span>everything else unchanged</span></header>${priceChart(data)}
          <p class="fin-note">${model.breakEvenPrice === null ? 'With no tickets sold there is no break-even price.' : model.breakEvenPrice === 0 ? 'Sponsors and vendors already cover all costs, so any ticket price is profit.' : `Below <b>€${model.breakEvenPrice}</b> per ticket the festival loses money. Every extra euro on the ticket adds about <b>${money(Math.round(model.ticketsSold * (1 - input.settings.ticketingFee / 100)))}</b> profit.`}</p></section>
        <section class="fin-card"><header><h2>Scenarios</h2><span>how many tickets sell?</span></header>${scenarioChart(scenarios(input))}</section>
      </div>
      <section class="fin-card">
        <header><h2>Artist spending</h2><span>from the lineup planner</span></header>
        <div class="fin-artists">
          <div>
            <div class="fin-budget"><div class="fin-budget-top"><span>Artist budget used</span><strong class="${artists.budgetUsed > 100 ? 'neg' : ''}">${artists.budgetUsed}%</strong></div>
              <div class="fin-budget-bar"><i style="width:${Math.min(100, artists.budgetUsed)}%;background:${artists.budgetUsed > 100 ? COST : PROFIT}"></i></div>
              <small>${money(artists.total)} of ${money(artists.budget)}${artists.total > artists.budget ? ` · ${money(artists.total - artists.budget)} over budget` : ` · ${money(artists.budget - artists.total)} left`}</small></div>
            <dl class="fin-facts"><div><dt>Performances</dt><dd>${artists.performances}</dd></div><div><dt>Average fee</dt><dd>${money(artists.averageFee)}</dd></div>
              <div><dt>Cost per stage hour</dt><dd>${money(artists.costPerHour)}</dd></div><div><dt>Share of all costs</dt><dd>${model.totalCosts ? Math.round((artists.total / model.totalCosts) * 100) : 0}%</dd></div></dl>
          </div>
          <div><h3>Per stage</h3>${barChart(stageRows, PROFIT, artists.total, 'Artist fees')}<h3>Per day</h3>${barChart(dayRows, PROFIT, artists.total, 'Artist fees')}</div>
          <div><h3>Most expensive shows</h3>${artists.top.length ? `<table class="fin-table"><thead><tr><th>Artist</th><th>Where</th><th>Fee</th></tr></thead><tbody>${artists.top.map((s) => `<tr><td>${escape(s.name)}</td><td>${dayName(s.date)} · ${s.stage}</td><td>${money(s.fee)}</td></tr>`).join('')}</tbody></table>` : '<p class="fin-empty">No performances booked yet. <a href="#" data-go="Lineup planner">Open the lineup planner</a>.</p>'}</div>
        </div>
      </section>
      <div class="fin-grid2">
        <section class="fin-card"><header><h2>Profit &amp; loss statement</h2><span>all figures in euros</span></header>
          <table class="fin-table fin-pl"><tbody>
            <tr class="head"><th colspan="2">Revenue</th></tr>${model.revenue.map((r) => `<tr><td>${r.label}</td><td>${money(r.amount)}</td></tr>`).join('')}
            <tr class="sum"><td>Total revenue</td><td>${money(model.totalRevenue)}</td></tr>
            <tr class="head"><th colspan="2">Costs</th></tr>${model.costs.map((c) => `<tr><td>${c.label}</td><td>${money(c.amount)}</td></tr>`).join('')}
            <tr class="sum"><td>Total costs</td><td>${money(model.totalCosts)}</td></tr>
            <tr class="result ${model.profit >= 0 ? 'pos' : 'neg'}"><td>${model.profit >= 0 ? 'Profit' : 'Loss'}</td><td>${profitText}</td></tr>
          </tbody></table></section>
        <section class="fin-card"><header><h2>Assumptions</h2><button type="button" class="button secondary" data-reset>Reset</button></header>
          ${['Revenue', 'Costs'].map((group) => `<h3>${group}</h3><div class="fin-form">${FINANCE_FIELDS.filter((f) => f.group === group).map((f) => `
            <label>${f.label}<input type="number" data-field="${f.id}" value="${settings[f.id]}" min="${f.min}" max="${f.max}" step="${f.step}" /><small>${f.unit}</small></label>`).join('')}</div>`).join('')}
          <p class="fin-note">Toilets, water points, first aiders and security follow the festival size on the Site map. Example prices, not quotes: replace them with your real offers.</p>
        </section>
      </div>
      <div class="fin-tip hidden" role="tooltip"></div>`;
  }

  // ---------- interaction: tooltips, crosshair, inputs, links ----------
  view.addEventListener('mousemove', (event) => {
    const tip = view.querySelector('.fin-tip');
    if (!tip) return;
    const hit = event.target.closest('.fin-hit');
    const cross = view.querySelector('.fin-cross');
    if (hit) {
      const [L, R, T, B, W, H, lo, hi] = hit.dataset.geo.split(',').map(Number);
      const curve = JSON.parse(hit.dataset.curve);
      const svg = hit.ownerSVGElement;
      const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const p = point.matrixTransform(svg.getScreenCTM().inverse());
      const price = Math.max(0, Math.min(100, Math.round(((p.x - L) / (W - L - R)) * 100)));
      const profit = curve[price][1];
      const cx = L + (price / 100) * (W - L - R);
      const cy = T + ((hi - profit) / (hi - lo)) * (H - T - B);
      cross.classList.remove('hidden');
      cross.querySelector('line').setAttribute('x1', cx); cross.querySelector('line').setAttribute('x2', cx);
      cross.querySelector('circle').setAttribute('cx', cx); cross.querySelector('circle').setAttribute('cy', cy);
      showTip(tip, event, `<b>€${price}</b> per ticket<br>${profit >= 0 ? 'Profit' : 'Loss'} ${money(Math.abs(profit))}`);
      return;
    }
    if (cross) cross.classList.add('hidden');
    const mark = event.target.closest('[data-tip]');
    if (mark) showTip(tip, event, escape(mark.dataset.tip)); else tip.classList.add('hidden');
  });
  view.addEventListener('mouseleave', () => { view.querySelector('.fin-tip')?.classList.add('hidden'); view.querySelector('.fin-cross')?.classList.add('hidden'); });
  function showTip(tip, event, html) {
    tip.innerHTML = html;
    tip.classList.remove('hidden');
    const box = view.getBoundingClientRect();
    const left = Math.min(event.clientX - box.left + 14, box.width - tip.offsetWidth - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${event.clientY - box.top + 14}px`;
  }

  view.addEventListener('change', (event) => {
    const id = event.target.dataset.field;
    if (!id) return;
    if (!validFinanceValue(id, event.target.value)) {
      const field = FINANCE_FIELDS.find((f) => f.id === id);
      toast(`${field.label}: please enter a number from ${number(field.min)} to ${number(field.max)}.`);
      event.target.value = settings[id];
      return;
    }
    settings = { ...settings, [id]: Number(event.target.value) };
    save();
    const scroll = window.scrollY;
    render();
    window.scrollTo(0, scroll);
    view.querySelector(`[data-field="${id}"]`)?.focus();
  });

  view.addEventListener('click', (event) => {
    const go = event.target.closest('[data-go]');
    if (go) { event.preventDefault(); document.querySelector(`.sidebar-item[data-section="${go.dataset.go}"]`).click(); return; }
    if (event.target.closest('[data-reset]')) { settings = { ...DEFAULT_FINANCE }; save(); render(); toast('Assumptions reset to the example values.'); }
  });

  // Left navigation: "Finances" shows this page (freshly calculated), anything else hides it.
  document.querySelectorAll('.sidebar-item').forEach((button) => button.addEventListener('click', () => {
    const onFinance = button.dataset.section === 'Finances';
    view.classList.toggle('hidden', !onFinance);
    if (onFinance) render();
  }));
})();
