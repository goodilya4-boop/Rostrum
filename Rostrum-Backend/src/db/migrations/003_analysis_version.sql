ALTER TABLE session_summary
ADD COLUMN analysis_version VARCHAR(20),
ADD COLUMN analysis_status VARCHAR(30) NOT NULL DEFAULT 'pending',
ADD COLUMN analyzed_at TIMESTAMPTZ;

ALTER TABLE session_summary
ADD CONSTRAINT chk_session_summary_analysis_status
CHECK (analysis_status IN ('pending', 'completed', 'insufficient_data'));

COMMENT ON COLUMN session_summary.analysis_version IS
'Версия алгоритма, которым рассчитаны сохранённые метрики';

COMMENT ON COLUMN session_summary.analysis_status IS
'Состояние результата: pending, completed или insufficient_data';

COMMENT ON COLUMN session_summary.analyzed_at IS
'Дата и время успешного сохранения результата анализа';
