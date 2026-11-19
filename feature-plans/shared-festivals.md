# Shared festivals — several people plan one festival

Owner: Amelie · Branch: `feature-shared-festivals` (builds on `feature-login`, PR #17)

## Why

A real festival is planned by a team. With the login (feature-plans/login.md) every account
has its own festival, but nobody can work on someone else's. Kira's Team form on the Overview
already lets an Admin add teammates with a role, but until now that roster only lived in one
browser and the roles were not enforced. Now the roster becomes the real list of who may open
the festival, and the database enforces the roles.

## What

- [ ] An Owner or Admin adds a teammate in the Team form by their **account username** and
      picks a role. The teammate immediately gets access in the database
      (`festival_members` table). Changing the role or removing them works the same way.
- [ ] Roles (Kira's definitions in `rules/access-rules.js`):
      **Admin** — everything, including festival details, budget, finances and the team;
      **Editor** — lineup, checklist, tasks, site map and vendors, but not details, budget,
      finances or the team; **Viewer** — can only look.
- [ ] Enforced by the database (Row Level Security, `migrations/003_shared_festivals.sql`):
      only the owner and members can read a festival; only Owner/Admin/Editor can save it;
      Editors cannot change the finances; only Owner/Admin can change the team; nobody can
      take a festival over. The pages additionally hide what a role cannot do.
- [ ] The sidebar shows a festival switcher when someone has access to more than one
      festival (their own plus the ones shared with them), with the role next to the name.
- [ ] Two people at the same time: each save only sends the sections that changed, and the
      database merges them, so one person's lineup change does not undo another person's
      checklist ticks. When a teammate saved in between, a bar says so and offers Reload.
      The app also checks every 20 seconds.
- [ ] Viewers see "View only — changes are not saved"; nothing is sent.
- [ ] If someone is removed from a team while the festival is open, they are told and the
      app goes back to their own festival on reload.
- [ ] The hard-coded "COLLABORATORS" box (K A F V) is removed from the sidebar: the real
      team of the open festival is on the Overview.

## Out of scope

- Live updates without reloading (the bar asks to reload instead).
- Two people editing the *same* section at the same moment: the later save of that section
  wins.
- Database enforcement of the festival details and the artist budget inside the lineup data
  (they sit inside the lineup section); the pages already block Editors there.
- Invitations by email, leaving a festival yourself, transferring ownership, several own
  festivals per account. Two-factor authentication.

## Done when

1. `uvx --from nodejs-wheel node --test` passes, with new tests for the sharing rules
   (which sections a role may save, team changes, access per role, sync decisions).
2. In a real Postgres with the migrations: a Viewer cannot save, an Editor cannot change the
   finances or the team, a stranger sees nothing, an Admin can add and remove members, the
   owner cannot be added as a member, and nobody can change who owns a festival.
3. In the browser: Amelie adds Kira as Editor → Kira sees Amelie's festival in the switcher,
   edits the lineup, and Amelie sees the change after the bar's Reload; Kira cannot open the
   finance assumptions; as Viewer Kira cannot change anything; after removal Kira loses access.
