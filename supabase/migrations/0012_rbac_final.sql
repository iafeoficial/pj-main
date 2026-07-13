-- Correção final RBAC: helpers baseados só em membership (sem recursão);
-- dono entra na visibilidade de empresas por owner_id; trigger recria a membership do dono.

-- Helpers (membership-only; SECURITY DEFINER ignora RLS internamente).
create or replace function public.user_is_member(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.empresa_membros m where m.empresa_id = p_empresa_id and m.user_id = auth.uid());
$$;
create or replace function public.user_can_write(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.empresa_membros m
    where m.empresa_id = p_empresa_id and m.user_id = auth.uid()
      and m.papel in ('administrador','financeiro','gestor','comprador','vendedor')
  );
$$;
create or replace function public.user_has_role(p_empresa_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.empresa_membros m
    where m.empresa_id = p_empresa_id and m.user_id = auth.uid() and m.papel = any(p_roles)
  );
$$;

-- Empresas: dono OU membro lê; dono OU admin altera/exclui.
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas for select
  using (owner_id = auth.uid() or public.user_is_member(id));
drop policy if exists empresas_update on public.empresas;
create policy empresas_update on public.empresas for update
  using (owner_id = auth.uid() or public.user_has_role(id, array['administrador']));
drop policy if exists empresas_delete on public.empresas;
create policy empresas_delete on public.empresas for delete
  using (owner_id = auth.uid() or public.user_has_role(id, array['administrador']));

-- Trigger: dono vira administrador automaticamente.
create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.empresa_membros (empresa_id, user_id, email, papel)
  values (new.id, new.owner_id, coalesce(auth.jwt() ->> 'email', ''), 'administrador')
  on conflict (empresa_id, user_id) do nothing;
  return new;
end; $$;
drop trigger if exists trg_empresas_owner_member on public.empresas;
create trigger trg_empresas_owner_member after insert on public.empresas
  for each row execute function public.add_owner_membership();

drop function if exists public.dbg_count_all_membros(uuid);
