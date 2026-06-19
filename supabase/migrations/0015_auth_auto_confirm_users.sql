-- Confirma usuários existentes sem e-mail verificado (dev/demo).
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email_confirmed_at IS NULL;
