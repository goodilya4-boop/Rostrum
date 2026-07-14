const FILLER_WORDS = [
  'типа', 'как бы', 'значит', 'вот', 'ну', 'это самое', 'так сказать',
  'вообще', 'короче', 'в общем-то', 'собственно', 'то есть', 'понимаете',
  'скажем так', 'просто', 'буквально', 'как-то', 'там', 'в принципе',
  'допустим', 'на самом деле', 'так', 'ладно', 'в общем', 'кстати',
  'соответственно', 'грубо говоря', 'мягко говоря', 'вот так вот',
  'понимаешь', 'слушай', 'смотри', 'это',
];

function tokenizeForMatching(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .match(/[а-яa-z0-9]+/g) || [];
}

const FILLER_PATTERNS = [...new Set(FILLER_WORDS)]
  .map(phrase => ({ phrase, tokens: tokenizeForMatching(phrase) }))
  .sort((a, b) => b.tokens.length - a.tokens.length || b.phrase.length - a.phrase.length);

function findFillerWords(text) {
  if (!text || typeof text !== 'string') return [];

  const tokens = tokenizeForMatching(text);
  const matches = [];

  for (let index = 0; index < tokens.length;) {
    const match = FILLER_PATTERNS.find(pattern =>
      pattern.tokens.every((token, offset) => tokens[index + offset] === token)
    );

    if (!match) {
      index += 1;
      continue;
    }

    matches.push({ phrase: match.phrase, tokenIndex: index });
    index += match.tokens.length;
  }

  return matches;
}

function countFillerWords(text) {
  return findFillerWords(text).length;
}

module.exports = { FILLER_WORDS, countFillerWords, findFillerWords, tokenizeForMatching };
