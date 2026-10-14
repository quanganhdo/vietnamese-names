const comparisonKey = text => text.normalize('NFC').toLocaleLowerCase('vi')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = text => comparisonKey(text).split(' ').filter(Boolean);
const negations = new Set(['không', 'chẳng', 'chưa', 'đừng', 'chả', 'chớ', 'tránh', 'thiếu']);
const contains = (longer, shorter) => (' ' + longer + ' ').includes(' ' + shorter + ' ');
const hasNegation = key => key.split(' ').some(word => negations.has(word));

function splitSentences(text) {
  return text.match(/.+?(?:[.!?…]+(?=\s|$)|$)/gu)?.map(sentence => sentence.trim()).filter(Boolean) || [];
}

// Only short, independent lists of traits may lose individual comma-separated
// clauses. Narrative sentences stay intact, even when they share vocabulary.
function traitClauses(text) {
  const clauses = text.replace(/[.!?…]+$/, '').split(/[,;]/u).map(clause => clause.trim());
  if (clauses.length < 2 || words(text).length > 24) return null;
  if (/(?:^|\s)(?:nghĩa|là|biểu thị|biểu tượng|tượng trưng|như|thể hiện|mang|gợi|tên|con|người|đồng thời|được|khi|đem|thường|luôn|giúp|nhằm|để)(?=\s|$)/iu.test(text)) return null;
  const narrativeStart = /^(?:con|tên|mong|là|người|bố|mẹ|ba|cha|sự|thể hiện|gợi|mang|ý nghĩa|viên|trong|theo|có|không|chẳng|chưa|đừng|chả|chớ|tránh|thiếu)(?=\s|$)/iu;
  if (clauses.some(clause => {
    const count = words(clause).length;
    return count < 2 || count > 8 || /[:()"“”]/u.test(clause) || narrativeStart.test(clause) || hasNegation(comparisonKey(clause));
  })) return null;
  return clauses;
}

function removeRepeats(values) {
  const paragraphs = values.flatMap(value => value.normalize('NFC').split(/\n\s*\n/u))
    .map(value => value.trim().replace(/\s+/gu, ' ')).filter(Boolean);
  const sentences = paragraphs.map(splitSentences);
  const all = sentences.flat();
  const seen = new Set();
  const retained = new Set();
  for (const sentence of all) {
    const key = comparisonKey(sentence);
    if (seen.has(key)) continue;
    seen.add(key);
    // An entire shorter passage can be omitted when its words already appear
    // together in another passage. Do not equate a positive trait with its negation.
    const contained = words(sentence).length >= 2 && all.some(other => {
      const otherKey = comparisonKey(other);
      return otherKey.length > key.length && !hasNegation(otherKey) && contains(otherKey, key);
    });
    if (!contained) retained.add(sentence);
  }

  const anchors = [...retained].filter(sentence => !traitClauses(sentence)).map(comparisonKey);
  const keptClauses = [];
  const result = [];
  for (const paragraph of sentences) {
    const output = [];
    for (const sentence of paragraph) {
      if (!retained.has(sentence)) continue;
      // A source may repeat the same literal sentence within one description.
      retained.delete(sentence);
      const clauses = traitClauses(sentence);
      if (!clauses) {
        output.push(sentence);
        continue;
      }
      const distinct = clauses.filter(clause => {
        const key = comparisonKey(clause);
        if (anchors.some(anchor => !hasNegation(anchor) && contains(anchor, key)) ||
            keptClauses.some(earlier => contains(earlier, key))) return false;
        keptClauses.push(key);
        return true;
      });
      if (distinct.length) {
        const punctuation = sentence.match(/[.!?…]+$/u)?.[0] || '';
        const text = distinct.join(', ') + punctuation;
        output.push(distinct[0] === clauses[0] ? text : text[0].toLocaleUpperCase('vi') + text.slice(1));
      }
    }
    if (output.length) result.push(output.join(' '));
  }
  return result;
}

// Removing a clause may expose a shorter repeated passage. Continue until no
// further removal is possible; each changing pass removes words or normalizes
// whitespace/case, without generating a new description.
export function deduplicateMeanings(values) {
  let result = values;
  while (true) {
    const next = removeRepeats(result);
    if (JSON.stringify(next) === JSON.stringify(result)) return next;
    result = next;
  }
}
