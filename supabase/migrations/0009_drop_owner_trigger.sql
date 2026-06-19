-- O bootstrap do dono como administrador passa a ser feito pelo app (token do usuário),
-- evitando a dependência de bypass de RLS em trigger SECURITY DEFINER.
drop trigger if exists trg_empresas_owner_member on public.empresas;
drop function if exists public.add_owner_membership();
