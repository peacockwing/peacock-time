-- Enables Supabase Realtime (postgres_changes) for the activity tracking
-- table. Without this, INSERT/UPDATE/DELETE on activity_log never reach
-- subscribed clients even though RLS/permissions are otherwise fine -
-- Realtime only broadcasts changes for tables explicitly added to the
-- `supabase_realtime` publication.
--
-- Safe to re-run: skips tables already in the publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'activity_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
  END IF;
END $$;

-- Client subscriptions filter on family_code (e.g. `family_code=eq.FAM-XXXX`).
-- With the default REPLICA IDENTITY (primary key only), DELETE - and some
-- UPDATE - events only carry the row's id in the WAL, so a filter on any
-- other column never matches and the event is silently dropped. FULL
-- includes every column in the old-row image so those filters work.
ALTER TABLE activity_log REPLICA IDENTITY FULL;
ALTER TABLE checklist REPLICA IDENTITY FULL;
ALTER TABLE inventory REPLICA IDENTITY FULL;
