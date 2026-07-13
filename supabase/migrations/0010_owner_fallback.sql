-- O dono da empresa (owner_id) é sempre membro implícito e administrador.
-- Resolve o "chicken-and-egg" (criar empresa e poder lê-la antes de existir membership)
-- e garante acesso total ao dono mesmo sem linha em empresa_membros.

create or replace function public.user_is_member(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.empresa_membros m where m.empresa_id = p_empresa_id and m.user_id = auth.uid())
      or exists (select 1 from public.empresas e where e.id = p_empresa_id and e.owner_id = auth.uid());
$$;

create or replace function public.user_can_write(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.empresa_membros m
      where m.empresa_id = p_empresa_id and m.user_id = auth.uid()
        and m.papel in ('administrador','financeiro','gestor','comprador','vendedor')
    )
    or exists (select 1 from public.empresas e where e.id = p_empresa_id and e.owner_id = auth.uid());
$$;

create or replace function public.user_has_role(p_empresa_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.empresa_membros m
      where m.empresa_id = p_empresa_id and m.user_id = auth.uid() and m.papel = any(p_roles)
    )
    or (('administrador' = any(p_roles))
        and exists (select 1 from public.empresas e where e.id = p_empresa_id and e.owner_id = auth.uid()));
$$;
