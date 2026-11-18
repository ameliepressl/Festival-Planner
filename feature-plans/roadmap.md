# Roadmap — towards planning the perfect festival

Ideas to take Festival Architect from a planning tool to a complete festival production
system, ordered along a real festival's timeline. **Pick one, put your name in the
"Owner" column, and give it its own feature plan and branch** (see [AGENTS.md](../AGENTS.md)).

✅ = there is already a basis in the project to build on.

## Top picks (best impact for the effort)

| # | Idea | Why first | Owner |
| --- | --- | --- | --- |
| 1 | **Automatic tests on GitHub (CI) + "Load demo festival" button** | Tests run on every pull request; the presentation never shows an empty app | |
| 2 | **Readiness score + problems become tasks** | One number on the Overview; every red rule turns into a task on the task board — the pages become one product | |
| 3 | **Crowd density + evacuation time** | Real safety numbers on our own map | |
| 4 | **Ticket tiers + bar revenue + cash-flow plan** | Finances on a professional level | |
| 5 | **Live mode with delays** | Useful *on* the festival day, not only before | |
| 6 | **"Copy for next year" + final report** | Closes the loop | |
| ⚠️ | **Product brief rules** | Over-budget bookings, booking an artist twice and finalising with fewer than 4 artists still differ from the brief (FA R1, FA R4, FA05). Team decision needed, because current tests expect today's behaviour. | |

---

## 1. Concept & strategy (12–9 months before)

- [ ] **Festival profile** — target group, capacity, main genres, price level; other pages use it as their defaults. ✅ "Set up festival" on the Overview
- [ ] **Date check** — public holidays and other Lisbon festivals; warning if our dates clash
- [ ] **Budget template by size** — for e.g. 5,000 visitors suggest a typical split (artists, production, security …)

## 2. Booking (9–3 months before)

- [ ] **Artist pipeline** — longlist → asked → offer → contract → paid, as columns. ✅ booking status `tentative` / `confirmed`
- [ ] **Riders** — technical rider (microphones, monitors) and hospitality rider (drinks, food) per artist; they create event-day items in the Final checklist. ✅ checklist
- [ ] **Travel & hotel** — arrival, flight, hotel nights and rooms per artist; costs go into the finances
- [ ] **Payment plan per artist** — 50 % deposit on contract, 50 % after the show, due dates in the calendar
- [ ] **Changeover rule** — at least X minutes between acts on the same stage. ✅ `changeover` field
- [ ] **Running order check** — headliner last, no genre three times in a row, energy curve of the evening

## 3. Tickets & marketing (6–0 months before)

- [ ] **Ticket tiers** — early bird / regular / box office / VIP with price, quota and sales period
- [ ] **Sales curve** — enter real weekly sales; compare with the plan and warn when behind
- [ ] **Lineup announcement waves** — wave 1 (headliners), 2, 3 with dates in the Gantt. ✅ Gantt
- [ ] **Guest list & accreditation** — press, crew, artist +1; access zones (backstage, stage, FOH); wristbands counted per colour
- [ ] **Social media texts** — announcement texts generated from the lineup

## 4. Site & production (3–0 months before)

- [ ] **Fence calculator** — metres and cost from the drawn fence. ✅ site map fence
- [ ] **Power plan** — kW per stage, food truck and light tower; generators needed; overload warning
- [ ] **Crowd density in front of stages** — area in m² vs. expected crowd; warning above 2–3 people per m². ✅ map areas + visitors
- [ ] **Signage list** — "12× toilets sign, 4× emergency exit, 6× water" with positions, generated from the map
- [ ] **Light towers** — every walkway lit after sunset
- [ ] **Accessibility** — wheelchair platform at every stage, share of accessible toilets, step-free routes; as layout rules. ✅ layout check
- [ ] **Camping & shuttle** (optional) — camping area per person, shuttle runs per hour from the visitor number

## 5. Staff & volunteers

- [ ] **Shift plan** — security, first aid, bar, entry in 4-hour shifts; numbers from the festival size. ✅ `capacityNeeds`
- [ ] **Volunteers** — name, availability, preferred area, automatic assignment
- [ ] **Crew catering** — people × shifts = meals and cost
- [ ] **Radio channels & contact list** — printed for the briefing

## 6. Safety & permits

- [ ] **Permit tracker** — event, noise, alcohol, fire safety: authority, deadline, status; deadlines in the Gantt
- [ ] **Risk matrix** — likelihood × impact, colour-coded, with measure and responsible team
- [ ] **Weather thresholds** — e.g. stop the stage above a set wind speed; clear procedure for the crew
- [ ] **Evacuation calculator** — visitors, exit width and walking routes → minutes until everyone is out. ✅ walkway routing
- [ ] **Noise check** — distance from stages to neighbours and time of day → traffic light for noise limits

## 7. Vendors & sponsors

- [ ] **Vendor applications** — menu, prices, power needs; accept or decline. ✅ vendors page
- [ ] **Fee model** — fixed pitch fee **or** revenue share (e.g. 15 %); finances calculate both
- [ ] **Sponsor packages** — gold / silver / bronze with benefits (logo on stage, stand on the map, tickets) and a checklist of what each sponsor was promised

## 8. Finances (extension)

- [ ] **Bar revenue** — drinks per visitor × price × margin (often the biggest income)
- [ ] **Contingency** — automatic 10 % reserve
- [ ] **Cash-flow plan** — account balance over the months; when are we negative because deposits are due before tickets sell?
- [ ] **Actual vs. plan** — enter real invoices; difference per cost line. ✅ finances page
- [ ] **VAT** — gross / net for tickets and costs (Portugal 6 % / 23 %)
- [ ] **Secure vs. planned costs** — only confirmed bookings count as secure. ✅ booking status

## 9. Festival day — live mode

- [ ] **Now / next screen** — who is playing, countdown to the next act; full screen for backstage
- [ ] **Delays ripple through** — act starts 10 minutes late → following acts on that stage move, with conflict warnings
- [ ] **Incident log** — time, place on the map, type (medical, security, technical), status; shown as dots on the map
- [ ] **Visitor counter** — in / out → people on site now; warning close to capacity
- [ ] **Final checklist on the day.** ✅ exists

## 10. Afterwards

- [ ] **Settlement** — who still gets how much (artists, vendors, suppliers)
- [ ] **Final report** — plan vs. actual for visitors, costs, revenue and incidents; printable
- [ ] **Sustainability report** — diesel, waste and travel → CO₂ estimate
- [ ] **Copy for next year** — the whole festival as a template for 2027, dates shifted, bookings cleared

## 11. Platform

- [ ] **Shared data on the server** — the same festival from every device (today it lives in each browser's localStorage)
- [ ] **Roles & rights** — booker edits the lineup, finance edits the finances, everyone can read. ✅ `rules/access-rules.js`
- [ ] **Change log** — who changed what, when
- [ ] **Readiness score** on the Overview; **problems become tasks** on the task board
- [ ] **Languages** — English / German / Portuguese
- [ ] **CI, demo festival, export / import** of all data in one file
