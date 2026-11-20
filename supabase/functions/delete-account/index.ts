import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

// Keep this file understandable to editors that are not using Deno types.
const deno = (globalThis as typeof globalThis & {
  Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: (request: Request) => Response | Promise<Response>): void;
  };
}).Deno;

const supabaseUrl = deno.env.get("SUPABASE_URL")!;
const anonKey = deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigin = deno.env.get("APP_ORIGIN") ?? "*";

function headers(origin: string | null) {
  const allowOrigin = allowedOrigin === "*" || origin === allowedOrigin ? (origin ?? "*") : "null";
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const cors = headers(origin);

  if (allowedOrigin !== "*" && origin && origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: "This site is not allowed." }), { status: 403, headers: cors });
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST for this request." }), { status: 405, headers: cors });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return new Response(JSON.stringify({ error: "Please sign in first." }), { status: 401, headers: cors });

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: "Your sign-in has expired. Sign in again." }), { status: 401, headers: cors });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await adminClient.auth.admin.deleteUser(authData.user.id);
  if (error) {
    console.error("Account delete failed", error.message);
    return new Response(JSON.stringify({ error: "Could not delete the account. Please try again." }), { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
});

