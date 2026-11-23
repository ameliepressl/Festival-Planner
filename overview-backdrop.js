// Festival backdrop on the Overview (feature-plans/festival-backdrop.md).
// Decorative: draws the picture from rules/backdrop-rules.js; saves nothing.
let overviewBackdropKey = '';

function renderOverviewBackdrop() {
  const box = document.querySelector('#overview-backdrop');
  if (!box) return;
  if (typeof festivalBackdrop !== 'function' || typeof state === 'undefined' || !state?.event) { box.hidden = true; return; }
  try {
    const backdrop = festivalBackdrop({ name: state.event.name, venue: state.event.venue,
      artists: state.artists, bookings: state.bookings });
    // Redraw only when the picture changes, so the light beams keep swaying smoothly.
    if (backdrop.key !== overviewBackdropKey) {
      document.querySelector('#overview-backdrop-art').innerHTML = backdrop.svg; // no user text in it
      overviewBackdropKey = backdrop.key;
    }
    document.querySelector('#overview-backdrop-caption').textContent =
      [state.event.venue, backdrop.label].filter(Boolean).join(' · ');
    box.dataset.mood = backdrop.mood;
    box.dataset.scene = backdrop.scene;
    box.hidden = false;
  } catch {
    box.hidden = true; // a picture must never stop the Overview from working
  }
}
