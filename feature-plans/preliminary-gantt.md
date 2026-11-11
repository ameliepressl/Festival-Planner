# Preliminary Gantt chart

Why: provide a first empty timeline view from the Task board.

What: Open Gantt chart and Back to task board buttons; a blank task/owner/status table aligned with an eight-week timeline, using the existing design.

Out of scope: task creation, example tasks, bars, dependencies, dates, assignments, editing and persistence.

Done when: chart opens and returns correctly, sidebar navigation works, empty layout scrolls on small screens.

## Main categories

Add the 13 agreed numbered work areas, each with its own muted colour. Keep the timeline blank, without subtasks, dates or bars. Category labels remain visible when scrolling horizontally; colours supplement the numbers and names.

## Cleaning crew example

Add 7.1 Organise cleaning crew under Site & infrastructure, followed by 7.1.1–7.1.6 in sequence: reach out, get quotations, choose company, negotiate, close deal, align details. Indent the two hierarchy levels and retain category 7’s blue colour. No invented dates, owners, status or timeline bars. Link the group in explanatory text to the event-day cleaning checkpoint.

## Compact hierarchy controls

Reduce category, task-group and subtask row heights. Expand/collapse categories with children and task groups independently using accessible buttons; preserve a group’s state when its parent closes. No changes to scheduling or task content.

## Approved full breakdown

Transfer all 13 categories, 52 task groups and 209 subtasks approved in chat. Retain independent category/task toggles; start with task groups collapsed for a manageable overview. Add expand-all/collapse-all shortcuts. Make rows approximately 30–34px, with readable wrapping for longer labels. Keep owners, status and schedules empty.

## Overview density and day-level timeline

Remove Status; keep Owner. Make rows as compact as practical while retaining readable labels. Each of eight relative weeks toggles independently between one week column and seven numbered day columns. Real dates remain undefined. Preserve hierarchy state when changing timeline detail.

## Proposed daily schedule

Anchor to the event dates in the lineup planner. Use 12 preparation weeks and two event/wrap-up weeks. Assign explicit day ranges to all 209 steps; teams work in parallel, steps in each task remain sequential. Early decisions, applications and supplier bookings precede late setup and final checks. Opening-day checks are due before gates open. Category 13 follows the last festival day. Show dated day cells by default, week summaries on collapse, and aggregate task/category bars. The dates are a planning template, not verified supplier lead times or resource capacity.

## Frozen timeline header and compact labels

Keep weeks/dates visible in a vertically scrolling chart. Narrow task column to 270px; horizontally scrolled labels shrink to a muted 160px preview with full text available on hover. Preserve task toggles and timeline navigation.

## Default project template and future permissions

The approved 13 categories, 52 tasks, 209 subtasks and relative daily schedule are the default inputs loaded on every app opening. Dates are anchored to the configured festival dates. Keep this as the starting template for future projects. Later work will introduce users, project roles and permission-based editing of tasks and timelines; no accounts or permissions are implemented in this version.

## Clearer detail controls — 10 November 2026

Replace expand/collapse-all with an Outline control (Areas / Tasks / Subtasks) and replace All weeks/days with Timeline (Weeks / Days). Selected states reflect actual detail; manual mixtures show Custom. Retain independent row and week toggles, using consistent chevrons and accessible labels. Preserve horizontal position on timeline changes by anchoring to the currently visible date. Stay on feature-task-board; no commit requested.

## Head-of-project editing

Add a browser-local editor for subtask names and dates, adding/removing/reordering subtasks and moving task groups within an area. Save explicitly; cancel discards edits. Stable task identities keep schedules attached when numbering changes. Aggregate dates follow children; custom dates extend the visible timeline. Validate nonempty titles and valid ordered date ranges. Preserve edits after reload and keep existing outline/week controls. No user accounts or actual multi-user access control yet.

## Inline edit mode

Edit plan enables names, date inputs and ordering/add/remove controls directly on chart rows. Update schedule bars immediately after valid date changes. Explicit Save/Cancel; cancelled drafts never touch persisted plan. Preserve outline state across edits; reuse chart initialisers for structural updates. Remove popup editor.

## Drag reordering

Replace visible up/down buttons with drag handles in inline edit mode. Task groups move as a unit within their area; subtasks move within their task. Show insertion line and preserve dates, IDs and children. Keyboard arrows on focused handles provide equivalent reordering. Save/Cancel continues to govern persistence.

## Compact inline editing — 11 November

Place drag handles at the far left of each editable row. Keep number, name and compact +/× actions on one line. × sits immediately after each subtask name; retain accessible remove labels and second-click confirmation without expanding row text.

## Owner and dates columns

Show Task and Owner in overview. In edit mode show Task, Owner and Subtask dates as separate columns. Keep date controls out of the Owner cells and preserve timeline alignment across mode changes.

## Compact page introduction

Place grey description to the right of Project timeline on wider screens; stack on small screens. Reduce introduction height without changing wording.
