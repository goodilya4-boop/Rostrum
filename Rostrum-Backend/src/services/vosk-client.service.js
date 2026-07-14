const env = require('../config/env');
const AppError = require('../utils/AppError');
const { normalizeVoskResponse } = require('./asr-contract');

const AVAILABILITY_CACHE_MS = 5000;
const AVAILABILITY_TIMEOUT_MS = 3000;
let availabilityCache = { checkedAt: 0, available: false };

function isConfigured() {
  return Boolean(env.asr.voskServiceUrl);
}

function getEndpoint() {
  const base = env.asr.voskServiceUrl.endsWith('/')
    ? env.asr.voskServiceUrl
    : `${env.asr.voskServiceUrl}/`;
  return new URL('v1/transcribe', base).toString();
}

function getHealthEndpoint() {
  const base = env.asr.voskServiceUrl.endsWith('/')
    ? env.asr.voskServiceUrl
    : `${env.asr.voskServiceUrl}/`;
  return new URL('health', base).toString();
}

function rememberAvailability(available) {
  availabilityCache = { checkedAt: Date.now(), available };
  return available;
}

async function isAvailable({ force = false } = {}) {
  if (!isConfigured()) return rememberAvailability(false);
  if (!force && Date.now() - availabilityCache.checkedAt < AVAILABILITY_CACHE_MS) {
    return availabilityCache.available;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT_MS);
  try {
    const response = await fetch(getHealthEndpoint(), { signal: controller.signal });
    return rememberAvailability(response.ok);
  } catch {
    return rememberAvailability(false);
  } finally {
    clearTimeout(timeout);
  }
}

function resetAvailabilityCache() {
  availabilityCache = { checkedAt: 0, available: false };
}

async function transcribe(file) {
  if (!isConfigured()) {
    throw new AppError('Сервис Vosk не настроен', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.asr.timeoutMs);

  try {
    const form = new FormData();
    form.append('audio', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'chunk.webm');
    form.append('language', env.asr.language);

    const headers = {};
    if (env.asr.voskServiceToken) {
      headers.Authorization = `Bearer ${env.asr.voskServiceToken}`;
    }

    const response = await fetch(getEndpoint(), {
      method: 'POST',
      headers,
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = (await response.text()).slice(0, 500);
      throw new AppError(`Vosk отклонил аудиочанк (${response.status}): ${message}`, 502);
    }

    const payload = await response.json();
    rememberAvailability(true);
    return {
      segments: normalizeVoskResponse(payload),
      durationMs: Number(payload.duration_ms) || null,
      language: payload.language || env.asr.language,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.name === 'AbortError') throw new AppError('Истекло время ожидания Vosk', 504);
    rememberAvailability(false);
    const wrapped = new AppError('Сервис Vosk недоступен', 503);
    wrapped.cause = error;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  getEndpoint,
  getHealthEndpoint,
  isAvailable,
  isConfigured,
  resetAvailabilityCache,
  transcribe,
};
