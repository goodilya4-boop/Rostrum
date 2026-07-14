import apiClient from './client';

export const sessionsAPI = {
  getHistory(page = 1, limit = 20) {
    return apiClient.get('/sessions', { params: { page, limit } });
  },

  getById(sessionId) {
    return apiClient.get(`/sessions/${sessionId}`);
  },

  getAsrCapabilities() {
    return apiClient.get('/sessions/asr/capabilities');
  },

  getAsrChunks(sessionId) {
    return apiClient.get(`/sessions/${sessionId}/asr/chunks`);
  },

  create({ presentationId, timeLimitSec, speechEngine = 'web' }) {
    return apiClient.post('/sessions', {
      presentation_id: presentationId,
      time_limit_sec: timeLimitSec,
      speech_engine: speechEngine,
    });
  },

  addSlideChanges(sessionId, changes) {
    return apiClient.post(`/sessions/${sessionId}/slide-changes`, { changes });
  },

  addWebTranscripts(sessionId, segments) {
    return apiClient.post(`/sessions/${sessionId}/transcripts`, { segments });
  },

  transcribeVoskChunk(sessionId, { audio, chunkId, offsetMs }, onUploadProgress) {
    const formData = new FormData();
    const extensionByMime = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
    };
    const extension = extensionByMime[audio?.type] || 'bin';
    formData.append('audio', audio, `${chunkId}.${extension}`);
    formData.append('chunk_id', chunkId);
    formData.append('offset_ms', String(offsetMs));

    return apiClient.post(`/sessions/${sessionId}/asr/vosk`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 150000,
      onUploadProgress,
    });
  },

  complete(sessionId) {
    return apiClient.patch(`/sessions/${sessionId}/complete`);
  },

  reanalyze(sessionId) {
    return apiClient.post(`/sessions/${sessionId}/reanalyze`);
  },
};
