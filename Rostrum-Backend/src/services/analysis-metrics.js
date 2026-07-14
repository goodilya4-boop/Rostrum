const ANALYSIS_VERSION = '2.0.0';

function getAnalysisVersion(morphologyReady) {
  return `${ANALYSIS_VERSION}+${morphologyReady ? 'az' : 'stem'}`;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function countWords(text) {
  return String(text || '').toLowerCase().match(/[а-яёa-z0-9]+/g)?.length || 0;
}

function mapTranscriptsToSlides(transcripts, slideChanges, totalSlides) {
  const safeSlideCount = Math.max(0, Number(totalSlides) || 0);
  const slideTexts = new Map();
  for (let index = 1; index <= safeSlideCount; index++) slideTexts.set(index, '');
  if (safeSlideCount === 0) return slideTexts;

  const changes = (Array.isArray(slideChanges) ? slideChanges : [])
    .filter(change =>
      Number.isInteger(change.slide_index) &&
      change.slide_index >= 1 &&
      change.slide_index <= safeSlideCount &&
      Number.isFinite(Number(change.timestamp_offset_ms)) &&
      Number(change.timestamp_offset_ms) >= 0
    )
    .map(change => ({
      slideIndex: change.slide_index,
      timestampMs: Number(change.timestamp_offset_ms),
    }))
    .sort((a, b) => a.timestampMs - b.timestampMs);

  for (const segment of Array.isArray(transcripts) ? transcripts : []) {
    const spokenText = typeof segment.spoken_text === 'string' ? segment.spoken_text.trim() : '';
    if (!spokenText) continue;

    const startMs = Number(segment.start_ms);
    const endMs = Number(segment.end_ms);
    const midpointMs = Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(0, (startMs + endMs) / 2)
      : 0;

    let slideIndex = 1;
    for (const change of changes) {
      if (change.timestampMs > midpointMs) break;
      slideIndex = change.slideIndex;
    }

    const current = slideTexts.get(slideIndex);
    slideTexts.set(slideIndex, `${current}${current ? ' ' : ''}${spokenText}`);
  }

  return slideTexts;
}

function calculateCoverage(slideFeedbacks) {
  const scorable = (slideFeedbacks || []).filter(feedback =>
    feedback.isScorable !== false && Number.isFinite(feedback.coverageScore)
  );
  if (scorable.length === 0) {
    return { hasScorableSlides: false, perSlideAverage: 0, globalCoverage: 0, overallCoverage: 0 };
  }

  const perSlideAverage = scorable.reduce((sum, item) => sum + item.coverageScore, 0) /
    scorable.length;
  const matchedCount = scorable.reduce((sum, item) => sum + item.matchedPhrases.length, 0);
  const phraseCount = scorable.reduce(
    (sum, item) => sum + item.matchedPhrases.length + item.missedPhrases.length,
    0
  );
  const globalCoverage = phraseCount > 0 ? matchedCount / phraseCount : 0;
  const overallCoverage = 0.4 * perSlideAverage + 0.6 * globalCoverage;

  return {
    hasScorableSlides: true,
    perSlideAverage: clamp01(perSlideAverage),
    globalCoverage: clamp01(globalCoverage),
    overallCoverage: clamp01(overallCoverage),
  };
}

function calculateSpeechMetrics(text, durationSec, timeLimitSec, fillerWordCount) {
  const totalWords = countWords(text);
  const safeDuration = Number.isFinite(Number(durationSec)) && Number(durationSec) > 0
    ? Number(durationSec)
    : 0;
  const safeTimeLimit = Number.isFinite(Number(timeLimitSec)) && Number(timeLimitSec) > 0
    ? Number(timeLimitSec)
    : 0;

  return {
    totalWords,
    durationSec: safeDuration,
    timingAdherence: safeDuration > 0 && safeTimeLimit > 0
      ? clamp01(safeTimeLimit / safeDuration)
      : 1,
    speechRateWpm: safeDuration > 0 ? Math.round(totalWords / (safeDuration / 60)) : 0,
    fillerRatePer100: totalWords > 0 ? round((fillerWordCount / totalWords) * 100) : 0,
  };
}

function calculateRadarData({ coverage, timingAdherence, fillerWordCount, totalWords, significantWords }) {
  const totalSignificant = significantWords.length;
  const uniqueSignificant = new Set(significantWords).size;

  return {
    coverage: round(clamp01(coverage.overallCoverage)),
    timing: round(clamp01(timingAdherence)),
    fluency: totalWords > 0
      ? round(clamp01(1 - (fillerWordCount / totalWords) * 3.33))
      : 0,
    vocabulary: totalSignificant > 0
      ? round(clamp01(uniqueSignificant / totalSignificant))
      : 0,
    structure: round(clamp01(coverage.perSlideAverage)),
  };
}

module.exports = {
  ANALYSIS_VERSION,
  calculateCoverage,
  calculateRadarData,
  calculateSpeechMetrics,
  clamp01,
  countWords,
  getAnalysisVersion,
  mapTranscriptsToSlides,
  round,
};
