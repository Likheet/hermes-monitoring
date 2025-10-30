# Supabase Backup Checklist

The current production project at `wtfnntauwvsgohfmhgyo.supabase.co` contains more than just the `public` schema. Use this checklist before pruning any archive tables so you can restore every feature if needed.

## 1. Database Schemas

| Schema | Purpose | Notes | Suggested Dump Command |
| --- | --- | --- | --- |
| public | Application data (tasks, maintenance, *_backup tables, triggers/functions) | Includes `tasks_backup`, `users_backup`, plus maintenance/notification history. RLS currently disabled on these tables. | `pg_dump --schema=public` (already covered by your existing dump) |
| auth | Supabase auth users, sessions, MFA metadata | 20+ system tables; required to restore login state and auth settings. | `pg_dump --schema=auth` |
| storage | Storage metadata (bucket config, object manifests) | Bucket `task-photos` with ~350 objects plus migrations table. | `pg_dump --schema=storage` |
| realtime | Realtime replication metadata and WAL subscribers | Contains rolling `messages_YYYY_MM_DD` tables and subscription catalog. | `pg_dump --schema=realtime` |
| supabase_migrations | Supabase migration ledger | Needed if you rely on Supabase migration history. | `pg_dump --schema=supabase_migrations` |
| vault | Encrypted secrets (currently empty) | Table exists even without rows; keep schema for future use. | `pg_dump --schema=vault` |
| graphql / graphql_public | Auto-generated GraphQL helpers | Dump is optional but recommended for consistency. | `pg_dump --schema=graphql --schema=graphql_public` |
| pgbouncer, extensions | Managed by Supabase | Skip; Supabase recreates them. |

**Tip:** Run one multi-schema dump to capture everything:
```
pg_dump --format=custom --schema=public --schema=auth --schema=storage --schema=realtime --schema=supabase_migrations --schema=vault --schema=graphql --schema=graphql_public --file backups/hermes-full-$(Get-Date -Format yyyyMMdd-HHmmss).dump
```

## 2. Functions, Triggers, and Scheduled Jobs

- Custom routines detected in `public`:
  - `record_system_metrics`, `cleanup_old_metrics`, `archive_old_tasks`, `delete_old_notifications`, `create_task_with_autopause`, `list_tasks_summary`, `create_default_preferences`, `handle_new_user`, and `update_updated_at_column` trigger helper.
  - All of these live in the schemas listed above; ensuring the schema dump includes `--schema=public` will capture them.
- No entries in `cron.job`; pg_cron is not configured, so there are no scheduled jobs to export.

## 3. Storage Buckets

- Bucket `task-photos` (public=true, STANDARD type, 10 MB per-object limit) with ~350 objects.
- Export objects separately; database dumps only include metadata. Options:
  1. `supabase storage download task-photos ./storage-backup/task-photos`
  2. Or use `aws s3 sync` against the projects S3-compatible endpoint (credentials from Supabase dashboard).

## 4. Auth & Security Configuration

- RLS: `public` tables currently show `rls_enabled=false`; confirm in Supabase dashboard if any policies exist that need recreation after schema changes.
- Auth templates, rate limits, and provider settings are **not** inside Postgres. Capture them via the Supabase dashboard (Settings  Authentication  Export) or document manually.
- JWT secret / service role keys already exist in `.env.local`; store them securely with the backups.

## 5. Other Resources

- Edge Functions: none deployed (`supabase functions list` returns empty).
- Storage global config: `fileSizeLimit=50 MB`, image transformation and S3 protocol enabled; note any custom limits you may want to recreate (`mcp_supabase_get_storage_config`).
- `vault.secrets` currently has 0 rows, but keep the schema if you plan to add secrets later.

## 6. Restore Dry Run

After pruning archive tables, verify you can restore into a staging database:
1. Create a blank database.
2. Restore the full dump: `pg_restore --clean --if-exists --create --dbname=postgres --schema=... hermes-full-YYYYMMDD-HHMMSS.dump`.
3. Reupload a sample of storage files and confirm the application boots with Supabase pointing to the restored instance.

Keeping the above assets ensures you can roll back even if archive data is permanently deleted.
