# Roadmap — towards planning the perfect festival

Ideas to take Festival Architect from a planning tool to a complete festival production
system, ordered along a real festival's timeline. **Pick one, put your name in the
"Owner" column, and give it its own feature plan and branch** (see [AGENTS.md](../AGENTS.md)).

✅ = there is already a basis in the project to build on.

## Top picks (best impact for the effort)

| # | Idea | Why first | Owner |
| --- | --- | --- | --- |
| 1 | ✅ **Automatic tests on GitHub (CI) + "Load demo festival" button** | Done: tests run on every pull request; the presentation never shows an empty app | **Frederik** |
| 2 | ✅ **Readiness score + problems become tasks** | Done: Overview checks and linked task-board issues ([plan](project-planning-readiness-and-map-safety.md)) | **Kira** |
| 3 | ✅ **Crowd density + evacuation time** | Done: measured inputs and explicit planning assumptions, not safety certification ([plan](project-planning-readiness-and-map-safety.md)) | **Kira** |
| 4 | ✅ **Ticket tiers + bar revenue + cash-flow plan** | Done: finances on a professional level ([plan](finance-pro.md)) | **Frederik** |
| 5 | **"Copy for next year" + final report** | Closes the loop | |
| 6 | **Two-factor authentication (2FA)** | A second check at login (e.g. a code from an authenticator app), so a stolen password alone is not enough — important once the festival data is shared | **Amelie** |
| ✅ | **Product brief rules (team decision)** | The festivals are fictional now, so: every festival sets its own artist budget (going over it asks for confirmation), booking an artist twice is allowed after a warning, and a plan may be finalised with fewer than 4 artists. ([plan](review-followups.md)) | Team |

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
- [x] **Crowd density in front of stages** — entered usable area in m² vs. expected audience, with an editable project density limit. Done ([plan](project-planning-readiness-and-map-safety.md)).
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
- [x] **Evacuation planning estimate** — visitors, measured exit widths and reachable routes → estimated minutes, with visible editable assumptions and limitations. Done ([plan](project-planning-readiness-and-map-safety.md)).
- [ ] **Noise check** — distance from stages to neighbours and time of day → traffic light for noise limits

## 7. Vendors & sponsors

- [ ] **Vendor applications** — menu, prices, power needs; accept or decline. ✅ vendors page
- [ ] **Fee model** — fixed pitch fee **or** revenue share (e.g. 15 %); finances calculate both
- [ ] **Sponsor packages** — gold / silver / bronze with benefits (logo on stage, stand on the map, tickets) and a checklist of what each sponsor was promised

## 8. Finances (extension)

- [x] **Bar revenue** — drinks per visitor × price × margin (often the biggest income)
- [x] **Contingency** — automatic 10 % reserve
- [x] **Cash-flow plan** — account balance over the months; when are we negative because deposits are due before tickets sell?
- [ ] **Actual vs. plan** — enter real invoices; difference per cost line. ✅ finances page
- [ ] **VAT** — gross / net for tickets and costs (Portugal 6 % / 23 %)
- [x] **Secure vs. planned costs** — only confirmed bookings count as secure.

## 9. Afterwards

- [ ] **Settlement** — who still gets how much (artists, vendors, suppliers)
- [ ] **Final report** — plan vs. actual for visitors, costs, revenue and incidents; printable
- [ ] **Sustainability report** — diesel, waste and travel → CO₂ estimate
- [ ] **Copy for next year** — the whole festival as a template for 2027, dates shifted, bookings cleared

## 10. Platform

- [x] **Accounts and data on the server** — *owner: Amelie* ([login.md](login.md)). Sign in with Supabase; each account's festival is saved on the server and is the same on every device; Row Level Security keeps every festival private to its account.
- [x] **Shared festivals** — *owner: Amelie* ([shared-festivals.md](shared-festivals.md)). Invite teammates into one festival as Admin / Editor / Viewer, enforced in the database; festival switcher in the sidebar.
- [x] **Task assignments & team progress** — *owner: Amelie* ([task-assignments.md](task-assignments.md)). Admins give task groups (and single subtasks) to teammates; "Assigned to" filter on the board; Team progress on the Overview; enforced in the database.
- [ ] **Two-factor authentication (2FA)** — *owner: Amelie.* After the password, a one-time code from an authenticator app (TOTP); recovery codes in case the phone is lost; only for the shared/online mode. Needs the login from "Shared data on the server".
- [ ] **Finer roles & rights** — e.g. a booker who only edits the lineup, finance who only edits the finances. ✅ Admin / Editor / Viewer exist and are enforced in the database ([shared-festivals.md](shared-festivals.md))
- [ ] **Change log** — who changed what, when
- [x] **Readiness score** on the Overview; **problems become linked tasks** on the task board. Done ([plan](project-planning-readiness-and-map-safety.md)).
- [ ] **Languages** — English / German / Portuguese
- [ ] **CI, demo festival, export / import** of all data in one file
