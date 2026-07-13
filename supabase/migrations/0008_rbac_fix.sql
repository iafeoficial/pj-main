-- =====================================================================
-- Correção RBAC: políticas de empresa_membros/convites não dependem de bypass
-- de RLS (que não é garantido em funções SECURITY DEFINER no Supabase).
-- Permite: bootstrap do dono como admin (trigger) e auto-aceite de convite.
-- =====================================================================

-- Trigger do dono usa o e-mail do JWT (evita depender de SELECT em auth.users).
create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.empresa_membros (empresa_id, user_id, email, papel)
  values (new.id, new.owner_id, coalesce(auth.jwt() ->> 'email', ''), 'administrador')
  on conflict (empresa_id, user_id) do nothing;
  return new;
end; $$;

-- empresa_membros: admin OU dono (bootstrap) OU convite pendente compatível.
drop policy if exists membros_insert on public.empresa_membros;
create policy membros_insert on public.empresa_membros for insert
  with check (
    public.user_has_role(empresa_id, array['administrador'])
    or auth.uid() = (select e.owner_id from public.empresas e where e.id = empresa_id)
    or exists (
      select 1 from public.convites c
      where c.empresa_id = empresa_id
        and lower(c.email) = lower(auth.jwt() ->> 'email')
        and c.papel = papel
        and c.status = 'pendente'
    )
  );

-- convites: o convidado pode atualizar o próprio convite (aceitar/recusar).
drop policy if exists convites_update on public.convites;
create policy convites_update on public.convites for update
  using (
    public.user_has_role(empresa_id, array['administrador'])
    or lower(email) = lower(auth.jwt() ->> 'email')
  );

-- accept_invite continua como conveniência (agora compatível com as policies).
create or replace function public.accept_invite(p_convite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.convites; uemail text;
begin
  select * into c from public.convites where id = p_convite_id;
  if c.id is null then raise exception 'Convite não encontrado.'; end if;
  uemail := lower(auth.jwt() ->> 'email');
  if lower(c.email) <> uemail then raise exception 'Convite não pertence a este usuário.'; end if;
  if c.status <> 'pendente' then raise exception 'Convite não está mais pendente.'; end if;
  insert into public.empresa_membros (empresa_id, user_id, email, papel)
  values (c.empresa_id, auth.uid(), uemail, c.papel)
  on conflict (empresa_id, user_id) do update set papel = excluded.papel;
  update public.convites set status = 'aceito' where id = p_convite_id;
end; $$;

-- Remove funções de debug.
drop function if exists public.dbg_policies(text);
drop function if exists public.dbg_uid();
