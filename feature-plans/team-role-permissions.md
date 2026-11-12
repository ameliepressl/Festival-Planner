# Team role permissions

## Why

Show who created the festival, confirm teammate removal, and keep festival-wide changes with admins.

## What

- Show the local festival creator first in the team as a protected Admin.
- Let admins add or remove teammates, change their roles, and edit festival details and the overall artist budget.
- Let editors edit the lineup and checklist, including artist and booking fees.
- Let viewers read the plan.
- Ask for confirmation before removing a teammate.

## Out of scope

Signed-in identities, shared festivals and server-side authorization. This browser acts as the local creator.

## Done when

The creator stays first after reload, cancelling removal leaves the roster unchanged, and the planner checks role permissions before changing festival details, budget, lineup, checklist or team.
