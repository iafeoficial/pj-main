# Setup do Supabase (Fase 2)

Guia para provisionar o **novo projeto Supabase exclusivo** do `financas_pj_app`.
Enquanto não estiver configurado, a aplicação continua rodando 100% na camada local.

## 1. Criar o projeto
1. Acesse https://supabase.com e crie um projeto (free tier serve).
2. Anote a senha do banco (necessária para o CLI).
3. Em **Project Settings → API**, copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY` (⚠️ nunca use a `service_role` no frontend)

## 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
# edite .env e cole URL + anon key
```

## 3. Aplicar o schema (migrations)
Com o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado:
```bash
supabase login
supabase link --project-ref <SEU_PROJECT_REF>   # ref está na URL do projeto
supabase db push                                 # aplica supabase/migrations/0001_init.sql
```
Alternativa sem CLI: abra o **SQL Editor** no painel do Supabase e cole o conteúdo de
`supabase/migrations/0001_init.sql`.

## 4. O que o schema cria
- Tabelas da Fase 1: `empresas`, `categorias`, `centros_custo`, `contas_pagar`,
  `contas_receber`, `audit_logs`.
- Tabelas da Fase 2: `extratos_bancarios`, `transacoes_bancarias`, `regras_conciliacao`.
- **RLS** isolando os dados por dono (`empresas.owner_id = auth.uid()`); tabelas filhas
  validam a posse via `user_owns_empresa()`.
- Triggers de `updated_at` e índices.

## 5. Autenticação (próximo passo da integração)
As políticas RLS exigem um usuário autenticado (`auth.uid()`). A tela de login/cadastro e a
troca da camada de dados local pela Supabase são uma tarefa dedicada — será feita após você
enviar `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, e validada isoladamente (build/lint/teste).

## 6. Recuperação de senha
Na tela de login, **Esqueci minha senha** chama `resetPasswordForEmail` do Supabase. O
usuário recebe um link no e-mail cadastrado e, ao abrir, define a nova senha na própria
aplicação (`updateUser`).

Em **Authentication → URL Configuration**, a URL do app (local e a do Coolify) precisa
estar em **Redirect URLs**. O link deve ser aberto no mesmo navegador em que foi pedido.

## 7. Verificação rápida
Depois de preencher o `.env`, rode `npm run dev`. O helper `isSupabaseConfigured()`
(`src/lib/supabase.ts`) passa a retornar `true`, habilitando a futura origem de dados Supabase.
