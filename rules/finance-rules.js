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
const FINANCE_FIELDS = [
  { id: 'ticketPrice', label: 'Ticket price', unit: '€ per ticket', group: 'Revenue', min: 0, max: 500, step: 1, value: 35 },
  { id: 'sellThrough', label: 'Tickets sold', unit: '% of expected visitors', group: 'Revenue', min: 0, max: 100, step: 5, value: 80 },
  { id: 'sponsorship', label: 'Sponsorship', unit: '€ in total', group: 'Revenue', min: 0, max: 1000000, step: 500, value: 10000 },
  { id: 'stagePerDay', label: 'Stage production', unit: '€ per stage per day', group: 'Costs', min: 0, max: 100000, step: 500, value: 6000 },
  { id: 'toiletPerDay', label: 'Toilet cabin rental', unit: '€ per cabin per day', group: 'Costs', min: 0, max: 1000, step: 5, value: 90 },
  { id: 'waterPerDay', label: 'Water point', unit: '€ per point per day', group: 'Costs', min: 0, max: 5000, step: 10, value: 250 },
  { id: 'securityPerDay', label: 'Security staff', unit: '€ per person per day', group: 'Costs', min: 0, max: 1000, step: 5, value: 160 },
  { id: 'firstAidPerDay', label: 'First aider', unit: '€ per person per day', group: 'Costs', min: 0, max: 1000, step: 5, value: 140 },
  { id: 'venue', label: 'Venue, permits & insurance', unit: '€ in total', group: 'Costs', min: 0, max: 1000000, step: 500, value: 12000 },
  { id: 'marketing', label: 'Marketing', unit: '€ in total', group: 'Costs', min: 0, max: 1000000, step: 500, value: 8000 },
  { id: 'ticketingFee', label: 'Ticketing fee', unit: '% of ticket sales', group: 'Costs', min: 0, max: 30, step: 0.5, value: 5 }
];

const DEFAULT_FINANCE = Object.fromEntries(FINANCE_FIELDS.map((f) => [f.id, f.value]));

function validFinanceValue(fieldId, value) {
  const field = FINANCE_FIELDS.find((f) => f.id === fieldId);
  const number = Number(value);
  return Boolean(field) && value !== '' && Number.isFinite(number) && number >= field.min && number <= field.max;
}

// Read the saved assumptions back; anything missing or out of range falls back to the default.
function parseFinance(text) {
  let saved = {};
  try { saved = JSON.parse(text) || {}; } catch { saved = {}; }
  return Object.fromEntries(FINANCE_FIELDS.map((f) => [f.id, validFinanceValue(f.id, saved[f.id]) ? Number(saved[f.id]) : f.value]));
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
      date: b.date
    }));
  const total = shows.reduce((sum, s) => sum + s.fee, 0);
  const minutes = shows.reduce((sum, s) => sum + s.minutes, 0);
  const sumBy = (key) => shows.reduce((acc, s) => ({ ...acc, [s[key]]: (acc[s[key]] || 0) + s.fee }), {});
  return {
    total,
    budget: lineup.budget,
    budgetUsed: lineup.budget > 0 ? Math.round((total / lineup.budget) * 100) : 0,
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
function financeModel(input) {
  const { settings: s, days, stages, needs } = input;
  const ticketsSold = Math.round((input.visitors * s.sellThrough) / 100);
  const ticketSales = ticketsSold * s.ticketPrice;
  const revenue = [
    { id: 'tickets', label: 'Ticket sales', amount: ticketSales },
    { id: 'sponsorship', label: 'Sponsorship', amount: s.sponsorship },
    { id: 'pitches', label: 'Vendor pitch fees', amount: input.pitchIncome }
  ];
  const costs = [
    { id: 'artists', label: 'Artist fees', amount: input.artistFees },
    { id: 'stages', label: 'Stage production', amount: stages * days * s.stagePerDay },
    { id: 'venue', label: 'Venue, permits & insurance', amount: s.venue },
    { id: 'security', label: 'Security staff', amount: needs.securityStaff * days * s.securityPerDay },
    { id: 'toilets', label: 'Toilets', amount: needs.toiletCabins * days * s.toiletPerDay },
    { id: 'marketing', label: 'Marketing', amount: s.marketing },
    { id: 'firstAid', label: 'First aid', amount: needs.firstAiders * days * s.firstAidPerDay },
    { id: 'water', label: 'Water points', amount: needs.waterPoints * days * s.waterPerDay },
    { id: 'ticketing', label: 'Ticketing fees', amount: Math.round((ticketSales * s.ticketingFee) / 100) }
  ];
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
  const profit = totalRevenue - totalCosts;

  // Break-even: how many tickets (or which price) cover everything that does not depend on ticket sales.
  const costsWithoutFees = totalCosts - costs.find((c) => c.id === 'ticketing').amount;
  const otherRevenue = s.sponsorship + input.pitchIncome;
  const gap = Math.max(0, costsWithoutFees - otherRevenue);
  const keptPerTicket = s.ticketPrice * (1 - s.ticketingFee / 100);
  const breakEvenTickets = gap === 0 ? 0 : keptPerTicket > 0 ? Math.ceil(gap / keptPerTicket) : null;
  const breakEvenPrice = gap === 0 ? 0 : ticketsSold > 0 && s.ticketingFee < 100 ? Math.ceil(gap / (ticketsSold * (1 - s.ticketingFee / 100))) : null;

  return {
    ticketsSold, revenue, costs, totalRevenue, totalCosts, profit,
    margin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0,
    costPerVisitor: ticketsSold > 0 ? Math.round(totalCosts / ticketsSold) : null,
    breakEvenTickets,
    breakEvenReachable: breakEvenTickets !== null && breakEvenTickets <= input.visitors,
    breakEvenPrice
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

// In the browser these are plain globals; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = {
    FINANCE_STORAGE_KEY, FINANCE_FIELDS, DEFAULT_FINANCE, validFinanceValue, parseFinance,
    artistSpending, financeModel, scenarios, priceCurve
  };
}
