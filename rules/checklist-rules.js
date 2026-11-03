// Festival Architect — the crew checklist: what every team has to get done before the gates open.
// Only data and calculations live here (no screen code), so they can be tested (tests/) and used by
// checkliste-festivalplanung/checklist-page.js.

const CHECKLIST = [
  { id: 'security', title: 'Security', icon: '◈', tasks: [
    { id: 'security-plan', text: 'Crowd management plan written and approved' },
    { id: 'security-staff', text: 'Security staff booked and briefed' },
    { id: 'security-entry', text: 'Entry points with bag checks set up' },
    { id: 'security-exits', text: 'Emergency exits marked and kept free' },
    { id: 'security-barriers', text: 'Crowd barriers in front of both stages' },
    { id: 'security-lost', text: 'Lost & found and lost-child point set up' }
  ] },
  { id: 'stage', title: 'Stage building', icon: '▥', tasks: [
    { id: 'stage-build', text: 'Both stages built according to the plan' },
    { id: 'stage-inspection', text: 'Stage structures inspected and signed off' },
    { id: 'stage-rigging', text: 'Rigging load points checked' },
    { id: 'stage-weather', text: 'Rain and wind protection in place' },
    { id: 'stage-access', text: 'Stairs, ramps and backstage access safe' }
  ] },
  { id: 'sound', title: 'Sound', icon: '◉', tasks: [
    { id: 'sound-pa', text: 'PA system set up on both stages' },
    { id: 'sound-monitors', text: 'Stage monitors and in-ears ready' },
    { id: 'sound-backline', text: 'Backline matches the artists’ technical riders' },
    { id: 'sound-checks', text: 'Soundcheck schedule shared with all artists' },
    { id: 'sound-limits', text: 'Noise limits known and a sound level meter in place' },
    { id: 'sound-spares', text: 'Spare microphones, cables and batteries packed' }
  ] },
  { id: 'lighting', title: 'Lighting', icon: '✦', tasks: [
    { id: 'lighting-plot', text: 'Lighting plan agreed for each stage' },
    { id: 'lighting-rig', text: 'Lights rigged and focused' },
    { id: 'lighting-show', text: 'Light shows programmed for the evening sets' },
    { id: 'lighting-site', text: 'Paths, toilets and exits lit after dark' },
    { id: 'lighting-emergency', text: 'Emergency lighting tested' }
  ] },
  { id: 'power', title: 'Power & cables', icon: 'ϟ', tasks: [
    { id: 'power-generators', text: 'Generators delivered and fuelled' },
    { id: 'power-backup', text: 'Backup power for stages and first aid' },
    { id: 'power-check', text: 'Electrical installation checked by an electrician' },
    { id: 'power-ramps', text: 'Cable ramps over all walkways' }
  ] },
  { id: 'backstage', title: 'Backstage & catering', icon: '☕', tasks: [
    { id: 'backstage-rooms', text: 'Dressing rooms ready and labelled' },
    { id: 'backstage-riders', text: 'Hospitality riders read and ordered' },
    { id: 'backstage-catering', text: 'Crew and artist catering times planned' },
    { id: 'backstage-diets', text: 'Allergies and dietary needs noted' },
    { id: 'backstage-water', text: 'Drinking water on and next to both stages' }
  ] },
  { id: 'artists', title: 'Artist care & transport', icon: '♪', tasks: [
    { id: 'artists-arrival', text: 'Arrival times confirmed with every artist' },
    { id: 'artists-shuttle', text: 'Shuttle and parking for artists organised' },
    { id: 'artists-passes', text: 'Artist and crew passes printed' },
    { id: 'artists-contacts', text: 'Contact person named for each artist' }
  ] },
  { id: 'medical', title: 'First aid & safety', icon: '✚', tasks: [
    { id: 'medical-team', text: 'Paramedics and first aid tent booked' },
    { id: 'medical-defib', text: 'Defibrillator on site and its place known' },
    { id: 'medical-fire', text: 'Fire extinguishers placed and checked' },
    { id: 'medical-evacuation', text: 'Evacuation plan shared with all teams' },
    { id: 'medical-weather', text: 'Storm and heat plan ready' }
  ] },
  { id: 'facilities', title: 'Toilets, water & waste', icon: '♲', tasks: [
    { id: 'facilities-toilets', text: 'Enough toilets, including accessible ones' },
    { id: 'facilities-water', text: 'Free drinking water stations' },
    { id: 'facilities-bins', text: 'Bins and recycling points across the site' },
    { id: 'facilities-cleaning', text: 'Cleaning crew booked for during and after' }
  ] },
  { id: 'entry', title: 'Tickets & entry', icon: '▤', tasks: [
    { id: 'entry-scanners', text: 'Ticket scanners tested' },
    { id: 'entry-wristbands', text: 'Wristbands delivered' },
    { id: 'entry-signs', text: 'Signs to entrance, stages, toilets and exits' },
    { id: 'entry-accessible', text: 'Accessible entrance and viewing area' }
  ] },
  { id: 'permits', title: 'Permits & insurance', icon: '§', tasks: [
    { id: 'permits-event', text: 'Event permit from the city' },
    { id: 'permits-noise', text: 'Noise permit for the festival hours' },
    { id: 'permits-alcohol', text: 'Licence to sell alcohol' },
    { id: 'permits-insurance', text: 'Event liability insurance' }
  ] },
  { id: 'team', title: 'Team & radios', icon: '◎', tasks: [
    { id: 'team-shifts', text: 'Staff and volunteer shifts planned' },
    { id: 'team-briefing', text: 'Team briefing held on the morning of the festival' },
    { id: 'team-radios', text: 'Radios charged, channels assigned' },
    { id: 'team-contacts', text: 'Emergency contact list handed out' }
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
