import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function redirectEmpresas(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return `${u.origin}/empresas`;
  } catch {
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Configuração do servidor incompleta." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Não autenticado." }, 401);

  let empresaId = "";
  let email = "";
  let redirectTo = "";
  try {
    const body = await req.json();
    empresaId = String(body.empresaId ?? "");
    email = String(body.email ?? "").trim().toLowerCase();
    redirectTo = redirectEmpresas(String(body.redirectTo ?? ""));
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  if (!empresaId || !email) return json({ error: "Informe empresa e e-mail." }, 400);

  const { data: membro } = await userClient
    .from("empresa_membros")
    .select("papel")
    .eq("empresa_id", empresaId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (membro?.papel !== "administrador") {
    return json({ error: "Apenas administradores enviam convites." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: convite } = await admin
    .from("convites")
    .select("id, papel, status")
    .eq("empresa_id", empresaId)
    .eq("status", "pendente")
    .ilike("email", email)
    .maybeSingle();
  if (!convite) return json({ error: "Convite pendente não encontrado." }, 404);

  const authHeaders = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "Content-Type": "application/json",
  };

  const inviteUrl = redirectTo
    ? `${supabaseUrl}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`
    : `${supabaseUrl}/auth/v1/invite`;

  const inviteRes = await fetch(inviteUrl, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email,
      data: { convite_empresa_id: empresaId, papel: convite.papel },
    }),
  });
  const inviteBody = await inviteRes.json().catch(() => ({}));
  const inviteMsg = String((inviteBody as { msg?: string; error_description?: string; message?: string }).msg ??
    (inviteBody as { error_description?: string }).error_description ??
    (inviteBody as { message?: string }).message ??
    "").toLowerCase();

  if (inviteRes.ok) {
    return json({ ok: true, canal: "convite" });
  }

  const jaCadastrado =
    inviteRes.status === 422 ||
    inviteMsg.includes("already") ||
    inviteMsg.includes("registered") ||
    inviteMsg.includes("exists");

  if (!jaCadastrado) {
    return json({ error: inviteMsg || "Falha ao enviar o convite por e-mail." }, 400);
  }

  const otpUrl = redirectTo
    ? `${supabaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`
    : `${supabaseUrl}/auth/v1/otp`;
  const otpRes = await fetch(otpUrl, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ email, create_user: false }),
  });
  if (!otpRes.ok) {
    const otpBody = await otpRes.json().catch(() => ({}));
    const otpMsg = String(
      (otpBody as { msg?: string; error_description?: string; message?: string }).msg ??
        (otpBody as { error_description?: string }).error_description ??
        (otpBody as { message?: string }).message ??
        "Falha ao enviar o e-mail.",
    );
    return json({ error: otpMsg }, 400);
  }

  return json({ ok: true, canal: "acesso" });
});
