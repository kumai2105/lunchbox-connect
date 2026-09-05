// admin-set-password — issue a new password for an existing account.
//
// WHY THIS IS A SERVER FUNCTION AND NOT A CLIENT CALL
//
// Setting another person's password is `auth.admin.updateUserById`, which
// requires the service-role key. That key is a full bypass of every RLS
// policy in the project, so it exists ONLY inside this Deno environment
// (`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`) and is never shipped
// to a browser. The caller reaches it with their own JWT and gets exactly the
// authority that JWT carries — nothing more.
//
// WHAT IT DELIBERATELY DOES NOT DO
//
//   * It never reads, returns, echoes or logs an existing password. Supabase
//     stores a bcrypt hash; there is nothing to retrieve, and this function
//     does not pretend otherwise.
//   * It never writes a password VALUE into audit_log. It records THAT a
//     reset happened, by whom, for whom, and why — never what to.
//
// AUTHORIZATION mirrors app_may_manage_account() in migration 0044 exactly:
//   * Super Admin        — any account.
//   * Institution Admin  — only classroom_staff of their own institution.
//   * anyone else        — refused.
// An account that has been deactivated may not act, so the caller's `active`
// flag is checked here as well as at the database boundary.

import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Payload {
  userId: string;
  password: string;
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

  const anon = createClient(url, anonKey);
  const {
    data: { user },
    error: authError,
  } = await anon.auth.getUser(token);
  if (authError || !user) return bad('unauthenticated', 401);

  const adminDb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: caller } = await adminDb
    .from('app_users')
    .select('role, institution_id, active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!caller) return bad('forbidden', 403);
  if (caller.active === false) return bad('this account is deactivated', 403);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return bad('invalid JSON body');
  }

  if (!payload.userId) return bad('userId is required');
  if (!payload.password || payload.password.length < 8)
    return bad('password must be at least 8 characters');

  const { data: target } = await adminDb
    .from('app_users')
    .select('user_id, role, institution_id, full_name')
    .eq('user_id', payload.userId)
    .maybeSingle();
  if (!target) return bad('no such account', 404);

  const isSuper = caller.role === 'super_admin';
  const mayManage =
    isSuper ||
    (caller.role === 'school_admin' &&
      target.role === 'classroom_staff' &&
      target.institution_id !== null &&
      target.institution_id === caller.institution_id);
  if (!mayManage) return bad('You may not change this account', 403);

  const { error: setError } = await adminDb.auth.admin.updateUserById(payload.userId, {
    password: payload.password,
  });
  if (setError) return bad(setError.message, 400);

  // Record that it happened. The value is not part of the record, and there is
  // no column here that could carry it even by accident.
  const { error: auditError } = await adminDb.from('audit_log').insert({
    actor_user_id: user.id,
    action: 'user.password_reset',
    entity_type: 'app_users',
    entity_id: payload.userId,
    previous_value: null,
    new_value: { password_reset: true },
    reason: (payload.reason ?? '').trim() || null,
  });
  // A password that changed but was not recorded is worse than a loud failure:
  // say so rather than reporting a clean success.
  if (auditError)
    return json(
      {
        user_id: payload.userId,
        warning: `the password was changed but the audit entry failed: ${auditError.message}`,
      },
      200,
    );

  return json({ user_id: payload.userId });
});
