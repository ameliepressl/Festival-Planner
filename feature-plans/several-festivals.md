# Several festivals per account — open the demo without losing your own festival

Owner: Amelie · Branch: `feature-multiple-festivals`

## Why

Until now every account had exactly one festival (`festivals_one_per_account` in
`migrations/001`). "Load demo festival" therefore overwrote your own lineup, festival size,
vendors and finances. There was no way back except a lineup backup. For the presentation and
for trying things out we want to open the demo, look around, and go back to our real festival.

## What

- [ ] An account can own several festivals (at most 20). The database change is
      `migrations/005_several_festivals.sql`; Amelie runs it once in the Supabase SQL Editor.
- [ ] The sidebar always shows the **FESTIVAL** list when signed in (before: only with two or
      more festivals), with a **＋ New festival** button below it. A new festival starts empty
      and asks for its details on the Overview, like the very first festival.
- [ ] **Load demo festival** opens Lisbon or Munich as a **new festival** in the account. The
      festival that was open stays exactly as it was. Switch back with the FESTIVAL list.
      Because the demo no longer replaces anything, every signed-in account may open it
      (before: only creators and Admins, because it overwrote the shared festival).
- [ ] **Settings → This festival → Delete this festival**: the creator can delete a festival
      they own, as long as they still own another one. A dialog asks first. Afterwards the app
      opens their most recently changed other festival. Teammates lose access to it too.
- [ ] Before creating, opening or deleting, unsaved changes of the open festival are saved
      first (the same as switching festivals already did).
- [ ] If migration 005 has not been run yet, "New festival" and the demo show a clear message
      instead of failing silently.

## Out of scope

- Copying (duplicating) a festival, renaming it anywhere else than in the festival details.
- Two festivals open in two browser tabs at the same time: the browser holds one open festival,
  so the last one opened in any tab is the one all tabs of that browser work on after a reload.
- An undo for deleting. Deleted is gone (as before for a whole account).

## Done when

1. `uvx --from nodejs-wheel node --test` passes, with new tests for the festival list rules
   (how many own festivals, which one may be deleted, which one opens afterwards) and for the
   demo opening as a new festival. No existing test changed.
2. In a real Postgres with migrations 001–005: an account can create a second and third
   festival, not a 21st; a stranger can neither read nor delete them; members of a deleted
   festival lose it; the shared-festival rules from 003/004 still hold.
3. In the browser: open the Munich demo → it appears as a second festival, the own festival is
   unchanged in the FESTIVAL list; switch back and forth; delete the demo → back in the own
   festival.
