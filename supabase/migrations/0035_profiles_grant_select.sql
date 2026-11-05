-- Corrige leitura do perfil pelo usuário autenticado (bloqueio de conta no Gate).
grant select on public.profiles to authenticated;
