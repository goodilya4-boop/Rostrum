const REHEARSAL_REQUESTS = [
  { method: 'GET', pattern: /^\/api\/presentations\/\d+\/slides\/\d+\/image\/?$/ },
  { method: 'POST', pattern: /^\/api\/sessions\/\d+\/(?:slide-changes|transcripts|asr\/vosk)\/?$/ },
];

function requestPath(req) {
  return String(req.originalUrl || req.url || '').split('?')[0];
}

function isRehearsalRequest(req) {
  const method = String(req.method || '').toUpperCase();
  const pathname = requestPath(req);
  return REHEARSAL_REQUESTS.some(route => route.method === method && route.pattern.test(pathname));
}

module.exports = { isRehearsalRequest, requestPath };
