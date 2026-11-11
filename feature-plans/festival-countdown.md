# Festival countdown

Why: give the team a clear view of remaining preparation time.

What: upper-right calendar-day and weekday counts based on festival start. Count today through the day before opening. Workdays mean Monday–Friday; public holidays are not deducted. Use Europe/Lisbon dates and date-only arithmetic to avoid daylight-saving errors. Show today/started/ended states without negative numbers. Refresh on focus, each minute and planner renders.

Out of scope: date editing, public-holiday calendars and user-specific work schedules.

Done when: date arithmetic tests pass and both counters are visible throughout the app.

Default festival changed to 30–31 December 2026. Empty saved plans using the former October defaults adopt the new dates; existing booked events retain their dates. Saved Gantt schedules shift with the template anchor to retain relative lead times.
