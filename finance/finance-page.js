// Festival Architect — the Financial overview page: profit and loss, break-even and safety margin, ticket tiers,
// festival bars, where the money goes and comes from, profit by ticket price, a profit matrix, scenarios,
// per-visitor figures and the artist spending (secure vs planned).
// It only READS the other pages' data (lineup, vendors, festival size) and never changes it.
// All calculations live in rules/finance-rules.js; the assumptions are saved in this browser.

(function () {
  const view = document.querySelector('#finance-view');
  const PROFIT = '#1a9a7c'; // revenue and profit (validated colour pair, also readable with colour blindness)
  const COST = '#e0563b';   // costs and losses
  let settings = parseFinance(read(FINANCE_STORAGE_KEY));

  function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function save(next) {
    if (window.getLineupDataProblem?.()) { toast('Recover the saved lineup before changing finance assumptions.'); return false; }
    try {
      localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      toast('Finance changes could not be saved in this browser. The previous values are kept.');
      return false;
    }
    settings = next;
    window.dispatchEvent(new Event('festival-finance-saved'));
    return true;
  }
  const money = (n) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const short = (n) => (Math.abs(n) >= 1000 ? `${n < 0 ? '−' : ''}€${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1)}k` : money(n));
  const number = (n) => n.toLocaleString('en-GB');
  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayName = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  // Everything the model needs, collected fresh from the other pages each time the page is shown.
  function collect(financeSettings = settings) {
    const lineup = typeof state !== 'undefined'
      ? { bookings: state.bookings, artists: state.artists, budget: state.settings.budget, stages: state.settings.stages, days: days().length }
      : { bookings: [], artists: [], budget: 0, stages: 2, days: 1 };
    const visitors = parseGround(read(GROUND_STORAGE_KEY)).visitors;
    // Only vendors on pitches that still exist for this festival size bring in pitch fees.
    const vendors = fitPlacements(parsePlacements(read(VENDOR_STORAGE_KEY)), capacityNeeds(visitors).pitches).placements;
    const artists = artistSpending(lineup);
    const input = { settings: financeSettings, visitors, days: lineup.days, stages: lineup.stages, needs: capacityNeeds(visitors), artistFees: artists.total, pitchIncome: pitchIncome(vendors) };
    return { input, artists, lineup, vendorCount: Object.keys(vendors).length, model: financeModel(input) };
  }

  window.getOverviewFinance = () => {
    if (window.getLineupDataProblem?.()) return null;
    const { totalRevenue, totalCosts, profit } = collect().model;
    return { totalRevenue, totalCosts, profit };
  };

  window.getReadinessFinance = () => {
    if (window.getLineupDataProblem?.()) return null;
    const { model, input } = collect(parseFinance(read(FINANCE_STORAGE_KEY)));
    return { profit: model.profit, cashNeeded: cashFlow(model, input.settings.ticketingFee).cashNeeded };
  };

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

  // Profit for every ticket price from €0 up to at least €100: a line, the zero line, today's price and the
  // break-even price. The axis grows (in €50 steps, at most €500) so a higher price or break-even stays visible.
  function priceChart(data) {
    const be = data.model.breakEvenPrice;
    const top = Math.min(500, Math.max(100, Math.ceil((Math.max(data.input.settings.ticketPrice, be || 0) * 1.2) / 50) * 50));
    const curve = priceCurve(data.input, 0, top, 1);
    const W = 640; const H = 240; const L = 58; const R = 16; const T = 14; const B = 30;
    const profits = curve.map((p) => p.profit);
    const min = Math.min(0, ...profits); const max = Math.max(0, ...profits);
    const pad = (max - min) * 0.08 || 1000;
    const y = (v) => T + ((max + pad - v) / (max - min + 2 * pad)) * (H - T - B);
    const x = (price) => L + (price / top) * (W - L - R);
    const ticks = niceTicks(min - pad, max + pad, 5);
    const line = curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.price).toFixed(1)} ${y(p.profit).toFixed(1)}`).join(' ');
    const current = Math.min(top, data.input.settings.ticketPrice);
    const currentProfit = curve[Math.round(current)].profit;
    return `<div class="fin-chart" id="fin-price-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Profit by ticket price from €0 to €${top}">
        ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="fin-grid ${t === 0 ? 'zero' : ''}" /><text x="${L - 8}" y="${y(t)}" dy="0.32em" class="fin-axis" text-anchor="end">${short(t)}</text>`).join('')}
        ${[0, 1, 2, 3, 4, 5].map((i) => i * top / 5).map((p) => `<text x="${x(p)}" y="${H - 8}" class="fin-axis" text-anchor="middle">€${p}</text>`).join('')}
        ${be !== null && be > 0 && be <= top ? `<line x1="${x(be)}" x2="${x(be)}" y1="${T}" y2="${H - B}" class="fin-be" /><text x="${x(be) + 5}" y="${T + 10}" class="fin-axis strong">break-even €${be}</text>` : ''}
        <path d="${line}" fill="none" stroke="${PROFIT}" stroke-width="2" stroke-linejoin="round" />
        <circle cx="${x(current)}" cy="${y(currentProfit)}" r="5" fill="${currentProfit >= 0 ? PROFIT : COST}" stroke="#fffefa" stroke-width="2" />
        <text x="${x(current)}" y="${y(currentProfit) - 12}" class="fin-axis strong" text-anchor="middle">your price</text>
        <g class="fin-cross hidden"><line class="fin-cross-line" y1="${T}" y2="${H - B}" /><circle r="4" fill="${PROFIT}" stroke="#fffefa" stroke-width="2" /></g>
        <rect class="fin-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" data-curve='${JSON.stringify(curve.map((p) => [p.price, p.profit]))}' data-geo="${[L, R, T, B, W, H, min - pad, max + pad, top].join(',')}" />
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

  // Under the scenario bars: one row per case with a slider (% of expected visitors) and the number of
  // tickets, so the organiser can say directly how many tickets sell in each case.
  function scenarioControls(rows, visitors, editable) {
    const lock = editable ? '' : 'disabled title="Admins can change the scenarios."';
    return `<div class="fin-scenario-controls">${rows.map((r) => `<div class="fin-scenario-control">
        <span class="fin-scenario-name">${escape(r.label)}${r.id === 'plan' ? ' <small>(= Tickets sold)</small>' : ''}</span>
        <input type="range" min="0" max="100" step="1" value="${r.sellThrough}" data-field="${r.field}" data-live="${r.field}" aria-label="${escape(r.label)}: share of expected visitors who buy a ticket" ${lock} />
        <output data-live-out="${r.field}">${r.sellThrough}%</output>
        <label class="fin-scenario-tickets"><input type="number" min="0" max="${visitors}" step="1" value="${Math.round((visitors * r.sellThrough) / 100)}" data-scenario-tickets="${r.field}" aria-label="${escape(r.label)}: tickets sold" ${lock} /> tickets</label>
      </div>`).join('')}</div>
      <p class="fin-note">Drag a slider or type the number of tickets. Of ${number(visitors)} expected visitors.</p>`;
  }

  // The "Additional assumptions": more ticket assumptions, other festival costs and income, and your own lines.
  function additionalAssumptions(editable) {
    const lock = editable ? '' : 'disabled';
    const fields = (sub) => FINANCE_FIELDS.filter((f) => f.group === 'Additional' && f.sub === sub).map((f) => `
          <label>${f.label}<input type="number" data-field="${f.id}" value="${settings[f.id]}" min="${f.min}" max="${f.max}" step="${f.step}" ${lock} /><small>${f.unit}</small></label>`).join('');
    const option = (value, label, current) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
    const extras = settings.extras || [];
    const rows = extras.map((e) => `<div class="fin-extra" data-extra-row="${e.id}">
        <label>Name<input data-extra="${e.id}" data-key="label" value="${escape(e.label)}" maxlength="60" ${lock} /></label>
        <label>Type<select data-extra="${e.id}" data-key="kind" ${lock}>${option('cost', 'Cost', e.kind)}${option('revenue', 'Income', e.kind)}</select></label>
        <label>Amount (€)<input type="number" min="0" max="5000000" step="0.01" data-extra="${e.id}" data-key="amount" value="${e.amount}" ${lock} /></label>
        <label>Per<select data-extra="${e.id}" data-key="basis" ${lock}>${EXTRA_BASES.map((b) => option(b.id, b.label, e.basis)).join('')}</select></label>
        <label>Paid<select data-extra="${e.id}" data-key="timing" ${lock}>${EXTRA_TIMINGS.map((t) => option(t.id, t.label, e.timing)).join('')}</select></label>
        <button type="button" class="button quiet" data-extra-remove="${e.id}" aria-label="Remove ${escape(e.label)}" ${lock}>Remove</button>
      </div>`).join('');
    return `<details class="cleanup-disclosure"><summary>Additional assumptions</summary>
        <h3 class="fin-sub">More ticket assumptions</h3><div class="fin-form">${fields('Tickets')}</div>
        <h3 class="fin-sub">Other income</h3><div class="fin-form">${fields('Income')}</div>
        <h3 class="fin-sub">Other costs</h3><div class="fin-form">${fields('Costs')}</div>
        <h3 class="fin-sub">Your own costs and income</h3>
        <p class="fin-note">Anything else your festival pays or earns, e.g. “Fencing €4,000 in total”, “Wristbands €0.40 per visitor” or “Camping €15 per visitor”. It is included in profit, break-even and the cash-flow plan.</p>
        <div class="fin-extras">${rows || '<p class="fin-empty">No own lines yet.</p>'}</div>
        <div class="fin-extra-actions"><button type="button" class="button secondary" data-extra-add="cost" ${lock} ${extras.length >= MAX_FINANCE_EXTRAS ? 'disabled' : ''}>+ Add cost</button><button type="button" class="button secondary" data-extra-add="revenue" ${lock} ${extras.length >= MAX_FINANCE_EXTRAS ? 'disabled' : ''}>+ Add income</button></div>
      </details>`;
  }

  // Profit for ticket price × share of tickets sold. Green = profit, red = loss; the stronger the colour,
  // the bigger the amount. The cell with your current plan is outlined.
  function matrixTable(data) {
    const s = data.input.settings;
    const prices = [...new Set([-10, -5, 0, 5, 10].map((d) => Math.max(0, s.ticketPrice + d)))];
    const shares = [...new Set([50, 65, 80, 90, 100, s.sellThrough])].sort((a, b) => a - b);
    const rows = profitMatrix(data.input, prices, shares);
    const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => Math.abs(c.profit))));
    const tint = (v) => {
      const strength = 0.1 + 0.55 * (Math.abs(v) / max);
      return v >= 0 ? `rgba(26,154,124,${strength.toFixed(2)})` : `rgba(224,86,59,${strength.toFixed(2)})`;
    };
    return `<table class="fin-matrix"><thead><tr><th>Regular price ↓ · tickets sold →</th>${shares.map((sh) => `<th>${sh}%</th>`).join('')}</tr></thead><tbody>
      ${rows.map((r) => `<tr><th>€${r.price}</th>${r.cells.map((c) => {
        const mine = r.price === s.ticketPrice && c.sellThrough === s.sellThrough;
        return `<td class="${mine ? 'mine' : ''}" style="background:${tint(c.profit)}" data-tip="€${r.price} regular price · ${c.sellThrough}% sold → ${c.profit >= 0 ? 'profit' : 'loss'} ${money(Math.abs(c.profit))}${mine ? ' (your plan)' : ''}">${c.profit >= 0 ? '' : '−'}${short(Math.abs(c.profit))}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table>`;
  }

  // Cash flow per month: money in grows up (green), money out grows down (red, hatched so it does not rely
  // on colour alone), and the line is the account balance. Below the zero line the festival needs credit.
  function cashChart(cf) {
    const W = 640; const H = 260; const L = 58; const R = 12; const T = 16; const B = 30;
    const values = cf.months.flatMap((m) => [m.inflow, -m.outflow, m.balance]);
    const min = Math.min(0, ...values); const max = Math.max(0, ...values);
    const pad = (max - min) * 0.06 || 1000;
    const y = (v) => T + ((max + pad - v) / (max - min + 2 * pad)) * (H - T - B);
    const band = (W - L - R) / cf.months.length;
    const cx = (i) => L + band * (i + 0.5);
    const bar = Math.min(18, band * 0.28);
    const ticks = niceTicks(min - pad, max + pad, 5);
    const line = cf.months.map((m, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)} ${y(m.balance).toFixed(1)}`).join(' ');
    return `<div class="fin-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cash flow per month from 6 months before the festival to the month after; lowest balance ${money(cf.lowestBalance)} (${cf.lowestMonth})">
        <defs><pattern id="fin-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${COST}" /><line x1="0" y1="0" x2="0" y2="6" stroke="#fffefa" stroke-width="2" opacity="0.45" /></pattern></defs>
        ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="fin-grid ${t === 0 ? 'zero' : ''}" /><text x="${L - 8}" y="${y(t)}" dy="0.32em" class="fin-axis" text-anchor="end">${short(t)}</text>`).join('')}
        ${cf.months.map((m, i) => `<g data-tip="${m.label}: in ${money(m.inflow)} · out ${money(m.outflow)} · balance ${m.balance < 0 ? '−' : ''}${money(Math.abs(m.balance))}">
          <rect x="${cx(i) - band / 2}" y="${T}" width="${band}" height="${H - T - B}" fill="transparent" />
          <rect x="${cx(i) - bar - 1}" y="${y(m.inflow)}" width="${bar}" height="${Math.max(0, y(0) - y(m.inflow))}" fill="${PROFIT}" rx="2" />
          <rect x="${cx(i) + 1}" y="${y(0)}" width="${bar}" height="${Math.max(0, y(-m.outflow) - y(0))}" fill="url(#fin-hatch)" rx="2" />
          <text x="${cx(i)}" y="${H - 8}" class="fin-axis ${m.offset === 0 ? 'strong' : ''}" text-anchor="middle">${m.short}</text></g>`).join('')}
        <path d="${line}" fill="none" stroke="#17272b" stroke-width="2" stroke-linejoin="round" pointer-events="none" />
        ${cf.months.map((m, i) => `<circle cx="${cx(i)}" cy="${y(m.balance)}" r="${m.label === cf.lowestMonth && cf.cashNeeded ? 5 : 3.5}" fill="${m.balance < 0 ? COST : '#17272b'}" stroke="#fffefa" stroke-width="1.5" pointer-events="none" />`).join('')}
      </svg>
      <p class="fin-legend"><span><i style="background:${PROFIT}"></i>Money in</span><span><i class="hatch"></i>Money out</span><span><i class="line"></i>Account balance</span></p></div>`;
  }

  function cashTable(cf) {
    const cell = (v) => `${v < 0 ? '−' : ''}${short(Math.abs(v))}`;
    return `<table class="fin-matrix fin-cash"><thead><tr><th>Month</th>${cf.months.map((m) => `<th>${m.short}</th>`).join('')}</tr></thead><tbody>
      <tr><th>Money in</th>${cf.months.map((m) => `<td>${cell(m.inflow)}</td>`).join('')}</tr>
      <tr><th>Money out</th>${cf.months.map((m) => `<td>${m.outflow ? '−' : ''}${short(m.outflow)}</td>`).join('')}</tr>
      <tr class="balance"><th>Balance</th>${cf.months.map((m) => `<td class="${m.balance < 0 ? 'neg' : ''}">${cell(m.balance)}</td>`).join('')}</tr>
    </tbody></table>`;
  }

  // ---------- the page ----------
  function render() {
    if (window.getLineupDataProblem?.()) {
      view.innerHTML = '<section class="checklist-hero"><h1>Finances</h1><p>Financial totals are unavailable because the saved lineup could not be read. Recover the lineup using the notice above; your finance assumptions have been kept unchanged.</p></section>';
      return;
    }
    const openSections = [...view.querySelectorAll(".cleanup-disclosure[open]")].map(node => node.querySelector("summary").textContent);
    const data = collect();
    const { model, artists, input } = data;
    const hasForecast = hasFinanceValues(input);
    const canEditAssumptions = canFestival('budget');
    const profitText = `${model.profit >= 0 ? '' : '−'}${money(Math.abs(model.profit))}`;
    const be = model.breakEvenTickets;
    const beText = !hasForecast ? '—' : be === null ? 'Not possible' : be === 0 ? 'Covered' : `${number(be)} tickets`;
    const beNote = !hasForecast ? 'enter financial assumptions first' : be === null ? 'nothing is earned per ticket' : be === 0 ? 'sponsors and vendors cover all fixed costs'
      : model.breakEvenReachable ? `${Math.round((be / input.visitors) * 100)}% of ${number(input.visitors)} visitors${model.breakEvenPrice === null ? '' : ` · or regular price €${model.breakEvenPrice}`}` : `more than the ${number(input.visitors)} expected visitors`;
    const safety = model.safetyMargin;
    const safetyText = safety === null ? '—' : `${safety}%`;
    const safetyNote = safety === null ? 'no tickets planned' : safety >= 0 ? `${number(model.ticketsSold - be)} tickets may fall away before a loss` : `${number(be - model.ticketsSold)} more tickets needed to break even`;
    const tierRows = model.tiers.map((t) => ({ label: `${t.label} · ${number(t.tickets)} × €${Number.isInteger(t.price) ? t.price : t.price.toFixed(2)}`, amount: t.revenue }));
    const stageRows = Object.entries(artists.byStage).sort().map(([stage, amount]) => ({ label: `Stage ${stage}`, amount }));
    const dayRows = Object.entries(artists.byDay).sort().map(([day, amount]) => ({ label: dayName(day), amount }));
    const cash = cashFlow(model, input.settings.ticketingFee);

    view.innerHTML = `
      <section class="checklist-hero">
        <h1>Finances</h1>
        <p class="hero-copy">Profit, break-even and scenarios, calculated from your lineup, vendors and festival size.${canEditAssumptions ? ' Change the numbers under Financial assumptions.' : ''}</p>
      </section>
      <div class="fin-sources">
        <span>Based on</span>
        <a href="#" data-go="Lineup planner">Lineup · ${artists.performances} performance${artists.performances === 1 ? '' : 's'}</a>
        <a href="#" data-go="Vendors">Vendors · ${data.vendorCount} confirmed</a>
        <a href="#" data-go="Site map">Festival size · ${number(input.visitors)} visitors</a>
        <span>${input.days} day${input.days === 1 ? '' : 's'} · ${input.stages} stages</span>
      </div>
      ${hasForecast ? '' : '<p class="fin-note">No financial assumptions entered yet. New festivals start at zero; enter your prices, expected ticket sales and costs under Financial assumptions.</p>'}
      <section class="fin-kpis five">
        <div class="fin-kpi"><span>${model.profit >= 0 ? 'Profit' : 'Loss'}</span><strong class="${model.profit >= 0 ? 'pos' : 'neg'}">${profitText}</strong><small>${model.margin}% margin</small></div>
        <div class="fin-kpi"><span>Revenue</span><strong>${money(model.totalRevenue)}</strong><small>${number(model.ticketsSold)} tickets · average €${model.averageTicketPrice.toFixed(2)}</small></div>
        <div class="fin-kpi"><span>Costs</span><strong>${money(model.totalCosts)}</strong><small>incl. ${money(model.costs.find((c) => c.id === 'contingency').amount)} reserve</small></div>
        <div class="fin-kpi"><span>Break-even</span><strong>${beText}</strong><small>${beNote}</small></div>
        <div class="fin-kpi"><span>Safety margin</span><strong class="${safety !== null && safety < 0 ? 'neg' : ''}">${safetyText}</strong><small>${safetyNote}</small></div>
      </section>
      <section class="fin-card fin-assumptions"><details class="cleanup-disclosure"><summary>Financial assumptions</summary><header><h2>Assumptions</h2><button type="button" class="button secondary" data-reset ${canEditAssumptions ? '' : 'disabled'}>Load example values</button></header>
        <div class="fin-groups">${['Tickets', 'Bar & sponsors', 'Costs'].map((group) => `<details class="cleanup-disclosure"><summary>${group}</summary><div class="fin-form">${FINANCE_FIELDS.filter((f) => f.group === group).map((f) => `
          <label>${f.label}<input type="number" data-field="${f.id}" value="${settings[f.id]}" min="${f.min}" max="${f.max}" step="${f.step}" ${canEditAssumptions ? '' : 'disabled'} /><small>${f.unit}</small></label>`).join('')}</div></details>`).join('')}${additionalAssumptions(canEditAssumptions)}</div>
        <p class="fin-note">${canEditAssumptions ? 'Enter your prices, expected ticket sales and real offers. Load example values fills in sample assumptions.' : 'Admins can edit these assumptions.'} Toilets, water points, first aiders and security follow the festival size on the Site map.</p>
        <details class="cleanup-disclosure fin-limits"><summary>What this model leaves out</summary>
          <p class="fin-note">A planning estimate for comparing options, not accounting or tax advice. It simplifies on purpose:</p>
          <ul class="fin-note">
            <li><b>Profit is before income tax.</b> Loans, interest and inflation are not included.</li>
            <li><b>VAT is only taken out of tickets</b> (if you enter a rate). Enter bars, merch, pitch fees, sponsorship and your own lines without VAT.</li>
            <li><b>Sponsorship, grants and pitch fees stay the same</b> in every scenario; bars, merch, cleaning and per-visitor lines grow with the tickets sold.</li>
            <li><b>Security, toilets, first aid and water are planned for the expected visitors</b>, so they do not shrink when fewer tickets sell.</li>
            <li><b>Weather, refunds and no-shows</b> are only covered through the bad case. The cash-flow plan uses typical months, not real payment dates.</li>
          </ul>
        </details>
      </details></section>
      <div class="fin-grid2">
        <section class="fin-card"><header><h2>Ticket tiers</h2><span>${number(model.ticketsSold)} tickets</span></header>${barChart(tierRows, PROFIT, model.revenue.find((r) => r.id === 'tickets').amount, 'Ticket sales')}
          <p class="fin-note">Average ticket price <b>€${model.averageTicketPrice.toFixed(2)}</b> — early bird sales bring money in early, the box office surcharge rewards those who decide last.</p></section>
        <section class="fin-card"><header><h2>Per visitor</h2><span>per ticket sold</span></header>
          <dl class="fin-facts fin-per">
            <div><dt>Revenue</dt><dd>${model.revenuePerVisitor === null ? '—' : money(model.revenuePerVisitor)}</dd></div>
            <div><dt>Costs</dt><dd>${model.costPerVisitor === null ? '—' : money(model.costPerVisitor)}</dd></div>
            <div><dt>${model.profit >= 0 ? 'Profit' : 'Loss'}</dt><dd class="${model.profit >= 0 ? 'pos' : 'neg'}">${model.profitPerVisitor === null ? '—' : money(model.profitPerVisitor)}</dd></div>
            <div><dt>Bar spend over ${input.days} day${input.days === 1 ? '' : 's'}</dt><dd>${money(input.days * input.settings.barSpend)}</dd></div>
          </dl>
          <p class="fin-note">Bars keep <b>${input.settings.barMargin}%</b> of every drink after stock and staff, so each visitor brings about <b>${money(input.days * input.settings.barSpend * input.settings.barMargin / 100)}</b> on top of the ticket.</p></section>
      </div>
      <div class="fin-grid2">
        <section class="fin-card"><header><h2>Where the money goes</h2><span>${money(model.totalCosts)}</span></header>${barChart(model.costs, COST, model.totalCosts, 'Costs')}</section>
        <section class="fin-card"><header><h2>Where the money comes from</h2><span>${money(model.totalRevenue)}</span></header>${barChart(model.revenue, PROFIT, model.totalRevenue, 'Revenue')}</section>
      </div>
      <div class="fin-grid2 wide-left">
        <section class="fin-card"><header><h2>Profit by regular ticket price</h2><span>everything else unchanged</span></header>${hasForecast ? priceChart(data) : ''}
          <p class="fin-note">${!hasForecast ? 'Enter financial assumptions to compare ticket prices.' : model.breakEvenPrice === null ? 'With no tickets sold there is no break-even price.' : model.breakEvenPrice === 0 ? 'Bars, sponsors and vendors already cover the fixed costs, so any ticket price is profit.' : `Below a regular price of <b>€${model.breakEvenPrice}</b> the festival loses money. Every extra euro on the regular ticket adds about <b>${money(Math.round(model.ticketsSold * averagePriceFactor(input.settings) * (1 - input.settings.ticketingFee / 100)))}</b> profit.`}</p></section>
        <section class="fin-card"><header><h2>Scenarios</h2><span>how many tickets sell?</span></header>${scenarioChart(scenarios(input))}${scenarioControls(scenarios(input), input.visitors, canEditAssumptions)}</section>
      </div>
      <section class="fin-card"><header><h2>Profit matrix</h2><span>regular price × tickets sold</span></header>
        <div class="fin-matrix-wrap">${hasForecast ? matrixTable(data) : '<p class="fin-empty">Enter financial assumptions to see price and ticket-sales comparisons.</p>'}</div>
        ${hasForecast ? '<p class="fin-note">Read across to see what happens if fewer or more tickets sell, down to see a different price. Green is profit, red is loss; the outlined cell is your plan.</p>' : ''}
      </section>
      <section class="fin-card"><header><h2>Cash-flow plan</h2><span>account balance month by month</span></header>
        <div class="fin-cash-callout ${cash.cashNeeded ? 'warn' : hasForecast ? 'ok' : ''}">${!hasForecast
          ? '<strong>No cash-flow forecast yet</strong><span>Enter financial assumptions before assessing how much starting money is needed.</span>'
          : cash.cashNeeded
          ? `<strong>${money(cash.cashNeeded)} starting money needed</strong><span>Lowest point: <b>${cash.lowestMonth}</b>. ${cash.months.find((m) => m.label === cash.lowestMonth).offset < 0
            ? 'Deposits and the venue are due before enough tickets are sold. Plan a loan, an earlier sponsor payment or more early bird tickets.'
            : 'The festival does not earn back its costs, so the loss has to come from your own money or a loan. Look at the price, the bars or the costs.'}</span>`
          : `<strong>No starting money needed</strong><span>Ticket and sponsor money always arrives before the bills; the account never goes below zero.</span>`}
          ${hasForecast ? `<span class="fin-cash-peak">Highest balance <b>${money(cash.highestBalance)}</b> (${cash.highestMonth.toLowerCase()}) · at the end <b class="${cash.finalBalance >= 0 ? 'pos' : 'neg'}">${cash.finalBalance < 0 ? '−' : ''}${money(Math.abs(cash.finalBalance))}</b> = the ${cash.finalBalance >= 0 ? 'profit' : 'loss'}</span>` : ''}</div>
        ${hasForecast ? cashChart(cash) : ''}
        <div class="fin-matrix-wrap">${cashTable(cash)}</div>
        <p class="fin-note">Typical timing: early bird tickets sell 6–4 months before, regular tickets 3–1 months before, box office and bars at the festival. Venue first, 50 % artist deposits when booking, 30 % stage deposit, toilet and water invoices after the festival.</p>
      </section>
      <section class="fin-card">
        <header><h2>Artist spending</h2><span>from the lineup planner</span></header>
        <div class="fin-artists">
          <div>
            <div class="fin-budget"><div class="fin-budget-top"><span>Artist budget used</span><strong class="${artists.budgetUsed > 100 ? 'neg' : ''}">${artists.budgetUsed}%</strong></div>
              <div class="fin-budget-bar"><i style="width:${Math.min(100, artists.budgetUsed)}%;background:${artists.budgetUsed > 100 ? COST : PROFIT}"></i></div>
              <small>${money(artists.total)} of ${money(artists.budget)}${artists.total > artists.budget ? ` · ${money(artists.total - artists.budget)} over budget` : ` · ${money(artists.budget - artists.total)} left`}</small></div>
            <div class="fin-secure"><div class="fin-budget-top"><span>Secure vs planned</span></div>
              <div class="fin-secure-bar" role="img" aria-label="${money(artists.confirmedFees)} confirmed, ${money(artists.tentativeFees)} tentative">${artists.total ? `<i class="sure" style="width:${(artists.confirmedFees / artists.total) * 100}%;background:${PROFIT}" data-tip="Confirmed: ${money(artists.confirmedFees)}"></i><i class="maybe" style="width:${(artists.tentativeFees / artists.total) * 100}%" data-tip="Tentative: ${money(artists.tentativeFees)}"></i>` : ''}</div>
              <small><b>${money(artists.confirmedFees)}</b> confirmed · <b>${money(artists.tentativeFees)}</b> tentative${artists.tentativeFees ? ' — could still change' : ''}</small></div>
            <dl class="fin-facts"><div><dt>Performances</dt><dd>${artists.performances}</dd></div><div><dt>Average fee</dt><dd>${money(artists.averageFee)}</dd></div>
              <div><dt>Cost per stage hour</dt><dd>${money(artists.costPerHour)}</dd></div><div><dt>Share of all costs</dt><dd>${model.totalCosts ? Math.round((artists.total / model.totalCosts) * 100) : 0}%</dd></div></dl>
          </div>
          <div><h3>Per stage</h3>${barChart(stageRows, PROFIT, artists.total, 'Artist fees')}<h3>Per day</h3>${barChart(dayRows, PROFIT, artists.total, 'Artist fees')}</div>
          <div><h3>Most expensive shows</h3>${artists.top.length ? `<table class="fin-table"><thead><tr><th>Artist</th><th>Where</th><th>Fee</th></tr></thead><tbody>${artists.top.map((s) => `<tr><td>${escape(s.name)}</td><td>${dayName(s.date)} · ${s.stage}</td><td>${money(s.fee)}</td></tr>`).join('')}</tbody></table>` : '<p class="fin-empty">No performances booked yet. <a href="#" data-go="Lineup planner">Open the lineup planner</a>.</p>'}</div>
        </div>
      </section>
      <div>
        <section class="fin-card"><header><h2>Profit &amp; loss statement</h2><span>all figures in euros</span></header>
          <table class="fin-table fin-pl"><tbody>
            <tr class="head"><th colspan="2">Revenue</th></tr>${model.revenue.map((r) => `<tr><td>${escape(r.label)}${r.own ? ' <small>(own)</small>' : ''}</td><td>${money(r.amount)}</td></tr>`).join('')}
            <tr class="sum"><td>Total revenue</td><td>${money(model.totalRevenue)}</td></tr>
            <tr class="head"><th colspan="2">Fixed costs</th></tr>${model.costs.filter((c) => c.fixed).map((c) => `<tr><td>${escape(c.label)}${c.own ? ' <small>(own)</small>' : ''}</td><td>${money(c.amount)}</td></tr>`).join('')}
            <tr class="sum"><td>Total fixed costs</td><td>${money(model.fixedCosts)}</td></tr>
            <tr class="head"><th colspan="2">Reserve &amp; costs that grow with sales</th></tr>${model.costs.filter((c) => !c.fixed).map((c) => `<tr><td>${escape(c.label)}${c.own ? ' <small>(own)</small>' : ''}</td><td>${money(c.amount)}</td></tr>`).join('')}
            <tr class="sum"><td>Total costs</td><td>${money(model.totalCosts)}</td></tr>
            <tr class="result ${model.profit >= 0 ? 'pos' : 'neg'}"><td>${model.profit >= 0 ? 'Profit' : 'Loss'}</td><td>${profitText}</td></tr>
          </tbody></table></section>
      </div>
      <div class="fin-tip hidden" role="tooltip"></div>`;
    view.querySelectorAll(".cleanup-disclosure").forEach(node => { node.open = openSections.includes(node.querySelector("summary").textContent); });
  }

  // ---------- interaction: tooltips, crosshair, inputs, links ----------
  view.addEventListener('mousemove', (event) => {
    const tip = view.querySelector('.fin-tip');
    if (!tip) return;
    const hit = event.target.closest('.fin-hit');
    const cross = view.querySelector('.fin-cross');
    if (hit) {
      const [L, R, T, B, W, H, lo, hi, top] = hit.dataset.geo.split(',').map(Number);
      const curve = JSON.parse(hit.dataset.curve);
      const svg = hit.ownerSVGElement;
      const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const p = point.matrixTransform(svg.getScreenCTM().inverse());
      const price = Math.max(0, Math.min(top, Math.round(((p.x - L) / (W - L - R)) * top)));
      const profit = curve[price][1];
      const cx = L + (price / top) * (W - L - R);
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

  // Moving a scenario slider shows the new share right away; it is saved when the slider is let go.
  view.addEventListener('input', (event) => {
    const live = event.target.dataset && event.target.dataset.live;
    if (!live) return;
    const out = view.querySelector(`[data-live-out="${live}"]`);
    if (out) out.textContent = `${event.target.value}%`;
    const tickets = view.querySelector(`[data-scenario-tickets="${live}"]`);
    if (tickets) tickets.value = Math.round((collect().input.visitors * Number(event.target.value)) / 100);
  });

  function saveAndRender(next, focusSelector) {
    if (!save(next)) { render(); return; }
    const scroll = window.scrollY;
    render();
    window.scrollTo(0, scroll);
    if (focusSelector) view.querySelector(focusSelector)?.focus();
  }

  view.addEventListener('change', (event) => {
    const target = event.target;
    // A number of tickets for a scenario becomes its share of the expected visitors.
    if (target.dataset.scenarioTickets) {
      const field = target.dataset.scenarioTickets;
      if (!canFestival('budget')) { render(); return; }
      const visitors = collect().input.visitors;
      const tickets = Number(target.value);
      if (target.value === '' || !Number.isInteger(tickets) || tickets < 0 || tickets > visitors) {
        toast(`Please enter a whole number of tickets from 0 to ${number(visitors)}.`);
        render();
        return;
      }
      const share = Math.round((tickets / visitors) * 1000) / 10;
      // Moving "your plan" takes the bad or best case along; the two cases themselves are checked.
      const next = field === 'sellThrough' ? keepScenarioOrder({ ...settings, sellThrough: share }) : { ...settings, [field]: share };
      const problem = financeProblem(next);
      if (problem) { toast(problem); render(); return; }
      saveAndRender(next, `[data-scenario-tickets="${field}"]`);
      return;
    }
    // Your own cost and income lines.
    if (target.dataset.extra) {
      if (!canFestival('budget')) { render(); return; }
      const extras = (settings.extras || []).map((e) => (e.id === target.dataset.extra
        ? { ...e, [target.dataset.key]: target.dataset.key === 'amount' ? (target.value === '' ? '' : Number(target.value)) : target.value } : e));
      const changed = extras.find((e) => e.id === target.dataset.extra);
      const problem = changed ? financeExtraProblem(changed) : 'This line no longer exists.';
      if (problem) { toast(problem); render(); return; }
      saveAndRender({ ...settings, extras }, `[data-extra="${target.dataset.extra}"][data-key="${target.dataset.key}"]`);
      return;
    }
    const id = target.dataset.field;
    if (!id) return;
    if (!canFestival('budget')) {
      event.target.value = settings[id];
      return;
    }
    if (!validFinanceValue(id, event.target.value)) {
      const field = FINANCE_FIELDS.find((f) => f.id === id);
      toast(`${field.label}: please enter a number from ${number(field.min)} to ${number(field.max)}.`);
      event.target.value = settings[id];
      return;
    }
    const changed = { ...settings, [id]: Number(event.target.value) };
    const next = id === 'sellThrough' ? keepScenarioOrder(changed) : changed;
    const problem = financeProblem(next);
    if (problem) {
      toast(problem);
      event.target.value = settings[id];
      if (target.type === 'range') render(); // also puts the % and ticket numbers back
      return;
    }
    if (!save(next)) { event.target.value = settings[id]; return; }
    const scroll = window.scrollY;
    render();
    window.scrollTo(0, scroll);
    view.querySelector(`[data-field="${id}"][type="${target.type === 'range' ? 'range' : 'number'}"]`)?.focus();
  });

  view.addEventListener('click', (event) => {
    const add = event.target.closest('[data-extra-add]');
    const remove = event.target.closest('[data-extra-remove]');
    if ((add || remove) && !canFestival('budget')) { toast('Only Admins can change the finance assumptions.'); return; }
    if (add) {
      const extras = settings.extras || [];
      if (extras.length >= MAX_FINANCE_EXTRAS) { toast(`At most ${MAX_FINANCE_EXTRAS} own lines.`); return; }
      const kind = add.dataset.extraAdd === 'revenue' ? 'revenue' : 'cost';
      const id = `x${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`.slice(0, 21);
      const line = { id, kind, label: kind === 'cost' ? 'New cost' : 'New income', amount: 0, basis: 'total', timing: kind === 'cost' ? 'before' : 'festival' };
      saveAndRender({ ...settings, extras: [...extras, line] }, `[data-extra="${id}"][data-key="label"]`);
      return;
    }
    if (remove) {
      const extras = (settings.extras || []).filter((e) => e.id !== remove.dataset.extraRemove);
      saveAndRender({ ...settings, extras });
      toast('Line removed.');
      return;
    }
    const go = event.target.closest('[data-go]');
    if (go) { event.preventDefault(); document.querySelector(`.sidebar-item[data-section="${go.dataset.go}"]`).click(); return; }
    if (event.target.closest('[data-reset]') && canFestival('budget')) {
      if (!save({ ...DEFAULT_FINANCE })) return;
      render();
      toast('Assumptions reset to the example values.');
    }
  });

  // Left navigation: "Finances" shows this page (freshly calculated), anything else hides it.
  document.querySelectorAll('.sidebar-item').forEach((button) => button.addEventListener('click', () => {
    const onFinance = button.dataset.section === 'Finances';
    view.classList.toggle('hidden', !onFinance);
    if (onFinance) render();
  }));
})();
