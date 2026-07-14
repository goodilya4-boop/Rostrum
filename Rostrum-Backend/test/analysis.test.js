const test = require('node:test');
const assert = require('node:assert/strict');
const { countFillerWords, findFillerWords } = require('../src/services/fillerWords');
const { compareTextWithPhrases, tokenize } = require('../src/utils/textComparison');
const {
  ANALYSIS_VERSION,
  calculateCoverage,
  calculateRadarData,
  calculateSpeechMetrics,
  getAnalysisVersion,
  mapTranscriptsToSlides,
} = require('../src/services/analysis-metrics');

test('слова-паразиты считаются без вложенных и частичных совпадений', () => {
  const text = 'Вот так вот, в общем-то, тактика и вот.';
  assert.equal(countFillerWords(text), 3);
  assert.deepEqual(
    findFillerWords(text).map(match => match.phrase),
    ['вот так вот', 'в общем-то', 'вот']
  );
});

test('токенизация разделяет дефисы и нормализует ё', () => {
  assert.deepEqual(tokenize('Научно-технический расчёт'), ['научно', 'технический', 'расчет']);
});

test('слайд без тезисов исключается из оценки покрытия', () => {
  const result = compareTextWithPhrases('Произнесённый текст', []);
  assert.equal(result.isScorable, false);
  assert.equal(result.coverageScore, null);
});

test('морфологические формы и дефисы сопоставляются стабильно', () => {
  const result = compareTextWithPhrases(
    'В работе используется машинное обучение',
    ['Методы машинного-обучения']
  );
  assert.equal(result.isScorable, true);
  assert.equal(result.coverageScore, 1);
});

test('пустая речь не покрывает заданные тезисы', () => {
  const result = compareTextWithPhrases('', ['Цель исследования', 'Методы исследования']);
  assert.equal(result.coverageScore, 0);
  assert.deepEqual(result.missedPhrases, ['Цель исследования', 'Методы исследования']);
});

test('неоцениваемые слайды не завышают общее покрытие', () => {
  const coverage = calculateCoverage([
    { isScorable: false, coverageScore: null, matchedPhrases: [], missedPhrases: [] },
    { isScorable: true, coverageScore: 1, matchedPhrases: ['a'], missedPhrases: [] },
    { isScorable: true, coverageScore: 0, matchedPhrases: [], missedPhrases: ['b'] },
  ]);
  assert.equal(coverage.hasScorableSlides, true);
  assert.equal(coverage.perSlideAverage, 0.5);
  assert.equal(coverage.globalCoverage, 0.5);
  assert.equal(coverage.overallCoverage, 0.5);
});

test('транскрипты привязываются к отсортированным валидным переключениям', () => {
  const mapped = mapTranscriptsToSlides([
    { start_ms: 0, end_ms: 1000, spoken_text: 'первый' },
    { start_ms: 2500, end_ms: 3000, spoken_text: 'второй' },
    { start_ms: 4500, end_ms: 5000, spoken_text: 'третий' },
  ], [
    { slide_index: 3, timestamp_offset_ms: 4000 },
    { slide_index: 99, timestamp_offset_ms: 1000 },
    { slide_index: 2, timestamp_offset_ms: 2000 },
  ], 3);

  assert.equal(mapped.get(1), 'первый');
  assert.equal(mapped.get(2), 'второй');
  assert.equal(mapped.get(3), 'третий');
});

test('нулевая длительность не создаёт бесконечный темп речи', () => {
  const metrics = calculateSpeechMetrics('один два три', 0, 420, 0);
  assert.equal(metrics.speechRateWpm, 0);
  assert.equal(metrics.timingAdherence, 1);
  assert.equal(Number.isFinite(metrics.speechRateWpm), true);
});

test('пустая речь даёт нулевые fluency и vocabulary', () => {
  const radar = calculateRadarData({
    coverage: { overallCoverage: 0, perSlideAverage: 0 },
    timingAdherence: 1,
    fillerWordCount: 0,
    totalWords: 0,
    significantWords: [],
  });
  assert.equal(radar.fluency, 0);
  assert.equal(radar.vocabulary, 0);
});

test('версия алгоритма имеет фиксированный формат', () => {
  assert.match(ANALYSIS_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(getAnalysisVersion(true), `${ANALYSIS_VERSION}+az`);
  assert.equal(getAnalysisVersion(false), `${ANALYSIS_VERSION}+stem`);
});
