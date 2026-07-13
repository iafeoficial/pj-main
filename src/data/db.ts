// Camada de acesso ao Supabase (Fase 2 — C3).
// Substitui a persistência local. O isolamento por empresa é garantido pela RLS
// (owner_id = auth.uid()) e reforçado por filtros empresa_id nas queries.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function db(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

// ---- Conversão de chaves camelCase <-> snake_case ----
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

type Row = Record<string, unknown>;

export function rowToEntity<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}

export function entityToRow(obj: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(obj)) out[toSnake(k)] = v;
  return out;
}

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

type NewData<T> = Omit<T, "id" | "createdAt" | "updatedAt" | "empresaId">;
type UpdateData<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt" | "empresaId">>;

/** Tabela pertencente a uma empresa (filtra por empresa_id). */
export class OwnedTable<T extends { id: string }> {
  constructor(private readonly table: string) {}

  async list(empresaId: string, orderBy?: { column: string; ascending?: boolean }): Promise<T[]> {
    let q = db().from(this.table).select("*").eq("empresa_id", empresaId);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await q;
    throwIf(error);
    return (data ?? []).map((r) => rowToEntity<T>(r as Row));
  }

  async find(empresaId: string, id: string): Promise<T | undefined> {
    const { data, error } = await db()
      .from(this.table)
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("id", id)
      .maybeSingle();
    throwIf(error);
    return data ? rowToEntity<T>(data as Row) : undefined;
  }

  async create(empresaId: string, payload: NewData<T>): Promise<T> {
    const row = { ...entityToRow(payload as Record<string, unknown>), empresa_id: empresaId };
    const { data, error } = await db().from(this.table).insert(row).select().single();
    throwIf(error);
    return rowToEntity<T>(data as Row);
  }

  async update(empresaId: string, id: string, payload: UpdateData<T>): Promise<T> {
    const { data, error } = await db()
      .from(this.table)
      .update(entityToRow(payload as Record<string, unknown>))
      .eq("empresa_id", empresaId)
      .eq("id", id)
      .select()
      .single();
    throwIf(error);
    return rowToEntity<T>(data as Row);
  }

  async remove(empresaId: string, id: string): Promise<void> {
    const { error } = await db()
      .from(this.table)
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", id);
    throwIf(error);
  }
}

/** Tabela global filtrada pela RLS por dono (ex.: empresas). */
export class GlobalTable<T extends { id: string }> {
  constructor(private readonly table: string) {}

  async list(orderBy?: { column: string; ascending?: boolean }): Promise<T[]> {
    let q = db().from(this.table).select("*");
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await q;
    throwIf(error);
    return (data ?? []).map((r) => rowToEntity<T>(r as Row));
  }

  async find(id: string): Promise<T | undefined> {
    const { data, error } = await db().from(this.table).select("*").eq("id", id).maybeSingle();
    throwIf(error);
    return data ? rowToEntity<T>(data as Row) : undefined;
  }

  async create(payload: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T> {
    const { data, error } = await db()
      .from(this.table)
      .insert(entityToRow(payload as Record<string, unknown>))
      .select()
      .single();
    throwIf(error);
    return rowToEntity<T>(data as Row);
  }

  async update(id: string, payload: Partial<T>): Promise<T> {
    const { data, error } = await db()
      .from(this.table)
      .update(entityToRow(payload as Record<string, unknown>))
      .eq("id", id)
      .select()
      .single();
    throwIf(error);
    return rowToEntity<T>(data as Row);
  }

  async remove(id: string): Promise<void> {
    const { error } = await db().from(this.table).delete().eq("id", id);
    throwIf(error);
  }
}
