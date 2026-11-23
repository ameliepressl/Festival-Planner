# Animated visitor simulation

Branch: `feature-animated-visitor-simulation` (owner: Vicky).

## Why

Let organisers explore how their timetable and site layout influence visitor movement.

## What

Add an optional playback layer to the Site map for every festival role. Use one dot per visitor, the selected day's performances, mapped facilities and walkable routes. Let the organiser pause, change speed, jump to a time, inspect density and start an evacuation from the displayed crowd. Show the existing evacuation estimate with its own assumptions.

## Out of scope

Live tracking, changes to saved festival data and certification of venue safety.

## Done when

Playback works for individual festival days and overnight hours, respects closed exits and no-go areas, and reports missing inputs. Switching pages or closing playback stops the animation. Verify both modes, permissions, reload and the full test suite.
