// admin-create-user — runbook step 6.
//
// Privileged action: creates a Supabase Auth user AND its app_users row.
// Caller must be SUPER_ADMIN (any role) or a SCHOOL_ADMIN creating classroom
// staff for their own institution (§17). Validated server-side with the JWT.
// Uses the service-role key ONLY inside this Deno environment (set via
// `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`), never the frontend.

import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_ROLES = new Set([
  'super_admin',
  'school_admin',
  'operations_manager',
  'finance_owner',
  'viewer',
  'parent',
  'classroom_staff',
  'kitchen',
  'driver',
]);
// school_admin / classroom_staff are institution-scoped. kitchen is scoped to
// a Kitchen entity instead (docs/13 Decision 031) — LunchBox Connect side,
// not the Nursery/School side, so it is intentionally NOT in this set.
const STAFF_ROLES = new Set(['school_admin', 'classroom_staff']);

interface Payload {
  email: string;
  password: string;
  fullName: string;
  role: string;
  institutionId?: string | null;
  kitchenId?: string | null;
  phone?: string | null;
  // Confirms the email so the account can sign in immediately with the
  // temporary password. The app's provisioning screens pass true (there is no
  // email-invitation flow yet — that is BLOCKED_BY_SPEC). false would create an
  // unconfirmed account that cannot authenticate under the default model, so it
  // must not be presented to an Admin as "ready to use".
  authenticate?: boolean;
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

  // Caller authorization (§14/§17). A Super Admin may create any allowed role.
  // A School/Nursery Admin may create ONLY classroom_staff, and ONLY scoped to
  // their own institution — never a system-level role, never another
  // institution. Anyone else is refused.
  const { data: caller } = await adminDb
    .from('app_users')
    .select('role, institution_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const callerRole = caller?.role ?? null;
  const isSuper = callerRole === 'super_admin';
  const isSchoolAdmin = callerRole === 'school_admin';
  if (!isSuper && !isSchoolAdmin) return bad('forbidden', 403);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return bad('invalid JSON body');
  }

  if (!payload.email || !payload.fullName || !payload.role)
    return bad('email, fullName and role are required');
  if (!ALLOWED_ROLES.has(payload.role)) return bad(`role not allowed: ${payload.role}`);

  // Scope enforcement for a Nursery Admin caller.
  if (isSchoolAdmin) {
    if (payload.role !== 'classroom_staff')
      return bad('a Nursery Admin may only create classroom staff', 403);
    if (!payload.institutionId || payload.institutionId !== caller?.institution_id)
      return bad('a Nursery Admin may only create staff for their own institution', 403);
  }

  if (STAFF_ROLES.has(payload.role) && !payload.institutionId)
    return bad('staff roles require institutionId');
  if (payload.role === 'kitchen' && !payload.kitchenId)
    return bad('kitchen role requires kitchenId');
  if (!payload.password || payload.password.length < 8)
    return bad('password must be at least 8 characters');

  const { data: created, error: createError } = await adminDb.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: payload.authenticate ?? false,
    user_metadata: { full_name: payload.fullName },
  });

  if (createError || !created.user)
    return bad(createError?.message ?? 'failed to create auth user', 400);

  const { error: profileError } = await adminDb.from('app_users').insert({
    user_id: created.user.id,
    role: payload.role,
    // kitchen is a LunchBox Connect entity, not an Institution (docs/13
    // Decision 031) — never write institutionId for it, even if supplied.
    institution_id: payload.role === 'kitchen' ? null : (payload.institutionId ?? null),
    kitchen_id: payload.role === 'kitchen' ? payload.kitchenId : null,
    full_name: payload.fullName,
    email: payload.email,
    phone: payload.phone ?? null,
  });

  if (profileError) {
    // Roll back the auth user so we don't leave a half-created account.
    await adminDb.auth.admin.deleteUser(created.user.id);
    return bad(profileError.message, 400);
  }

  return json({ user_id: created.user.id, email: payload.email, role: payload.role });
});
