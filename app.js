// Festival Architect — the screen: drawing the page and reacting to clicks.
// The rules live in rules/festival-rules.js (loaded first in index.html); this file only calls them.
let state = loadState();
let selectedArtistId = null, editingId = null;
const $ = (selector) => document.querySelector(selector);
const euros = (n) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
function loadState() { return parseState(localStorage.getItem(STORAGE_KEY)); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function minutesFromInput(value) { const [h, m] = value.split(':').map(Number); return h * 60 + m; }
function render() {
  const committed = total(state);
  $('#artist-count').innerHTML = `${state.bookings.length} <small>/ 8</small>`;
  $('#committed').textContent = euros(committed); $('#remaining').textContent = euros(BUDGET - committed);
  $('#plan-status').textContent = state.final ? 'FINAL' : 'DRAFT'; $('#plan-status').classList.toggle('final', state.final);
  $('#finalise-btn').textContent = state.final ? 'Reopen as draft' : 'Finalise plan';
  $('#artist-list').innerHTML = ARTISTS.map((a) => { const booked = state.bookings.some((b) => b.artistId === a.id); return `<article class="artist-card ${booked ? 'booked' : ''}" data-artist="${a.id}"><div class="avatar" style="background:${a.colour}">${a.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div><div class="artist-name">${a.name}</div><div class="artist-meta">${a.genre} · ${a.duration} min</div></div><div class="artist-price">${euros(a.fee)}${booked ? '<div class="booked-label">BOOKED</div>' : ''}</div></article>`; }).join('');
  $('#time-axis').innerHTML = Array.from({length:10}, (_, i) => `<span>${String(14+i).padStart(2,'0')}:00</span>`).join('');
  ['A', 'B'].forEach(stage => { const bookings = state.bookings.filter(b => b.stage === stage).sort((a,b) => a.start-b.start); $(`#track-stage-${stage.toLowerCase()}`).innerHTML = bookings.map(b => { const a=artist(b.artistId), left=((b.start-START)/(END-START))*100, width=(a.duration/(END-START))*100; return `<button class="performance ${stage.toLowerCase()}" data-booking="${b.id}" style="left:${left}%;width:${width}%" title="Edit ${a.name}"><strong>${a.name}</strong><span>${timeText(b.start)}—${timeText(b.start+a.duration)}</span></button>` }).join(''); });
  $('#schedule-empty').classList.toggle('hidden', state.bookings.length > 0);
  document.querySelectorAll('.artist-card:not(.booked)').forEach(el => el.addEventListener('click', () => openBooking(el.dataset.artist)));
  document.querySelectorAll('.performance').forEach(el => el.addEventListener('click', () => openBooking(null, el.dataset.booking)));
}
function populateTimes() { $('#time-input').innerHTML = Array.from({length: 37}, (_, i) => { const t=START+i*15; return `<option value="${timeText(t)}">${timeText(t)}</option>`; }).join(''); }
function openBooking(artistId, bookingId = null) {
  if (state.final) return toast('Reopen the final plan before editing.');
  editingId = bookingId; const booking = bookingId ? state.bookings.find(b => b.id === bookingId) : null; selectedArtistId = booking ? booking.artistId : artistId; const a = artist(selectedArtistId);
  $('#dialog-step').textContent = booking ? 'EDIT PERFORMANCE' : 'CREATE PERFORMANCE'; $('#dialog-title').textContent = booking ? 'Move performance' : 'Book artist';
  $('#artist-preview').innerHTML = `<div class="avatar" style="background:${a.colour}">${a.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div><strong>${a.name}</strong><div class="artist-meta">${a.genre} · ${euros(a.fee)}</div></div>`;
  $('#duration-preview').textContent = `${a.duration} minutes`; $('#stage-input').value = booking?.stage || 'A'; $('#time-input').value = timeText(booking?.start || START); $('#save-btn').textContent = booking ? 'Save changes' : 'Add to lineup'; $('#remove-btn').classList.toggle('hidden', !booking); $('#form-message').textContent = '';
  updateEndPreview(); $('#booking-dialog').showModal();
}
function updateEndPreview() { const end=minutesFromInput($('#time-input').value)+artist(selectedArtistId).duration; $('#end-preview').textContent=timeText(end); }
function closeBooking() { $('#booking-dialog').close(); selectedArtistId = null; editingId = null; }
function toast(message) { const t=$('#toast'); t.textContent=message;t.classList.add('visible');setTimeout(()=>t.classList.remove('visible'),2600); }
$('#time-input').addEventListener('change', updateEndPreview);
$('#close-dialog').addEventListener('click', closeBooking); $('#cancel-btn').addEventListener('click', closeBooking);
$('#booking-form').addEventListener('submit', (e) => { e.preventDefault(); const booking = { id: editingId || crypto.randomUUID(), artistId: selectedArtistId, stage: $('#stage-input').value, start: minutesFromInput($('#time-input').value) }; const problem=validation(state,booking,editingId); if(problem) { $('#form-message').textContent=problem; return; } if(editingId) state.bookings=state.bookings.map(b=>b.id===editingId?booking:b); else state.bookings.push(booking); save(); closeBooking();render();toast(editingId?'Performance updated.':'Artist added to the lineup.'); });
$('#remove-btn').addEventListener('click', () => { if(!editingId)return; state.bookings=state.bookings.filter(b=>b.id!==editingId);save();closeBooking();render();toast('Booking removed and budget released.'); });
$('#finalise-btn').addEventListener('click', () => { if(state.final){state.final=false;save();render();toast('Plan reopened as a draft.');return;} const problems=finaliseProblems(state); if(problems.length){toast(problems.join(' '));return;} $('#finalise-dialog').showModal(); });
$('#confirm-finalise').addEventListener('click', () => { const problems=finaliseProblems(state); if(problems.length){toast(problems.join(' '));return;} state.final=true;save();render();toast('Lineup finalised. Your plan is now read-only.'); });
document.querySelectorAll('.sidebar-item').forEach((button) => button.addEventListener('click', () => {
  if (!['Lineup planner', 'Final checklist'].includes(button.dataset.section)) {
    toast(`${button.dataset.section} will be added in a later feature branch.`);
    return;
  }
  document.querySelectorAll('.sidebar-item').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}));
populateTimes();render();
