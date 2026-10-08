-- Move an existing Rostrum installation from public to medtrak.
-- Fresh installations already create objects in medtrak via search_path.
CREATE SCHEMA IF NOT EXISTS medtrak;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'presentations', 'slides', 'practice_sessions', 'slide_changes',
    'transcript_segments', 'session_slide_feedback', 'session_summary', 'asr_audio_chunks'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL
       AND to_regclass('medtrak.' || table_name) IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA medtrak', table_name);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'calculate_duration',
        'update_presentation_slide_count',
        'validate_time_limit',
        'check_slide_change_index',
        'init_session_summary',
        'get_user_training_history',
        'insert_transcript_batch',
        'get_slide_by_offset',
        'get_session_report'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA medtrak', fn.proname, fn.args);
  END LOOP;
END $$;
