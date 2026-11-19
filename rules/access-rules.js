// With accounts, account/account.js tells the pages before they start what the signed-in
// account may do in the open festival: { role, creatorLabel } (feature-plans/shared-festivals.md).
// The database enforces the same roles. Without it (e.g. in the tests) this browser is the
// festival creator with Admin rights, as before.
const SIGNED_IN_ACCESS = typeof window !== 'undefined' && window.festivalAccess ? window.festivalAccess : null;
const FESTIVAL_CREATOR = Object.freeze({ username: SIGNED_IN_ACCESS?.creatorLabel || 'You (festival creator)', role: 'Admin' });
const TEAM_PERMISSIONS = {
  Admin: {
    actions: ['overview', 'team', 'budget', 'lineup', 'checklist'],
    description: 'Edit festival details and budget, manage the team, and edit the lineup and checklist'
  },
  Editor: {
    actions: ['lineup', 'checklist'],
    description: 'Edit the lineup and checklist, including artist and booking fees'
  },
  Viewer: {
    actions: [],
    description: 'View the festival, lineup and checklist'
  }
};

function roleCan(role, action) {
  return Object.hasOwn(TEAM_PERMISSIONS, role) && TEAM_PERMISSIONS[role].actions.includes(action);
}

function canFestival(action) {
  return roleCan(SIGNED_IN_ACCESS?.role || FESTIVAL_CREATOR.role, action);
}
