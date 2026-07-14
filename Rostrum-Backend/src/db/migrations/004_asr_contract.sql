CREATE TABLE asr_audio_chunks (
    id              SERIAL PRIMARY KEY,
    session_id      INT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
    chunk_id        VARCHAR(100) NOT NULL,
    offset_ms       INT NOT NULL CHECK (offset_ms >= 0),
    mime_type       VARCHAR(100) NOT NULL,
    byte_size       INT NOT NULL CHECK (byte_size > 0),
    content_sha256  CHAR(64) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'completed', 'failed')),
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, chunk_id)
);

ALTER TABLE transcript_segments
ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'web',
ADD COLUMN confidence FLOAT,
ADD COLUMN external_id VARCHAR(150),
ADD COLUMN asr_chunk_id INT REFERENCES asr_audio_chunks(id) ON DELETE CASCADE;

ALTER TABLE transcript_segments
ADD CONSTRAINT chk_transcript_source CHECK (source IN ('web', 'vosk')),
ADD CONSTRAINT chk_transcript_confidence CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX idx_transcript_external_id
ON transcript_segments(session_id, source, external_id)
WHERE external_id IS NOT NULL;

CREATE INDEX idx_transcript_asr_chunk_id
ON transcript_segments(asr_chunk_id);

COMMENT ON TABLE asr_audio_chunks IS
'Идемпотентные аудиочанки, переданные во внешний Vosk-сервис';

COMMENT ON COLUMN transcript_segments.source IS
'Источник канонического сегмента: web или vosk';

COMMENT ON COLUMN transcript_segments.external_id IS
'Идентификатор сегмента на стороне клиента для защиты от повторной отправки';
