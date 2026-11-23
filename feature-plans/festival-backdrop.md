# Feature — Festival backdrop on the Overview

Owner: Amelie · Branch: `feature-festival-backdrop` · Builds on: Overview, artist library genres

## Why

The Overview opens with plain text. A picture that fits the festival makes the app feel alive in
the live demo and shows at a glance what kind of festival it is.

## What

- [x] A banner above the Overview with an **animated live stage** on a `<canvas>`. It shows:
      - lasers that sweep to the beat and change pattern every 16 beats
      - light cones, haze and an aurora sky with twinkling stars
      - a DJ at the decks (head bobbing, scratching, a hand up every bar) in front of a glowing back wall, and speaker stacks on both sides whose cones pump to the beat
      - confetti bursts every 8 beats
      - a crowd that bounces to the beat, with raised arms and phone lights
      - moving waves (coast) and flickering windows (city)

      The festival name sits on top in poster style, glowing to the beat, with venue · dates · mood.
      **Changed on 23 November at Amelie's request:** the first version was a still SVG poster;
      she wanted animation ("take more risk").
- [x] **Rules in `rules/backdrop-rules.js`:**
      - **Mood from the lineup.** The most common genre among the booked performances (or, with nothing booked, the artists in the catalogue) chooses the colours:
        - electronic → neon
        - rock and metal → ember
        - jazz, blues, soul → gold
        - hip-hop, Latin, Afrobeats → heat
        - folk, country, fado → dusk
        - pop → candy
        - otherwise the app's sunset colours
      - **Landscape from the venue:**
        - coast places (Lisbon, Porto, beaches, …) → sea
        - Alpine places (Munich, Zurich, …) → mountains
        - parks and fields → hills
        - everything else → skyline
      - **Landmark for well-known cities** (whole words only, so "Parisian" is not Paris), lit up
        like at night and partly animated:
        - Paris: Eiffel Tower with its sparkle and a sweeping searchlight
        - London: Big Ben with a moving clock and the turning London Eye
        - Lisbon and San Francisco: the red suspension bridge with deck lights
        - Munich: Frauenkirche
        - Berlin: TV tower with a blinking light, and the Brandenburg Gate
        - Rome: Colosseum
        - Barcelona: Sagrada Família
        - New York: Empire State Building, with a top that changes colour to the beat
        - Sydney: Opera House
        - Vienna: the turning Riesenrad
        - Amsterdam: canal houses
        - Dubai: Burj Khalifa
      - **Tempo per mood:** neon 128 BPM, ember 140, gold 92, heat 100, dusk 84, candy 120, sunset 112.
      - The same festival always gets the same stage (seeded by name and venue).
- [x] **Screen:** Overview, for every role (it only shows what is already visible). Drawn in code
      (`overview-backdrop.js`): no photos, no outside service, nothing saved or sent. Name and venue
      are shown with `textContent`. Decorative (`aria-hidden`). Each frame is a pure function of
      the time. The animation pauses when the banner is off screen or the tab is hidden; with
      "reduce motion" it stands still. Sharp on retina (up to 2× pixels).

## Out of scope

- A theme field, uploaded or real photos, backdrops on other pages.

## Done when

- [ ] The banner fits the Lisbon demo (coast, its genres) and the Munich demo (mountains)
- [x] Tests in `tests/festival-backdrop.test.js` cover the rules and the Overview flow
- [ ] All tests pass; tried in the browser including a reload and a narrow window
- [x] `README.md` / `AGENTS.md` updated if users or agents would notice the change (README: one line)

## Tests

- `tests/festival-backdrop.test.js` (16 tests):
  - rules: city → landmark (whole words), genre → mood, mood from bookings/catalogue/fallback, venue → landscape, tempo and laser colours, same festival → same stage;
  - drawing: every landmark (also in a small window) and every mood × landscape at several points in time draws whole frames with only finite numbers; a frame depends only on the time; confetti bursts and ends; a small window still works;
  - Overview banner: title, caption and mood; retina size; one animation only; "reduce motion" draws once; plain-text names; hidden when rules are missing or fail; script order.
- Frames of all four landscapes and three points in time were rendered with a real canvas (@napi-rs/canvas, outside the repo) and looked at.
- Not yet: the banner inside the real page in a browser (laptop and phone width).
