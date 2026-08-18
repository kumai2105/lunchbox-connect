// admin-create-user — runbook step 6.
//
// Privileged action: creates a Supabase Auth user AND its app_users row.
// Caller must already be SUPER_ADMIN (validated server-side with the JWT).
// Uses the service-role key ONLY inside this Deno environment (set via
// `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`), never the frontend.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.1';

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
const STAFF_ROLES = new Set(['school_admin', 'classroom_staff', 'kitchen']);

interface Payload {
  email: string;
  password: string;
  fullName: string;
  role: string;
  institutionId?: string | null;
  phone?: string | null;
  // when false, the account is created without confirming the email (invite-like)
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

async function callerIsSuperAdmin(adminDb: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await adminDb
    .from('app_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role === 'super_admin';
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
  if (!(await callerIsSuperAdmin(adminDb, user.id))) return bad('forbidden', 403);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return bad('invalid JSON body');
  }

  if (!payload.email || !payload.fullName || !payload.role)
    return bad('email, fullName and role are required');
  if (!ALLOWED_ROLES.has(payload.role)) return bad(`role not allowed: ${payload.role}`);
  if (STAFF_ROLES.has(payload.role) && !payload.institutionId)
    return bad('staff roles require institutionId');
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
    institution_id: payload.institutionId ?? null,
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
