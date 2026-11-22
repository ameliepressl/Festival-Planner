# Automatic lineup planning

Branch: `feature-automatic-lineup-fillup`.

## Why
Build a practical lineup from the festival catalogue without placing every performance manually.

## What
A role-aware Suggest lineup button immediately opens a compact timeline grouped by festival day, with a horizontal row for each stage, with Cancel and Use this lineup actions. Let the organiser select the final-day headliner in the suggestion popup, independently of fee. Recalculate when the selection changes and remember the choice when applying. Keep at least 15 minutes between performances per stage. Rebuild tentative performances, keeping confirmed performances, their changeovers and standalone calendar blocks. State this replacement clearly before applying. Respect dates, stage hours (including overnight), conflicts and the remaining budget. Reserve the final festival slot for the headliner and avoid three consecutive performances of the same genre per stage per day (case-insensitive). Balance performance counts across days and stages, then space their start times across the full available hours rather than packing them at opening. Existing appointments act as fixed anchors. Aim for a 30-minute arrival window and 15-minute exit window. Try an alternating, non-overlapping running order across stages when capacity and fixed bookings allow it. State remaining overlaps and any reduced door buffers honestly. Show unscheduled artists and reasons; the organiser chooses whether to apply a partial result. Generated performances are tentative.

## Out of scope
Artist-library imports, automatic confirmations, permission changes, optimality guarantees and overwriting confirmed bookings.

## Done when
Preview/cancel do not change the plan. Apply rechecks permission and current state, uses the existing save flow, and persists through reload. Tests cover constraints and failure cases; verify in Chrome.

Preview includes retained bookings/blocks, scaled performance positions, a headliner outline, HH:MM time labels and accessible full names/times on each set. It scrolls horizontally on narrow screens and vertically for long festivals; it never changes the saved plan by itself.
