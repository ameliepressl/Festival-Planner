// Where the app finds its Supabase project (accounts and saved festivals).
//
// Both values are PUBLIC on purpose: Supabase made the publishable key to be used in
// browser code. It only allows what the Row Level Security rules in
// migrations/001_accounts_and_festivals.sql allow, so every user sees only their own festival.
//
// NEVER put the "secret" / "service_role" key here or anywhere else in the repository:
// it ignores Row Level Security. See AGENTS.md → Secrets.
//
// Supabase dashboard → "Connect" (or Project Settings → API Keys):
window.FESTIVAL_SUPABASE = Object.freeze({
  url: 'https://YOUR-PROJECT.supabase.co',
  publishableKey: 'YOUR-PUBLISHABLE-KEY'
});
