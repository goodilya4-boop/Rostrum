CREATE SCHEMA IF NOT EXISTS medtrak;

ALTER TABLE IF EXISTS public.users SET SCHEMA medtrak;
ALTER TABLE IF EXISTS public.presentations SET SCHEMA medtrak;
ALTER TABLE IF EXISTS public.slides SET SCHEMA medtrak;
ALTER TABLE IF EXISTS public.practice_sessions SET SCHEMA medtrak;
ALTER TABLE IF EXISTS public.slide_changes SET SCHEMA medtrak;
ALTER TABLE IF EXISTS public.transcript_segments SET SCHEMA medtrak;
ALTER TABLE IF EXISTS public.session_slide_feedback SET SCHEMA medtrak;
ALTER TABLE IF EXISTS public.session_summary SET SCHEMA medtrak;
ALTER TABLE IF EXISTS public.asr_audio_chunks SET SCHEMA medtrak;

ALTER FUNCTION IF EXISTS public.calculate_duration() SET SCHEMA medtrak;
ALTER FUNCTION IF EXISTS public.update_presentation_slide_count() SET SCHEMA medtrak;
ALTER FUNCTION IF EXISTS public.validate_time_limit() SET SCHEMA medtrak;
ALTER FUNCTION IF EXISTS public.check_slide_change_index() SET SCHEMA medtrak;
ALTER FUNCTION IF EXISTS public.init_session_summary() SET SCHEMA medtrak;
ALTER FUNCTION IF EXISTS public.get_user_training_history(integer) SET SCHEMA medtrak;
ALTER FUNCTION IF EXISTS public.insert_transcript_batch(integer, jsonb) SET SCHEMA medtrak;
ALTER FUNCTION IF EXISTS public.get_slide_by_offset(integer, integer) SET SCHEMA medtrak;
ALTER FUNCTION IF EXISTS public.get_session_report(integer) SET SCHEMA medtrak;
