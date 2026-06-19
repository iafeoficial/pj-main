// Cliente Supabase (Fase 2+). Opcional: se as variáveis de ambiente não estiverem
// configuradas, `supabase` é null e a aplicação segue usando a camada local.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True quando há URL + anon key válidas configuradas. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && url.startsWith("http"));
}

/**
 * Instância única do cliente Supabase, ou `null` se não configurado.
 * Importante: enquanto o backend não estiver provisionado, a app roda 100% local.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
