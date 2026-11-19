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
  { id: 'contingency', label: 'Contingency reserve', unit: '% of fixed costs', group: 'Costs', min: 0, max: 50, step: 1, value: 10 }
];

const DEFAULT_FINANCE = Object.fromEntries(FINANCE_FIELDS.map((f) => [f.id, f.value]));

function validFinanceValue(fieldId, value) {
  const field = FINANCE_FIELDS.find((f) => f.id === fieldId);
  const number = Number(value);
  return Boolean(field) && value !== '' && Number.isFinite(number) && number >= field.min && number <= field.max;
}

// Rules across several fields: early bird and box office together cannot be more than all tickets.
function financeProblem(settings) {
  if (settings.earlyBirdShare + settings.doorShare > 100) return 'Early bird and box office tickets together cannot be more than 100 % of the tickets sold.';
  return '';
}

// Read the saved assumptions back; anything missing or out of range falls back to the default.
function parseFinance(text) {
  let saved = {};
  try { saved = JSON.parse(text) || {}; } catch { saved = {}; }
  const settings = Object.fromEntries(FINANCE_FIELDS.map((f) => [f.id, validFinanceValue(f.id, saved[f.id]) ? Number(saved[f.id]) : f.value]));
  if (financeProblem(settings)) { settings.earlyBirdShare = DEFAULT_FINANCE.earlyBirdShare; settings.doorShare = DEFAULT_FINANCE.doorShare; }
  return settings;
}

// ---------- ticket tiers ----------

// How the sold tickets split into early bird, regular and box office, with price and revenue per tier.
// Regular gets whatever is left, so the three always add up to exactly the tickets sold.
function ticketTiers(settings, ticketsSold) {
  const early = Math.round((ticketsSold * settings.earlyBirdShare) / 100);
  const door = Math.min(ticketsSold - early, Math.round((ticketsSold * settings.doorShare) / 100));
  const tiers = [
    { id: 'early', label: 'Early bird', tickets: early, price: settings.ticketPrice * (1 - settings.earlyBirdDiscount / 100) },
    { id: 'regular', label: 'Regular', tickets: ticketsSold - early - door, price: settings.ticketPrice },
    { id: 'door', label: 'Box office', tickets: door, price: settings.ticketPrice * (1 + settings.doorSurcharge / 100) }
  ];
  return tiers.map((t) => ({ ...t, price: Math.round(t.price * 100) / 100, revenue: Math.round(t.tickets * t.price) }));
}

// The average ticket price as a share of the regular price (e.g. 0.955 with the default tiers).
function averagePriceFactor(s) {
  const regularShare = Math.max(0, 100 - s.earlyBirdShare - s.doorShare);
  return (s.earlyBirdShare * (1 - s.earlyBirdDiscount / 100) + regularShare + s.doorShare * (1 + s.doorSurcharge / 100)) / 100;
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
  const ticketsSold = Math.round((input.visitors * s.sellThrough) / 100);
  const tiers = ticketTiers(s, ticketsSold);
  const ticketSales = tiers.reduce((sum, t) => sum + t.revenue, 0);
  const barSales = ticketsSold * days * s.barSpend;
  const revenue = [
    { id: 'tickets', label: 'Ticket sales', amount: ticketSales },
    { id: 'bar', label: 'Festival bars', amount: barSales },
    { id: 'sponsorship', label: 'Sponsorship', amount: s.sponsorship },
    { id: 'pitches', label: 'Vendor pitch fees', amount: input.pitchIncome }
  ];
  const fixed = [
    { id: 'artists', label: 'Artist fees', amount: input.artistFees },
    { id: 'stages', label: 'Stage production', amount: stages * days * s.stagePerDay },
    { id: 'venue', label: 'Venue, permits & insurance', amount: s.venue },
    { id: 'security', label: 'Security staff', amount: needs.securityStaff * days * s.securityPerDay },
    { id: 'toilets', label: 'Toilets', amount: needs.toiletCabins * days * s.toiletPerDay },
    { id: 'marketing', label: 'Marketing', amount: s.marketing },
    { id: 'firstAid', label: 'First aid', amount: needs.firstAiders * days * s.firstAidPerDay },
    { id: 'water', label: 'Water points', amount: needs.waterPoints * days * s.waterPerDay }
  ];
  const fixedCosts = fixed.reduce((sum, c) => sum + c.amount, 0);
  const costs = [
    ...fixed,
    { id: 'contingency', label: 'Contingency reserve', amount: Math.round((fixedCosts * s.contingency) / 100) },
    { id: 'ticketing', label: 'Ticketing fees', amount: Math.round((ticketSales * s.ticketingFee) / 100) },
    { id: 'barStock', label: 'Bar stock & staff', amount: Math.round(barSales * (1 - s.barMargin / 100)) }
  ];
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
  const profit = totalRevenue - totalCosts;

  // Break-even: everything that does not grow with tickets (fixed costs + reserve − sponsors − pitch fees)
  // has to be covered by what each ticket brings in after fees: its average price plus the bar margin.
  const gap = Math.max(0, fixedCosts + costs.find((c) => c.id === 'contingency').amount - s.sponsorship - input.pitchIncome);
  const factor = averagePriceFactor(s);
  const barPerTicket = days * s.barSpend * (s.barMargin / 100);
  const keptPerTicket = s.ticketPrice * factor * (1 - s.ticketingFee / 100) + barPerTicket;
  const breakEvenTickets = gap === 0 ? 0 : keptPerTicket > 0 ? Math.ceil(gap / keptPerTicket) : null;
  const priceGap = gap - ticketsSold * barPerTicket;
  const keptPerEuro = ticketsSold * factor * (1 - s.ticketingFee / 100);
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
function scenarios(input) {
  const cases = [
    { id: 'bad', label: 'Bad weather', sellThrough: 50 },
    { id: 'plan', label: 'Your plan', sellThrough: input.settings.sellThrough },
    { id: 'good', label: 'Sold out', sellThrough: 100 }
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
  barStock: [[0, 1]]
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
  model.revenue.filter((r) => r.id !== 'tickets').forEach((r) => rows.push({ id: r.id, label: r.label, kind: 'in', amounts: spread(r.amount, CASH_TIMING[r.id]) }));
  model.costs.filter((c) => c.id !== 'ticketing').forEach((c) => rows.push({ id: c.id, label: c.label, kind: 'out', amounts: spread(c.amount, CASH_TIMING[c.id]) }));

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
    FINANCE_STORAGE_KEY, FINANCE_FIELDS, DEFAULT_FINANCE, validFinanceValue, parseFinance, financeProblem,
    ticketTiers, averagePriceFactor, profitMatrix, CASH_MONTHS, CASH_TIMING, splitByWeight, cashFlow,
    artistSpending, financeModel, scenarios, priceCurve
  };
}
