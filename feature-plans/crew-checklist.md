# Feature — Crew checklist

## Why

As a festival organiser, I can see for every team (security, stage building,
sound, lighting, catering, …) what still has to be done before the gates open,
tick it off, and see at a glance how ready the festival is.

## What

- [ ] A new item "Checklist" in the left navigation. Clicking it shows the
      checklist page; clicking "Lineup planner" shows the planner again.
      Task board, Site map and Vendors stay placeholders.
- [ ] The page lists 12 teams with their tasks: Security, Stage building, Sound,
      Lighting, Power & cables, Backstage & catering, Artist care & transport,
      First aid & safety, Toilets/water/waste, Tickets & entry,
      Permits & insurance, Team & radios.
- [ ] Every task can be ticked and unticked.
- [ ] At the top: a progress bar from 0 to 100 % with "x of y tasks done".
      Each team card shows its own "done/total" and turns green when complete.
- [ ] Ticks are saved in the browser and are still there after reloading.
- [ ] The list and the progress calculation live in rules/checklist-rules.js;
      the page code in checkliste-festivalplanung/. The lineup planner keeps working unchanged.

## Out of scope

- Adding, renaming or deleting tasks on the page
- Assigning tasks to people or due dates
- Sharing ticks between different computers (the browser saves them locally)

## Done when

1. `uvx --from nodejs-wheel node --test` passes all tests.
2. Nothing ticked → 0 %, "0 of 56 tasks done".
3. Ticking all 6 Sound tasks and 2 Security tasks → 14 %, "8 of 56 tasks done";
   Sound shows 6/6 and turns green, Security shows 2/6.
4. Ticking a task twice unticks it again.
5. After reloading the page the same 8 tasks are ticked and it still shows 14 %.
6. Clicking "Lineup planner" shows the planner; booking an artist still works.
