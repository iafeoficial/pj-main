# Multi-stage build for Vite SPA (Coolify / Docker)
#
# Coolify build arguments (Environment → Build Arguments):
#   VITE_SUPABASE_URL      — Project URL from Supabase → Settings → API
#   VITE_SUPABASE_ANON_KEY — anon/public key (never service_role)
#
# These are baked into the bundle at build time (Vite import.meta.env).

FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
