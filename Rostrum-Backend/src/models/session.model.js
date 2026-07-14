const db = require('../config/db');

const SessionModel = {
  async findById(id) {
    const query = 'SELECT * FROM practice_sessions WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  },

  async findByIdForUpdate(id, executor) {
    const { rows } = await executor.query(
      'SELECT * FROM practice_sessions WHERE id = $1 FOR UPDATE',
      [id]
    );
    return rows[0] || null;
  },

  async findByUser(userId) {
    const query = `
      SELECT * FROM practice_sessions
      WHERE user_id = $1
      ORDER BY start_time DESC
    `;
    const { rows } = await db.query(query, [userId]);
    return rows;
  },

  async create({ userId, presentationId, timeLimitSec, speechEngine = 'web' }) {
    const query = `
      INSERT INTO practice_sessions (user_id, presentation_id, start_time, time_limit_sec, speech_engine, status)
      VALUES ($1, $2, NOW(), $3, $4, 'in_progress')
      RETURNING *
    `;
    const { rows } = await db.query(query, [userId, presentationId, timeLimitSec, speechEngine]);
    return rows[0];
  },

  async complete(sessionId, executor = db) {
    const query = `
      UPDATE practice_sessions
      SET end_time = NOW(), status = 'completed'
      WHERE id = $1 AND status = 'in_progress'
      RETURNING *
    `;
    const { rows } = await executor.query(query, [sessionId]);
    return rows[0];
  },

  async addSlideChanges(sessionId, changes) {
    const values = changes.map((_, i) =>
      `($1, $${i * 2 + 2}, $${i * 2 + 3})`
    ).join(', ');

    const params = [sessionId];
    changes.forEach(({ slide_index, timestamp_offset_ms }) => {
      params.push(slide_index, timestamp_offset_ms);
    });

    const query = `
      INSERT INTO slide_changes (session_id, slide_index, timestamp_offset_ms)
      VALUES ${values}
      RETURNING *
    `;
    const { rows } = await db.query(query, params);
    return rows;
  },

  async getSlideChanges(sessionId) {
    const query = `
      SELECT * FROM slide_changes
      WHERE session_id = $1
      ORDER BY timestamp_offset_ms
    `;
    const { rows } = await db.query(query, [sessionId]);
    return rows;
  },

  async addTranscriptSegments(sessionId, segments, executor = db) {
    if (!segments.length) return [];
    const values = segments.map((_, index) => {
      const offset = index * 7;
      return `($1, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
    }).join(', ');

    const params = [sessionId];
    segments.forEach(segment => {
      params.push(
        segment.start_ms,
        segment.end_ms,
        segment.spoken_text,
        segment.source || 'web',
        segment.confidence ?? null,
        segment.externalId || null,
        segment.asrChunkId || null
      );
    });

    const query = `
      INSERT INTO transcript_segments (
        session_id, start_ms, end_ms, spoken_text, source,
        confidence, external_id, asr_chunk_id
      )
      VALUES ${values}
      ON CONFLICT (session_id, source, external_id)
      WHERE external_id IS NOT NULL
      DO NOTHING
      RETURNING *
    `;

    const { rows } = await executor.query(query, params);
    return rows;
  },

  async createAsrChunk(
    { sessionId, chunkId, offsetMs, mimeType, byteSize, contentSha256 },
    executor = db
  ) {
    const query = `
      INSERT INTO asr_audio_chunks (
        session_id, chunk_id, offset_ms, mime_type, byte_size, content_sha256
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (session_id, chunk_id) DO NOTHING
      RETURNING *
    `;
    const { rows } = await executor.query(
      query,
      [sessionId, chunkId, offsetMs, mimeType, byteSize, contentSha256]
    );
    return rows[0] || null;
  },

  async findAsrChunk(sessionId, chunkId, executor = db) {
    const { rows } = await executor.query(
      'SELECT * FROM asr_audio_chunks WHERE session_id = $1 AND chunk_id = $2',
      [sessionId, chunkId]
    );
    return rows[0] || null;
  },

  async reclaimAsrChunk(
    chunkId,
    { offsetMs, mimeType, byteSize, contentSha256 },
    executor = db
  ) {
    const query = `
      UPDATE asr_audio_chunks
      SET status = 'processing', offset_ms = $2, mime_type = $3, byte_size = $4,
          content_sha256 = $5,
          error_message = NULL, updated_at = NOW()
      WHERE id = $1
        AND (status = 'failed' OR (status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes'))
      RETURNING *
    `;
    const { rows } = await executor.query(
      query,
      [chunkId, offsetMs, mimeType, byteSize, contentSha256]
    );
    return rows[0] || null;
  },

  async completeAsrChunk(chunkId, executor = db) {
    const { rows } = await executor.query(
      `UPDATE asr_audio_chunks
       SET status = 'completed', error_message = NULL, updated_at = NOW()
       WHERE id = $1 AND status = 'processing'
       RETURNING *`,
      [chunkId]
    );
    return rows[0] || null;
  },

  async failAsrChunk(chunkId, message) {
    await db.query(
      `UPDATE asr_audio_chunks
       SET status = 'failed', error_message = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'processing'`,
      [chunkId, String(message || 'Unknown Vosk error').slice(0, 1000)]
    );
  },

  async getTranscriptSegmentsByChunk(chunkId, executor = db) {
    const { rows } = await executor.query(
      `SELECT * FROM transcript_segments
       WHERE asr_chunk_id = $1
       ORDER BY start_ms`,
      [chunkId]
    );
    return rows;
  },

  async getTranscriptSegmentsByExternalIds(sessionId, source, externalIds, executor = db) {
    const { rows } = await executor.query(
      `SELECT * FROM transcript_segments
       WHERE session_id = $1 AND source = $2 AND external_id = ANY($3::varchar[])
       ORDER BY start_ms, id`,
      [sessionId, source, externalIds]
    );
    return rows;
  },

  async countUnresolvedAsrChunks(sessionId, executor = db) {
    const { rows } = await executor.query(
      `SELECT COUNT(*)::int AS count
       FROM asr_audio_chunks
       WHERE session_id = $1 AND status <> 'completed'`,
      [sessionId]
    );
    return rows[0]?.count || 0;
  },

  async listAsrChunks(sessionId) {
    const { rows } = await db.query(
      `SELECT chunk_id, offset_ms, mime_type, byte_size, status, error_message,
              created_at, updated_at
       FROM asr_audio_chunks
       WHERE session_id = $1
       ORDER BY offset_ms, id`,
      [sessionId]
    );
    return rows;
  },
async getUserTrainingHistoryPaginated(userId, limit, offset) {
  const query = `
    SELECT * FROM get_user_training_history($1)
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [userId, limit, offset]);
  return rows;
},

async getUserTrainingHistoryCount(userId) {
  const query = `
    SELECT COUNT(*)::int AS total
    FROM practice_sessions
    WHERE user_id = $1 AND status = 'completed'
  `;
  const { rows } = await db.query(query, [userId]);
  return rows[0]?.total || 0;
},

  async getTranscriptSegments(sessionId) {
    const query = `
      SELECT * FROM transcript_segments
      WHERE session_id = $1
      ORDER BY start_ms
    `;
    const { rows } = await db.query(query, [sessionId]);
    return rows;
  },

  async saveSlideFeedback(sessionId, slideIndex, feedback, executor = db) {
    const query = `
      INSERT INTO session_slide_feedback (session_id, slide_index, coverage_score, matched_phrases, missed_phrases, spoken_keywords)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (session_id, slide_index)
      DO UPDATE SET
        coverage_score = $3,
        matched_phrases = $4,
        missed_phrases = $5,
        spoken_keywords = $6
      RETURNING *
    `;
    const { rows } = await executor.query(query, [
      sessionId,
      slideIndex,
      feedback.coverageScore,
      feedback.matchedPhrases,
      feedback.missedPhrases,
      feedback.spokenKeywords,
    ]);
    return rows[0];
  },

  async deleteSlideFeedback(sessionId, executor = db) {
    await executor.query(
      'DELETE FROM session_slide_feedback WHERE session_id = $1',
      [sessionId]
    );
  },

  async saveSummary(sessionId, summary, executor = db) {
    const query = `
      UPDATE session_summary
      SET
        timing_adherence = $1,
        overall_coverage = $2,
        filler_word_count = $3,
        speech_rate_wpm = $4,
        suggestions = $5,
        radar_data = $6,
        analysis_version = $7,
        analysis_status = $8,
        analyzed_at = NOW()
      WHERE session_id = $9
      RETURNING *
    `;
    const { rows } = await executor.query(query, [
      summary.timingAdherence,
      summary.overallCoverage,
      summary.fillerWordCount,
      summary.speechRateWpm,
      summary.suggestions,
      summary.radarData || {},
      summary.analysisVersion,
      summary.analysisStatus,
      sessionId,
    ]);
    return rows[0];
  },

  async getHistory(userId) {
    const query = 'SELECT * FROM get_user_training_history($1)';
    const { rows } = await db.query(query, [userId]);
    return rows;
  },

  async getReport(sessionId) {
    const query = 'SELECT * FROM get_session_report($1)';
    const { rows } = await db.query(query, [sessionId]);
    return rows;
  },

  async getSummary(sessionId) {
    const query = 'SELECT * FROM session_summary WHERE session_id = $1';
    const { rows } = await db.query(query, [sessionId]);
    return rows[0] || null;
  },

  async getSlideFeedback(sessionId) {
    const query = `
      SELECT * FROM session_slide_feedback
      WHERE session_id = $1
      ORDER BY slide_index
    `;
    const { rows } = await db.query(query, [sessionId]);
    return rows;
  },

  async getSlideByOffset(sessionId, offsetMs) {
    const query = 'SELECT get_slide_by_offset($1, $2) as slide_index';
    const { rows } = await db.query(query, [sessionId, offsetMs]);
    return rows[0]?.slide_index || 1;
  },
};

module.exports = SessionModel;
