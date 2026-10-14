import { splitName } from './names-format.mjs';

export function normalize(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

const collator = new Intl.Collator('vi');

export function compareNames(a, b) {
  const left = a.givenName === undefined ? splitName(a.name) : a;
  const right = b.givenName === undefined ? splitName(b.name) : b;
  return collator.compare(left.givenName, right.givenName)
    || collator.compare(left.middleName, right.middleName)
    || collator.compare(a.name, b.name);
}

export function prepareNames(rows) {
  return rows.map(row => {
    const nameText = normalize(row.name);
    const meaningText = normalize(row.meaning);
    return { ...row, ...splitName(row.name), nameText, meaningText, searchText: `${nameText} ${meaningText}`, words: row.name.split(/\s+/).length };
  }).sort(compareNames);
}

export function searchNames(rows, { query = '', given = '', scope = 'name', gender = 'all', length = 'all', savedOnly = false, saved = new Set() } = {}) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  const ending = normalize(given);
  return rows.filter(row => {
    // A chosen given name must be the complete suffix, with a middle name before it.
    if (ending && !row.nameText.endsWith(` ${ending}`)) return false;
    if (gender !== 'all' && row.gender !== gender && row.gender !== 'unisex') return false;
    if (length !== 'all' && row.words !== Number(length)) return false;
    if (savedOnly && !saved.has(row.name)) return false;
    const words = row.nameText.split(' ');
    return tokens.every((token, index) => {
      // Allow the word being typed after a complete name word, without
      // turning single-word queries into substring searches.
      const finalPrefix = tokens.length > 1 && index === tokens.length - 1;
      return words.some(word => word === token || (finalPrefix && word.startsWith(token)))
        || (scope === 'all' && row.meaningText.includes(token));
    });
  }).sort(compareNames);
}

export function shuffle(rows, random = Math.random) {
  const shuffled = [...rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Map accent-insensitive matches back to the original text, preserving every character.
export function highlightParts(text, query, { wholeWords = false, prefixLastWord = false } = {}) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return [{ text, matched: false }];
  let folded = '';
  let offset = 0;
  const starts = [];
  const ends = [];
  for (const character of text) {
    const start = offset;
    offset += character.length;
    const value = character.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ');
    if (!value) {
      if (ends.length) ends[ends.length - 1] = offset;
      continue;
    }
    folded += value;
    for (let i = 0; i < value.length; i++) {
      starts.push(start);
      ends.push(offset);
    }
  }
  const ranges = [];
  for (const [tokenIndex, token] of tokens.entries()) {
    let from = 0;
    for (let index = folded.indexOf(token, from); index !== -1; index = folded.indexOf(token, from)) {
      const startsWord = index === 0 || folded[index - 1] === ' ';
      const endsWord = index + token.length === folded.length || folded[index + token.length] === ' ';
      const finalPrefix = prefixLastWord && tokens.length > 1 && tokenIndex === tokens.length - 1;
      if (!wholeWords || (startsWord && (endsWord || finalPrefix))) ranges.push({ start: starts[index], end: ends[index + token.length - 1] });
      from = index + 1;
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  const parts = [];
  let position = 0;
  for (const range of merged) {
    if (position < range.start) parts.push({ text: text.slice(position, range.start), matched: false });
    parts.push({ text: text.slice(range.start, range.end), matched: true });
    position = range.end;
  }
  if (position < text.length) parts.push({ text: text.slice(position), matched: false });
  return parts.length ? parts : [{ text, matched: false }];
}
