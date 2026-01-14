import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: "Missing Supabase environment variables." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("account_type")
    .eq("user_id", authData.user.id)
    .single();
  if (profileError || adminProfile?.account_type !== "admin") {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const fullName = (body.fullName || "").trim();
  const role = body.role === "admin" ? "admin" : "dentist";
  const clinicId = body.clinicId || null;

  if (!email || !password) {
    return jsonResponse({ error: "Email and password are required." }, 400);
  }

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !createdUser?.user?.id) {
    return jsonResponse({ error: createError?.message || "Failed to create user." }, 400);
  }

  const accountType = role === "admin" ? "admin" : "individual";
  const profileClinicId = role === "admin" ? null : clinicId;
  const { data: profile, error: upsertError } = await adminClient
    .from("profiles")
    .upsert(
      {
        user_id: createdUser.user.id,
        email,
        name: fullName || null,
        account_type: accountType,
        clinic_id: profileClinicId,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (upsertError) {
    return jsonResponse({ error: upsertError.message || "Failed to create profile." }, 400);
  }

  return jsonResponse({ profile });
});
