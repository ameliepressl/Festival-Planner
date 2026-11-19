-- 002 — Close a warning from Supabase's security check
--
-- When the project was created with "Enable RLS on new tables automatically", Supabase
-- added the function public.rls_auto_enable(). An event trigger ("ensure_rls") runs it
-- after every table change to switch Row Level Security on.
--
-- Supabase's security advisor warns that this SECURITY DEFINER function can also be called
-- through the API by anyone (anon) and by signed-in users (/rest/v1/rpc/rls_auto_enable).
-- Nobody needs to call it that way: the event trigger runs it by itself. So the API roles
-- lose the right to call it. The event trigger keeps working.
-- See https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
