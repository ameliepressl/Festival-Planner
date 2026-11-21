// Festival Architect — the crew checklist: event-day checks each team confirms on site before the gates open.
// Only data and calculations live here (no screen code), so they can be tested (tests/) and used by
// checkliste-festivalplanung/checklist-page.js.

const CHECKLIST = [
  { id: 'security', title: 'Security', icon: '◈', tasks: [
    { id: 'security-plan', text: 'Security lead has confirmed today’s crowd management arrangements' },
    { id: 'security-staff', text: 'Security staff checked in, briefed and at their posts' },
    { id: 'security-entry', text: 'Entry points staffed and bag-check stations ready' },
    { id: 'security-exits', text: 'Emergency exits clearly marked and routes clear' },
    { id: 'security-barriers', text: 'Crowd barriers in position and checked at every stage' },
    { id: 'security-lost', text: 'Lost & found and lost-child point staffed and clearly marked' }
  ] },
  { id: 'stage', title: 'Stage building', icon: '▥', tasks: [
    { id: 'stage-build', text: 'All stages fully assembled and ready for today’s programme' },
    { id: 'stage-inspection', text: 'Stage inspection sign-offs available to the stage manager' },
    { id: 'stage-rigging', text: 'Rigging lead has confirmed load points are checked and secure' },
    { id: 'stage-weather', text: 'Stage weather protection checked against today’s conditions' },
    { id: 'stage-access', text: 'Stairs, ramps and backstage routes checked and clear' }
  ] },
  { id: 'sound', title: 'Sound', icon: '◉', tasks: [
    { id: 'sound-pa', text: 'PA system tested and working on every stage' },
    { id: 'sound-monitors', text: 'Stage monitors and in-ear systems tested and ready' },
    { id: 'sound-backline', text: 'Backline on site and checked against today’s technical riders' },
    { id: 'sound-checks', text: 'Pre-opening soundchecks completed and remaining checks confirmed with artists' },
    { id: 'sound-limits', text: 'Sound engineer briefed on today’s noise limits and meter working' },
    { id: 'sound-spares', text: 'Spare microphones, cables and batteries available at the stages' }
  ] },
  { id: 'lighting', title: 'Lighting', icon: '✦', tasks: [
    { id: 'lighting-plot', text: 'Lighting setup checked against each stage’s lighting plan' },
    { id: 'lighting-rig', text: 'Lighting crew has checked fixtures are secure, focused and working' },
    { id: 'lighting-show', text: 'Evening lighting cues loaded and tested' },
    { id: 'lighting-site', text: 'Path, toilet and exit lights tested and ready for dusk' },
    { id: 'lighting-emergency', text: 'Emergency lighting tested and working' }
  ] },
  { id: 'power', title: 'Power & cables', icon: 'ϟ', tasks: [
    { id: 'power-generators', text: 'Generators running and fuel levels checked for today’s operation' },
    { id: 'power-backup', text: 'Backup power for stages and first aid tested and ready' },
    { id: 'power-check', text: 'Electrician has confirmed the installation is ready for use' },
    { id: 'power-ramps', text: 'Cables protected and cable ramps secure across walkways' }
  ] },
  { id: 'backstage', title: 'Backstage & catering', icon: '☕', tasks: [
    { id: 'backstage-rooms', text: 'Dressing rooms clean, stocked and labelled' },
    { id: 'backstage-riders', text: 'Hospitality supplies on site and checked against today’s riders' },
    { id: 'backstage-catering', text: 'Catering team on site and today’s serving times confirmed' },
    { id: 'backstage-diets', text: 'Catering team has confirmed dietary requests and labelled meals' },
    { id: 'backstage-water', text: 'Drinking water stocked on and next to every stage' }
  ] },
  { id: 'artists', title: 'Artist care & transport', icon: '♪', tasks: [
    { id: 'artists-arrival', text: 'Artist liaison has checked today’s arrivals and flagged any delays' },
    { id: 'artists-shuttle', text: 'Shuttle drivers checked in and artist parking ready' },
    { id: 'artists-passes', text: 'Artist and crew passes available at check-in' },
    { id: 'artists-contacts', text: 'Artist contacts on duty and reachable' }
  ] },
  { id: 'medical', title: 'First aid & safety', icon: '✚', tasks: [
    { id: 'medical-team', text: 'Medical team on site and first aid point staffed and equipped' },
    { id: 'medical-defib', text: 'Defibrillator ready for use and its location confirmed with staff' },
    { id: 'medical-fire', text: 'Fire extinguishers checked, accessible and in position' },
    { id: 'medical-evacuation', text: 'Team leads briefed on evacuation routes and meeting points' },
    { id: 'medical-weather', text: 'Safety lead has checked today’s forecast and briefed teams on weather actions' }
  ] },
  { id: 'facilities', title: 'Toilets, water & waste', icon: '♲', tasks: [
    { id: 'facilities-toilets', text: 'Toilets, including accessible units, open, clean and stocked' },
    { id: 'facilities-water', text: 'Free drinking water stations working and clearly marked' },
    { id: 'facilities-bins', text: 'Bins and recycling points in position and ready for use' },
    { id: 'facilities-cleaning', text: 'Cleaning crew on site, briefed and equipped for today’s shifts' }
  ] },
  { id: 'entry', title: 'Tickets & entry', icon: '▤', tasks: [
    { id: 'entry-scanners', text: 'Ticket scanners tested with the entry team and ready to use' },
    { id: 'entry-wristbands', text: 'Wristbands stocked at each entry point' },
    { id: 'entry-signs', text: 'Entrance, stage, toilet and exit signs in place and visible' },
    { id: 'entry-accessible', text: 'Accessible entrance, routes and viewing area checked and clear' }
  ] },
  { id: 'permits', title: 'Permits & insurance', icon: '§', tasks: [
    { id: 'permits-event', text: 'Event permit available on site and today’s conditions checked with the event lead' },
    { id: 'permits-noise', text: 'Noise permit available and permitted hours confirmed with the sound lead' },
    { id: 'permits-alcohol', text: 'Alcohol licence available and service conditions confirmed with bar leads' },
    { id: 'permits-insurance', text: 'Insurance documents and incident-reporting contact available on site' }
  ] },
  { id: 'team', title: 'Team & radios', icon: '◎', tasks: [
    { id: 'team-shifts', text: 'Staff and volunteers checked in and today’s posts covered' },
    { id: 'team-briefing', text: 'Event-day team briefing completed' },
    { id: 'team-radios', text: 'Radios charged, issued and tested on assigned channels' },
    { id: 'team-contacts', text: 'Team leads have today’s contact list and key contacts are reachable' }
  ] }
];

const CHECKLIST_STORAGE_KEY = 'festival-architect-checklist';

function allTaskIds() { return CHECKLIST.flatMap((group) => group.tasks.map((task) => task.id)); }

// Read the ticked task ids back. Broken or missing data gives an empty list instead of crashing.
function parseChecked(text) {
  try {
    const saved = JSON.parse(text);
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}

// Tick a task, or untick it if it was ticked. Returns a new list; the old one is not changed.
function toggleTask(checked, taskId) {
  return checked.includes(taskId) ? checked.filter((id) => id !== taskId) : [...checked, taskId];
}

// How far the whole crew is: done tasks, all tasks and a whole percentage from 0 to 100.
// Ids that are not (or no longer) on the list are ignored.
function progress(checked) {
  const ids = allTaskIds();
  const done = ids.filter((id) => checked.includes(id)).length;
  return { done, total: ids.length, percent: Math.round((done / ids.length) * 100) };
}

// The same for one team, e.g. progressOf('sound', checked) -> { done: 2, total: 6 }.
function progressOf(groupId, checked) {
  const group = CHECKLIST.find((g) => g.id === groupId);
  return { done: group.tasks.filter((task) => checked.includes(task.id)).length, total: group.tasks.length };
}

// In the browser these are plain globals; in the tests (Node) they are exported.
if (typeof module !== 'undefined') {
  module.exports = { CHECKLIST, CHECKLIST_STORAGE_KEY, allTaskIds, parseChecked, toggleTask, progress, progressOf };
}
