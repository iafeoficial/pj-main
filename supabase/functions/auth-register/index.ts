import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase();
    password = String(body.password ?? "");
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Informe e-mail e senha." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (password.length < 6) {
    return new Response(JSON.stringify({ error: "A senha deve ter ao menos 6 caracteres." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return new Response(JSON.stringify({ error: "Configuração do servidor incompleta." }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return new Response(
        JSON.stringify({ error: "Este e-mail já está cadastrado. Faça login." }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: createError.message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.session) {
    return new Response(
      JSON.stringify({ error: signInError?.message ?? "Conta criada, mas falha ao entrar." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ session: signInData.session, user: signInData.user }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
