// admin-set-active — deactivate or reactivate an account.
//
// TWO BOUNDARIES, IN THIS ORDER, AND THE ORDER IS THE POINT
//
// 1. THE DATABASE DECIDES. This function calls set_user_active() with the
//    CALLER'S OWN JWT, not with the service role. So auth.uid() inside the
//    function is the real caller, app_may_manage_account() applies unchanged,
//    and every refusal the migration encodes — you cannot deactivate
//    yourself, you cannot deactivate the last active Super Admin, an
//    Institution Admin may only touch their own classroom staff — is enforced
//    exactly once, in the place that also writes the audit row and ends the
//    person's class assignments, inside one transaction.
//
//    Re-deciding any of that here in TypeScript would be a second, weaker copy
//    of the rule that could drift from the real one. It is not done.
//
// 2. THEN AUTH IS TOLD. Only once the database has accepted does this function
//    use the service-role key to ban (or unban) the Supabase Auth user, so a
//    deactivated person cannot even obtain a session. This is defence in
//    depth, not the security boundary: the boundary is RLS, which already
//    refuses a deactivated account holding a live token, because
//    app_current_role() resolves to NULL for them.
//
//    If the ban fails, the account is ALREADY deactivated in the database and
//    already cannot read or write anything. Say so in a warning rather than
//    reporting a clean success or pretending the whole thing failed.

import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Supabase expresses a ban as a duration. 100 years is the documented way to
// say "until someone lifts it"; 'none' lifts it.
const BAN_INDEFINITE = '876000h';

interface Payload {
  userId: string;
  active: boolean;
  reason?: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function bad(message: string, status = 400): Response {
  return json({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) return bad('missing server env', 500);

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return bad('missing bearer token', 401);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return bad('invalid JSON body');
  }
  if (!payload.userId) return bad('userId is required');
  if (typeof payload.active !== 'boolean') return bad('active must be true or false');

  // (1) The database decides — as the caller, not as the service role.
  const asCaller = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { error: rpcError } = await asCaller.rpc('set_user_active', {
    p_user: payload.userId,
    p_active: payload.active,
    p_reason: (payload.reason ?? '').trim() || null,
  });
  // The message is written for a human to read ("You cannot deactivate the
  // last active Super Admin…"). Pass it through unchanged.
  if (rpcError) return bad(rpcError.message, 403);

  // (2) Now tell Auth.
  const adminDb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error: banError } = await adminDb.auth.admin.updateUserById(payload.userId, {
    ban_duration: payload.active ? 'none' : BAN_INDEFINITE,
  });
  if (banError) {
    return json({
      user_id: payload.userId,
      active: payload.active,
      warning:
        `the account is ${payload.active ? 'active' : 'deactivated'} in the platform, but the ` +
        `sign-in service could not be updated: ${banError.message}`,
    });
  }

  return json({ user_id: payload.userId, active: payload.active });
});
