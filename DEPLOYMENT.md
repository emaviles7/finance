# Despliegue a producción

Esta guía documenta los pasos para migrar FamilyFinance de Supabase local (CLI + Docker) a un proyecto Supabase en la nube y desplegar el frontend en Vercel. **Estos pasos no se han ejecutado** — son la referencia para cuando se decida pasar a producción.

## 1. Crear el proyecto en Supabase

1. Crear una cuenta/organización en [supabase.com](https://supabase.com) y un nuevo proyecto.
2. Anotar: `Project URL`, `anon key`, `service_role key` (Settings → API) y la contraseña de la base de datos.
3. Elegir una región cercana a los usuarios (p. ej. `us-east-1` si la familia está en Centroamérica/EE. UU.).

## 2. Vincular el proyecto local y subir el esquema

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`db push` aplica, en orden, todas las migraciones de `supabase/migrations/` (001 a 016) sobre la base de datos remota: esquema, RLS, triggers, vistas materializadas, roles multi-tenant, funciones `SECURITY DEFINER`, líneas presupuestarias, cuenta madre, soft delete + auditoría, y transferencias externas/categorías de ahorro.

> Nota: la migración 015 (`ALTER TYPE ... ADD VALUE`) está deliberadamente separada de la 016 porque Postgres no permite usar un valor de enum nuevo dentro de la misma transacción en que se creó. `db push` aplica cada archivo en su propia transacción, así que el orden secuencial 015 → 016 es obligatorio y ya está resuelto en los nombres de archivo.

Verificar después del push:
- `SELECT * FROM pg_policies;` — confirmar que las políticas de `_isolation` y `_solo_editores_*` existen en todas las tablas de dominio.
- `SELECT * FROM pg_matviews;` — confirmar que `mv_presupuesto_mes` existe.
- Las extensiones `uuid-ossp`, `pg_trgm`, `unaccent`, `pg_cron` deben quedar habilitadas (la migración 001 las crea).

## 3. Configurar Auth en producción

En el dashboard de Supabase (Authentication → URL Configuration):
- `Site URL`: la URL de producción (p. ej. `https://familyfinance.vercel.app`).
- `Redirect URLs`: agregar la misma URL + `/onboarding` (usada por el flujo de invitación de miembros).

Configurar un proveedor SMTP real (Authentication → Email Templates / SMTP Settings) — en local, los correos de invitación y confirmación se capturan en Inbucket (`http://127.0.0.1:54324`) y nunca se envían de verdad; en producción esto requiere un SMTP configurado (Resend, SendGrid, etc.) para que `inviteUserByEmail` funcione.

## 4. Variables de entorno en Vercel

En el proyecto de Vercel (Settings → Environment Variables), configurar:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase en la nube |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key del proyecto en la nube |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (usada por `lib/supabase/admin.ts` para invitar miembros) — marcar como **secreta**, nunca exponerla con prefijo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | URL pública de producción (usada en el link de invitación) |

## 5. Deploy

```bash
npx vercel link
npx vercel --prod
```

O conectar el repositorio de GitHub directamente en el dashboard de Vercel para despliegues automáticos en cada push a `main`.

## 6. Post-deploy

- Crear el primer usuario admin real mediante `/registro` + `/onboarding` (este flujo crea la familia y el primer miembro con rol `admin` vía la función `fn_onboarding_crear_familia`).
- Invitar al resto de la familia desde Configuración → Miembros (requiere SMTP configurado, paso 3).
- Configurar un job periódico (Supabase Cron / `pg_cron`, ya habilitado) para refrescar `mv_presupuesto_mes` automáticamente en lugar de depender solo del refresh on-demand que hace la app tras cada transacción.
- Activar backups automáticos del proyecto (Settings → Database → Backups) — no están habilitados por defecto en el plan free.

## Notas de seguridad

- El aislamiento multi-tenant (RLS por hogar vía `fn_mis_familias()`) y el enforcement de roles (`admin`/`editor`/`lectura` vía `fn_puedo_editar()`) ya están implementados a nivel de base de datos — no dependen de lógica de la aplicación, por lo que se mantienen vigentes independientemente del entorno.
- Revisar `supabase/migrations/006_grants.sql` si se agregan tablas nuevas: cualquier tabla nueva en `public` necesita sus propios `GRANT` explícitos para los roles `anon`/`authenticated`, ya que el proyecto tiene desactivada la auto-exposición (`auto_expose_new_tables`).
