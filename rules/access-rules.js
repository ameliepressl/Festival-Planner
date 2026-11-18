// The local browser is the creator until the app has signed-in accounts.
const FESTIVAL_CREATOR = Object.freeze({ username: 'You (festival creator)', role: 'Admin' });
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
  return roleCan(FESTIVAL_CREATOR.role, action);
}
