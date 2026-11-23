// Festival Architect — the financial overview: revenue, costs, profit, break-even, scenarios and
// price sensitivity, plus an analysis of the artist spending.
// Only data and calculations live here (no screen code), so they can be tested (tests/) and used by
// finance/finance-page.js.
//
// Where the numbers come from:
//   - artist fees: the lineup planner (the booked performances)
//   - pitch income: the Vendors page (confirmed vendors)
//   - visitors, toilets, water points, first aiders, security: the festival size (rules/capacity-rules.js)
//   - everything else: the assumptions below, which the organiser can change on the page

const FINANCE_STORAGE_KEY = 'festival-architect-finance';

// The assumptions, with a label, a unit and the allowed range. All money in euros.
// group = where the field appears on the page (Tickets / Bar & sponsors / Costs).
const FINANCE_FIELDS = [
  { id: 'ticketPrice', label: 'Regular ticket price', unit: '€ per ticket', group: 'Tickets', min: 0, max: 500, step: 1, value: 35 },
  { id: 'sellThrough', label: 'Tickets sold', unit: '% of expected visitors', group: 'Tickets', min: 0, max: 100, step: 5, value: 80 },
  { id: 'earlyBirdShare', label: 'Early bird tickets', unit: '% of tickets sold', group: 'Tickets', min: 0, max: 100, step: 5, value: 30 },
  { id: 'earlyBirdDiscount', label: 'Early bird discount', unit: '% below regular', group: 'Tickets', min: 0, max: 90, step: 5, value: 20 },
  { id: 'doorShare', label: 'Box office tickets', unit: '% of tickets sold', group: 'Tickets', min: 0, max: 100, step: 5, value: 10 },
  { id: 'doorSurcharge', label: 'Box office surcharge', unit: '% above regular', group: 'Tickets', min: 0, max: 100, step: 5, value: 15 },
  { id: 'barSpend', label: 'Bar spend', unit: '€ per visitor per day', group: 'Bar & sponsors', min: 0, max: 200, step: 1, value: 12 },
  { id: 'barMargin', label: 'Bar margin', unit: '% kept after stock & staff', group: 'Bar & sponsors', min: 0, max: 100, step: 5, value: 50 },
  { id: 'sponsorship', label: 'Sponsorship', unit: '€ in total', group: 'Bar & sponsors', min: 0, max: 1000000, step: 500, value: 10000 },
  { id: 'stagePerDay', label: 'Stage production', unit: '€ per stage per day', group: 'Costs', min: 0, max: 100000, step: 500, value: 6000 },
  { id: 'toiletPerDay', label: 'Toilet cabin rental', unit: '€ per cabin per day', group: 'Costs', min: 0, max: 1000, step: 5, value: 90 },
  { id: 'waterPerDay', label: 'Water point', unit: '€ per point per day', group: 'Costs', min: 0, max: 5000, step: 10, value: 250 },
  { id: 'securityPerDay', label: 'Security staff', unit: '€ per person per day', group: 'Costs', min: 0, max: 1000, step: 5, value: 160 },
  { id: 'firstAidPerDay', label: 'First aider', unit: '€ per person per day', group: 'Costs', min: 0, max: 1000, step: 5, value: 140 },
  { id: 'venue', label: 'Venue, permits & insurance', unit: '€ in total', group: 'Costs', min: 0, max: 1000000, step: 500, value: 12000 },
  { id: 'marketing', label: 'Marketing', unit: '€ in total', group: 'Costs', min: 0, max: 1000000, step: 500, value: 8000 },
  { id: 'ticketingFee', label: 'Ticketing fee', unit: '% of ticket sales', group: 'Costs', min: 0, max: 30, step: 0.5, value: 5 },
  { id: 'contingency', label: 'Contingency reserve', unit: '% of fixed costs', group: 'Costs', min: 0, max: 50, step: 1, value: 10 },
  // Additional assumptions. They start at 0, so a plan without them calculates exactly as before.
  { id: 'vipShare', label: 'VIP tickets', unit: '% of tickets sold', group: 'Additional', sub: 'Tickets', min: 0, max: 50, step: 1, value: 0 },
  { id: 'vipSurcharge', label: 'VIP price', unit: '% above regular', group: 'Additional', sub: 'Tickets', min: 0, max: 500, step: 10, value: 100 },
  { id: 'guestShare', label: 'Guest list (free tickets)', unit: '% of tickets: crew, press, winners', group: 'Additional', sub: 'Tickets', min: 0, max: 30, step: 1, value: 0 },
  { id: 'ticketVat', label: 'VAT on tickets', unit: '% included in the ticket price', group: 'Additional', sub: 'Tickets', min: 0, max: 30, step: 1, value: 0 },
  { id: 'musicLicence', label: 'Music licence (e.g. GEMA)', unit: '% of net ticket sales', group: 'Additional', sub: 'Tickets', min: 0, max: 20, step: 0.5, value: 0 },
  { id: 'merchSpend', label: 'Merch spend', unit: '€ per visitor', group: 'Additional', sub: 'Income', min: 0, max: 200, step: 1, value: 0 },
  { id: 'merchMargin', label: 'Merch margin', unit: '% kept after stock', group: 'Additional', sub: 'Income', min: 0, max: 100, step: 5, value: 40 },
  { id: 'grants', label: 'Public funding & grants', unit: '€ in total', group: 'Additional', sub: 'Income', min: 0, max: 1000000, step: 500, value: 0 },
  { id: 'powerPerDay', label: 'Power & generators', unit: '€ per day', group: 'Additional', sub: 'Costs', min: 0, max: 100000, step: 100, value: 0 },
  { id: 'crewPerDay', label: 'Production crew & volunteers', unit: '€ per day', group: 'Additional', sub: 'Costs', min: 0, max: 200000, step: 100, value: 0 },
  { id: 'cleaningPerVisitor', label: 'Cleaning & waste', unit: '€ per visitor per day', group: 'Additional', sub: 'Costs', min: 0, max: 50, step: 0.1, value: 0 },
  { id: 'hospitality', label: 'Artist travel & hospitality', unit: '% of artist fees', group: 'Additional', sub: 'Costs', min: 0, max: 100, step: 1, value: 0 },
  // Ticket sales in the two other scenarios (the plan uses "Tickets sold" above).
  { id: 'badSellThrough', label: 'Bad case: tickets sold', unit: '% of expected visitors', group: 'Scenarios', min: 0, max: 100, step: 1, value: 50 },
  { id: 'goodSellThrough', label: 'Best case: tickets sold', unit: '% of expected visitors', group: 'Scenarios', min: 0, max: 100, step: 1, value: 100 }
];

// Your own cost and income lines ("Additional assumptions"). basis says what the amount is per;
// timing says when it is paid (for the cash-flow plan).
const EXTRA_KINDS = ['cost', 'revenue'];
const EXTRA_BASES = [
  { id: 'total', label: 'in total' }, { id: 'perDay', label: 'per day' },
  { id: 'perVisitor', label: 'per visitor' }, { id: 'perVisitorDay', label: 'per visitor per day' }
];
const EXTRA_TIMINGS = [
  { id: 'before', label: 'before the festival', months: [[-3, 1], [-2, 1], [-1, 1]] },
  { id: 'festival', label: 'at the festival', months: [[0, 1]] },
  { id: 'after', label: 'after the festival', months: [[1, 1]] }
];
const MAX_FINANCE_EXTRAS = 30;
const MAX_EXTRA_AMOUNT = 5000000;

// Check one own line. Returns '' or one sentence that says what to change.
function financeExtraProblem(extra) {
  const e = extra && typeof extra === 'object' ? extra : {};
  const label = typeof e.label === 'string' ? e.label.trim() : '';
  if (label.length < 2 || label.length > 60) return 'Give the line a name of 2–60 characters.';
  if (!EXTRA_KINDS.includes(e.kind)) return 'Choose cost or income.';
  const amount = e.amount === '' || e.amount === null || typeof e.amount === 'boolean' ? NaN : Number(e.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_EXTRA_AMOUNT) return `${label}: enter an amount from €0 to €${MAX_EXTRA_AMOUNT.toLocaleString('en-GB')}.`;
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return `${label}: use at most two decimals.`;
  if (!EXTRA_BASES.some((b) => b.id === e.basis)) return `${label}: choose what the amount is per.`;
  if (!EXTRA_TIMINGS.some((t) => t.id === e.timing)) return `${label}: choose when it is paid.`;
  return '';
}

// Read the saved own lines back; broken, doubled or extra lines are dropped.
function parseFinanceExtras(list) {
  if (!Array.isArray(list)) return [];
  const result = [];
  for (const e of list.slice(0, MAX_FINANCE_EXTRAS)) {
    if (!e || typeof e.id !== 'string' || !/^x[a-z0-9]{1,20}$/.test(e.id) || result.some((r) => r.id === e.id) || financeExtraProblem(e)) continue;
    result.push({ id: e.id, kind: e.kind, label: e.label.trim(), amount: Number(e.amount), basis: e.basis, timing: e.timing });
  }
  return result;
}

// The total of one own line for this festival (per day / per visitor multiply).
function extraTotal(extra, days, visitors) {
  const factor = { total: 1, perDay: days, perVisitor: visitors, perVisitorDay: visitors * days }[extra.basis] || 1;
  return Math.round(extra.amount * factor);
}

const DEFAULT_FINANCE = { ...Object.fromEntries(FINANCE_FIELDS.map((f) => [f.id, f.value])), extras: [] };

// Example defaults above still belong to the demos and older saved assumptions.
// A newly created festival gets its own complete, zero-valued finance section instead.
function emptyFinance() {
  return { ...Object.fromEntries(FINANCE_FIELDS.map((field) => [field.id, 0])), extras: [] };
}

// Called only when creating a festival, never when loading one. Explicit sections
// (including demo finances or an imported plan) always take priority.
function withStartingFinance(sections = {}) {
  return { [FINANCE_STORAGE_KEY]: JSON.stringify(emptyFinance()), ...sections };
}

// An untouched plan has no meaningful price comparison or break-even forecast yet.
// Real bookings and vendor fees count even before any assumptions are entered.
function hasFinanceValues({ settings, artistFees = 0, pitchIncome = 0 }) {
  return FINANCE_FIELDS.some((field) => settings[field.id] > 0)
    || (settings.extras || []).some((line) => line.amount > 0)
    || artistFees > 0 || pitchIncome > 0;
}

function validFinanceValue(fieldId, value) {
  const field = FINANCE_FIELDS.find((f) => f.id === fieldId);
  const number = Number(value);
  return Boolean(field) && value !== '' && Number.isFinite(number) && number >= field.min && number <= field.max;
}

// Rules across several fields: early bird and box office together cannot be more than all tickets.
function financeProblem(settings) {
  const shares = settings.earlyBirdShare + settings.doorShare + (settings.vipShare || 0) + (settings.guestShare || 0);
  if (shares > 100) return 'Early bird, box office, VIP and guest-list tickets together cannot be more than 100 % of the tickets sold.';
  const bad = settings.badSellThrough ?? 50;
  const good = settings.goodSellThrough ?? 100;
  if (bad > good) return 'The bad case cannot sell more tickets than the best case.';
  if (bad > settings.sellThrough) return `The bad case cannot sell more tickets than your plan (${settings.sellThrough} %).`;
  if (good < settings.sellThrough) return `The best case cannot sell fewer tickets than your plan (${settings.sellThrough} %).`;
  return '';
}

// When "your plan" moves past the bad or best case, that case moves with it, so the order
// bad case <= your plan <= best case always holds without blocking the organiser.
function keepScenarioOrder(settings) {
  const next = { ...settings };
  if ((next.badSellThrough ?? 50) > next.sellThrough) next.badSellThrough = next.sellThrough;
  if ((next.goodSellThrough ?? 100) < next.sellThrough) next.goodSellThrough = next.sellThrough;
  return next;
}

// Read the saved assumptions back; anything missing or out of range falls back to the default.
function parseFinance(text) {
  let saved = {};
  try { saved = JSON.parse(text) || {}; } catch { saved = {}; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const settings = Object.fromEntries(FINANCE_FIELDS.map((f) => [f.id, validFinanceValue(f.id, saved[f.id]) ? Number(saved[f.id]) : f.value]));
  // Scenarios: a bad case above the best case falls back to the defaults; then the cases follow
  // the plan (older saves), and the plan itself is never changed.
  if (settings.badSellThrough > settings.goodSellThrough) {
    settings.badSellThrough = DEFAULT_FINANCE.badSellThrough;
    settings.goodSellThrough = DEFAULT_FINANCE.goodSellThrough;
  }
  Object.assign(settings, keepScenarioOrder(settings));
  // Ticket shares that add up to more than 100 % fall back to the defaults.
  if (financeProblem(settings)) {
    ['earlyBirdShare', 'doorShare', 'vipShare', 'guestShare'].forEach((id) => { settings[id] = DEFAULT_FINANCE[id]; });
  }
  settings.extras = parseFinanceExtras(saved.extras);
  return settings;
}

// ---------- ticket tiers ----------

// How the sold tickets split into early bird, regular and box office, with price and revenue per tier.
// Regular gets whatever is left, so the three always add up to exactly the tickets sold.
// VIP and guest-list tiers only appear when they are used.
function ticketTiers(settings, ticketsSold) {
  const share = (value) => Math.round((ticketsSold * (value || 0)) / 100);
  const early = share(settings.earlyBirdShare);
  const door = Math.min(ticketsSold - early, share(settings.doorShare));
  const vip = Math.min(ticketsSold - early - door, share(settings.vipShare));
  const guest = Math.min(ticketsSold - early - door - vip, share(settings.guestShare));
  const tiers = [
    { id: 'early', label: 'Early bird', tickets: early, price: settings.ticketPrice * (1 - settings.earlyBirdDiscount / 100) },
    { id: 'regular', label: 'Regular', tickets: ticketsSold - early - door - vip - guest, price: settings.ticketPrice },
    { id: 'door', label: 'Box office', tickets: door, price: settings.ticketPrice * (1 + settings.doorSurcharge / 100) }
  ];
  if (settings.vipShare > 0) tiers.push({ id: 'vip', label: 'VIP', tickets: vip, price: settings.ticketPrice * (1 + (settings.vipSurcharge || 0) / 100) });
  if (settings.guestShare > 0) tiers.push({ id: 'guest', label: 'Guest list (free)', tickets: guest, price: 0 });
  return tiers.map((t) => ({ ...t, price: Math.round(t.price * 100) / 100, revenue: Math.round(t.tickets * t.price) }));
}

// The average ticket price as a share of the regular price (e.g. 0.955 with the default tiers).
function averagePriceFactor(s) {
  const vip = s.vipShare || 0; const guest = s.guestShare || 0;
  const regularShare = Math.max(0, 100 - s.earlyBirdShare - s.doorShare - vip - guest);
  return (s.earlyBirdShare * (1 - s.earlyBirdDiscount / 100) + regularShare + s.doorShare * (1 + s.doorSurcharge / 100)
    + vip * (1 + (s.vipSurcharge || 0) / 100)) / 100;
}

// ---------- artist spending (from the lineup planner) ----------

// lineup = { bookings, artists, budget }. Calendar blocks (type 'block') cost nothing and are skipped.
function artistSpending(lineup) {
  const byId = Object.fromEntries(lineup.artists.map((a) => [a.id, a]));
  const shows = lineup.bookings.filter((b) => b.type !== 'block' && byId[b.artistId])
    .map((b) => ({
      name: byId[b.artistId].name,
      fee: b.fee ?? byId[b.artistId].fee,
      minutes: b.duration ?? byId[b.artistId].duration,
      stage: b.stage,
      date: b.date,
      confirmed: b.status === 'confirmed'
    }));
  const total = shows.reduce((sum, s) => sum + s.fee, 0);
  const minutes = shows.reduce((sum, s) => sum + s.minutes, 0);
  const sumBy = (key) => shows.reduce((acc, s) => ({ ...acc, [s[key]]: (acc[s[key]] || 0) + s.fee }), {});
  return {
    total,
    budget: lineup.budget,
    budgetUsed: lineup.budget > 0 ? Math.round((total / lineup.budget) * 100) : 0,
    // Secure = contract confirmed; planned = still tentative and could change or fall away.
    confirmedFees: shows.filter((s) => s.confirmed).reduce((sum, s) => sum + s.fee, 0),
    tentativeFees: shows.filter((s) => !s.confirmed).reduce((sum, s) => sum + s.fee, 0),
    performances: shows.length,
    averageFee: shows.length ? Math.round(total / shows.length) : 0,
    costPerHour: minutes ? Math.round((total / minutes) * 60) : 0,
    byStage: sumBy('stage'),
    byDay: sumBy('date'),
    top: [...shows].sort((a, b) => b.fee - a.fee).slice(0, 5)
  };
}

// ---------- the profit and loss model ----------

// input = { settings, visitors, days, stages, needs, artistFees, pitchIncome }
// Fixed costs do not depend on how many tickets sell; ticketing fees and bar stock grow with every ticket.
function financeModel(input) {
  const { settings: s, days, stages, needs } = input;
  const extras = Array.isArray(s.extras) ? s.extras : [];
  const num = (value) => (Number.isFinite(value) ? value : 0);
  const ticketsSold = Math.round((input.visitors * s.sellThrough) / 100);
  const tiers = ticketTiers(s, ticketsSold);
  const ticketSales = tiers.reduce((sum, t) => sum + t.revenue, 0);
  const barSales = ticketsSold * days * s.barSpend;
  const merchSales = Math.round(ticketsSold * num(s.merchSpend));
  const extraLines = (kind) => extras.filter((e) => e.kind === kind).map((e) => ({
    id: `extra-${e.id}`, label: e.label, amount: extraTotal(e, days, ticketsSold), own: true,
    fixed: e.basis === 'total' || e.basis === 'perDay', timing: (EXTRA_TIMINGS.find((t) => t.id === e.timing) || EXTRA_TIMINGS[1]).months
  }));
  const optional = (lines) => lines.filter((line) => line.amount > 0);
  const revenue = [
    { id: 'tickets', label: 'Ticket sales', amount: ticketSales },
    { id: 'bar', label: 'Festival bars', amount: barSales },
    { id: 'sponsorship', label: 'Sponsorship', amount: s.sponsorship },
    { id: 'pitches', label: 'Vendor pitch fees', amount: input.pitchIncome },
    ...optional([
      { id: 'merch', label: 'Merchandise', amount: merchSales },
      { id: 'grants', label: 'Public funding & grants', amount: num(s.grants) }
    ]),
    ...extraLines('revenue')
  ];
  const fixed = [
    { id: 'artists', label: 'Artist fees', amount: input.artistFees, fixed: true },
    { id: 'stages', label: 'Stage production', amount: stages * days * s.stagePerDay, fixed: true },
    { id: 'venue', label: 'Venue, permits & insurance', amount: s.venue, fixed: true },
    { id: 'security', label: 'Security staff', amount: needs.securityStaff * days * s.securityPerDay, fixed: true },
    { id: 'toilets', label: 'Toilets', amount: needs.toiletCabins * days * s.toiletPerDay, fixed: true },
    { id: 'marketing', label: 'Marketing', amount: s.marketing, fixed: true },
    { id: 'firstAid', label: 'First aid', amount: needs.firstAiders * days * s.firstAidPerDay, fixed: true },
    { id: 'water', label: 'Water points', amount: needs.waterPoints * days * s.waterPerDay, fixed: true },
    ...optional([
      { id: 'hospitality', label: 'Artist travel & hospitality', amount: Math.round((input.artistFees * num(s.hospitality)) / 100), fixed: true },
      { id: 'power', label: 'Power & generators', amount: days * num(s.powerPerDay), fixed: true },
      { id: 'crew', label: 'Production crew & volunteers', amount: days * num(s.crewPerDay), fixed: true }
    ]),
    ...extraLines('cost').filter((line) => line.fixed)
  ];
  const fixedCosts = fixed.reduce((sum, c) => sum + c.amount, 0);
  const vatShare = num(s.ticketVat) / 100;
  const ticketVat = Math.round(ticketSales - ticketSales / (1 + vatShare));
  const costs = [
    ...fixed,
    { id: 'contingency', label: 'Contingency reserve', amount: Math.round((fixedCosts * s.contingency) / 100) },
    { id: 'ticketing', label: 'Ticketing fees', amount: Math.round((ticketSales * s.ticketingFee) / 100) },
    { id: 'barStock', label: 'Bar stock & staff', amount: Math.round(barSales * (1 - s.barMargin / 100)) },
    ...optional([
      { id: 'ticketVat', label: 'VAT on tickets', amount: ticketVat },
      { id: 'licence', label: 'Music licence', amount: Math.round(((ticketSales - ticketVat) * num(s.musicLicence)) / 100) },
      { id: 'merchStock', label: 'Merch stock', amount: Math.round(merchSales * (1 - num(s.merchMargin) / 100)) },
      { id: 'cleaning', label: 'Cleaning & waste', amount: Math.round(ticketsSold * days * num(s.cleaningPerVisitor)) }
    ]),
    ...extraLines('cost').filter((line) => !line.fixed)
  ];
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
  const profit = totalRevenue - totalCosts;

  // Break-even: everything that does not grow with tickets (fixed costs + reserve − fixed income)
  // has to be covered by what each ticket brings in after fees, taxes and per-visitor costs.
  const perVisitorExtra = (kind) => extras.filter((e) => e.kind === kind && (e.basis === 'perVisitor' || e.basis === 'perVisitorDay'))
    .reduce((sum, e) => sum + e.amount * (e.basis === 'perVisitorDay' ? days : 1), 0);
  const fixedIncome = s.sponsorship + input.pitchIncome + num(s.grants)
    + extras.filter((e) => e.kind === 'revenue' && (e.basis === 'total' || e.basis === 'perDay')).reduce((sum, e) => sum + extraTotal(e, days, 0), 0);
  const gap = Math.max(0, fixedCosts + costs.find((c) => c.id === 'contingency').amount - fixedIncome);
  const factor = averagePriceFactor(s);
  const keptShare = 1 - s.ticketingFee / 100 - (vatShare + num(s.musicLicence) / 100) / (1 + vatShare);
  const barPerTicket = days * s.barSpend * (s.barMargin / 100) + num(s.merchSpend) * (num(s.merchMargin) / 100)
    - days * num(s.cleaningPerVisitor) + perVisitorExtra('revenue') - perVisitorExtra('cost');
  const keptPerTicket = s.ticketPrice * factor * keptShare + barPerTicket;
  const breakEvenTickets = gap === 0 ? 0 : keptPerTicket > 0 ? Math.ceil(gap / keptPerTicket) : null;
  const priceGap = gap - ticketsSold * barPerTicket;
  const keptPerEuro = ticketsSold * factor * keptShare;
  const breakEvenPrice = gap === 0 || priceGap <= 0 ? 0 : keptPerEuro > 0 ? Math.ceil(priceGap / keptPerEuro) : null;

  return {
    ticketsSold, tiers, revenue, costs, fixedCosts, totalRevenue, totalCosts, profit,
    averageTicketPrice: ticketsSold > 0 ? Math.round((ticketSales * 100) / ticketsSold) / 100 : 0, // ×100 first avoids 33.42499… rounding errors
    margin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0,
    costPerVisitor: ticketsSold > 0 ? Math.round(totalCosts / ticketsSold) : null,
    revenuePerVisitor: ticketsSold > 0 ? Math.round(totalRevenue / ticketsSold) : null,
    profitPerVisitor: ticketsSold > 0 ? Math.round(profit / ticketsSold) : null,
    breakEvenTickets,
    breakEvenReachable: breakEvenTickets !== null && breakEvenTickets <= input.visitors,
    breakEvenPrice,
    // How many of the planned tickets may fall away before the festival makes a loss.
    safetyMargin: breakEvenTickets !== null && ticketsSold > 0 ? Math.round(((ticketsSold - breakEvenTickets) / ticketsSold) * 100) : null
  };
}

// What if fewer or more tickets sell? Three standard cases plus the organiser's own assumption.
// The organiser sets the ticket sales of each case (badSellThrough / sellThrough / goodSellThrough).
function scenarios(input) {
  const bad = input.settings.badSellThrough ?? 50;
  const good = input.settings.goodSellThrough ?? 100;
  const cases = [
    { id: 'bad', field: 'badSellThrough', label: 'Bad case', sellThrough: bad },
    { id: 'plan', field: 'sellThrough', label: 'Your plan', sellThrough: input.settings.sellThrough },
    { id: 'good', field: 'goodSellThrough', label: good === 100 ? 'Sold out' : 'Best case', sellThrough: good }
  ];
  return cases.map((c) => {
    const model = financeModel({ ...input, settings: { ...input.settings, sellThrough: c.sellThrough } });
    return { ...c, ticketsSold: model.ticketsSold, revenue: model.totalRevenue, costs: model.totalCosts, profit: model.profit };
  });
}

// Profit at different ticket prices (everything else unchanged), for the price chart.
function priceCurve(input, from, to, step) {
  const points = [];
  for (let price = from; price <= to; price += step) {
    points.push({ price, profit: financeModel({ ...input, settings: { ...input.settings, ticketPrice: price } }).profit });
  }
  return points;
}

// Profit for every combination of regular ticket price and tickets sold, for the profit matrix.
function profitMatrix(input, prices, sellThroughs) {
  return prices.map((price) => ({
    price,
    cells: sellThroughs.map((sellThrough) => ({
      sellThrough,
      profit: financeModel({ ...input, settings: { ...input.settings, ticketPrice: price, sellThrough } }).profit
    }))
  }));
}

// ---------- cash-flow plan ----------

// Profit says whether the festival pays off in the end; cash flow says whether there is enough money in
// the account on the way there. Deposits and the venue are due months before most tickets are sold.
// The months run from 6 months before the festival to the month after (invoices that arrive late).
const CASH_MONTHS = [
  { offset: -6, label: '6 months before', short: '−6' },
  { offset: -5, label: '5 months before', short: '−5' },
  { offset: -4, label: '4 months before', short: '−4' },
  { offset: -3, label: '3 months before', short: '−3' },
  { offset: -2, label: '2 months before', short: '−2' },
  { offset: -1, label: '1 month before', short: '−1' },
  { offset: 0, label: 'Festival month', short: 'Festival' },
  { offset: 1, label: 'Month after', short: 'After' }
];

// When each line of the profit and loss model is paid or received: [month offset, weight].
// Typical timing for a festival; the weights say how an amount is split over its months.
const CASH_TIMING = {
  early: [[-6, 1], [-5, 1], [-4, 1]],       // early bird tickets sell in the first three months
  regular: [[-3, 1], [-2, 1], [-1, 1]],     // regular tickets in the three months before
  door: [[0, 1]],                           // box office at the festival
  bar: [[0, 1]],
  sponsorship: [[-5, 1], [0, 1]],           // half when the contract is signed, half at the festival
  pitches: [[-2, 1]],                       // vendors pay their pitch before the festival
  artists: [[-4, 1], [0, 1]],               // 50 % deposit when booking, the rest on the day
  stages: [[-2, 3], [0, 7]],                // 30 % deposit, 70 % at the festival
  venue: [[-6, 1]],                         // venue, permits and insurance are paid first
  marketing: [[-5, 1], [-4, 1], [-3, 1], [-2, 1], [-1, 1]],
  security: [[0, 1]],
  firstAid: [[0, 1]],
  toilets: [[1, 1]],                        // rental invoices arrive after the festival
  water: [[1, 1]],
  contingency: [[0, 1]],                    // the reserve is counted as spent at the festival
  barStock: [[0, 1]],
  vip: [[-4, 1], [-3, 1], [-2, 1]],         // VIP packages sell with the regular tickets, a bit earlier
  guest: [[0, 1]],
  merch: [[0, 1]],
  grants: [[-4, 1]],                        // funding is usually paid out before the festival
  hospitality: [[0, 1]],
  power: [[-1, 1], [0, 1]],
  crew: [[0, 1]],
  ticketVat: [[0, 1]],                      // VAT is passed on to the tax office around the festival
  licence: [[1, 1]],                        // licence invoices arrive afterwards
  merchStock: [[-1, 1]],
  cleaning: [[1, 1]]
};

// Split an amount over months by weight. Whole euros; the last month takes the rounding rest,
// so the parts always add up to exactly the amount.
function splitByWeight(amount, timing) {
  const total = timing.reduce((sum, [, w]) => sum + w, 0);
  let given = 0;
  return timing.map(([offset, weight], i) => {
    const part = i === timing.length - 1 ? amount - given : Math.round((amount * weight) / total);
    given += part;
    return [offset, part];
  });
}

// model = the result of financeModel, ticketingFee = the % from the assumptions.
// Returns one row per money line (in or out, per month), the months with inflow, outflow, net and the
// running balance (starting from €0), and the lowest balance: if it is below zero, that is how much
// starting money or credit the festival needs before the ticket money arrives.
function cashFlow(model, ticketingFee) {
  const index = Object.fromEntries(CASH_MONTHS.map((m, i) => [m.offset, i]));
  const spread = (amount, timing) => {
    const amounts = CASH_MONTHS.map(() => 0);
    splitByWeight(amount, timing).forEach(([offset, part]) => { amounts[index[offset]] += part; });
    return amounts;
  };
  const rows = [];
  model.tiers.forEach((t) => rows.push({ id: `tickets-${t.id}`, label: `${t.label} tickets`, kind: 'in', amounts: spread(t.revenue, CASH_TIMING[t.id]) }));
  model.revenue.filter((r) => r.id !== 'tickets').forEach((r) => rows.push({ id: r.id, label: r.label, kind: 'in', amounts: spread(r.amount, r.timing || CASH_TIMING[r.id]) }));
  model.costs.filter((c) => c.id !== 'ticketing').forEach((c) => rows.push({ id: c.id, label: c.label, kind: 'out', amounts: spread(c.amount, c.timing || CASH_TIMING[c.id]) }));

  // The ticketing fee is paid in the same months as the ticket sales; the last sales month takes the
  // rounding rest, so the fees add up to exactly the model's ticketing cost.
  const ticketIn = CASH_MONTHS.map((m, i) => rows.filter((r) => r.id.startsWith('tickets-')).reduce((sum, r) => sum + r.amounts[i], 0));
  const ticketingTotal = model.costs.find((c) => c.id === 'ticketing').amount;
  const lastSale = ticketIn.reduce((last, v, i) => (v > 0 ? i : last), CASH_MONTHS.length - 1);
  let feeGiven = 0;
  const fees = ticketIn.map((v, i) => {
    const part = i === lastSale ? ticketingTotal - feeGiven : Math.round((v * ticketingFee) / 100);
    feeGiven += part;
    return part;
  });
  rows.push({ id: 'ticketing', label: 'Ticketing fees', kind: 'out', amounts: fees });

  let balance = 0;
  const months = CASH_MONTHS.map((m, i) => {
    const inflow = rows.filter((r) => r.kind === 'in').reduce((sum, r) => sum + r.amounts[i], 0);
    const outflow = rows.filter((r) => r.kind === 'out').reduce((sum, r) => sum + r.amounts[i], 0);
    balance += inflow - outflow;
    return { ...m, inflow, outflow, net: inflow - outflow, balance };
  });
  const lowest = months.reduce((low, m) => (m.balance < low.balance ? m : low), months[0]);
  const highest = months.reduce((high, m) => (m.balance > high.balance ? m : high), months[0]);
  return {
    rows,
    months,
    lowestBalance: lowest.balance,
    lowestMonth: lowest.label,
    highestBalance: highest.balance,
    highestMonth: highest.label,
    cashNeeded: Math.max(0, -lowest.balance),
    finalBalance: balance // always equals the profit: every euro of the model is paid or received in some month
  };
}

// In the browser these are plain globals; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = {
    FINANCE_STORAGE_KEY, FINANCE_FIELDS, DEFAULT_FINANCE, emptyFinance, withStartingFinance, hasFinanceValues,
    validFinanceValue, parseFinance, financeProblem,
    ticketTiers, averagePriceFactor, profitMatrix, CASH_MONTHS, CASH_TIMING, splitByWeight, cashFlow,
    artistSpending, financeModel, scenarios, priceCurve,
    EXTRA_KINDS, EXTRA_BASES, EXTRA_TIMINGS, MAX_FINANCE_EXTRAS, financeExtraProblem, parseFinanceExtras, extraTotal, keepScenarioOrder
  };
}
