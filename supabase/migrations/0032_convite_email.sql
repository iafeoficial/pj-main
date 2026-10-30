-- Convites: a pessoa convidada precisa ver o nome da empresa antes de aceitar
-- (empresas_select só libera membro). RPC SECURITY DEFINER devolve o próprio convite.

create or replace function public.meus_convites_pendentes()
returns table (
  id uuid,
  empresa_id uuid,
  email text,
  papel text,
  status text,
  created_at timestamptz,
  empresa_nome text
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.empresa_id,
    c.email,
    c.papel,
    c.status,
    c.created_at,
    e.razao_social
  from public.convites c
  join public.empresas e on e.id = c.empresa_id
  where c.status = 'pendente'
    and lower(c.email) = lower(auth.jwt() ->> 'email');
$$;

revoke all on function public.meus_convites_pendentes() from public, anon;
grant execute on function public.meus_convites_pendentes() to authenticated;

-- Um convite pendente por e-mail e empresa.
create unique index if not exists uq_convites_pendente_email
  on public.convites (empresa_id, lower(email))
  where status = 'pendente';
