import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalize, prepareNames, searchNames, shuffle, highlightParts } from '../public/search.mjs';

const fixture = prepareNames([
  { name: 'Gia An', gender: 'unisex', meaning: 'Mong con bình yên, an lành.' },
  { name: 'Đức Anh', gender: 'male', meaning: 'Thông minh, có đức.' },
  { name: 'Hà', gender: 'female', meaning: 'Dòng sông hiền hòa.' },
  { name: 'Bình', gender: 'male', meaning: 'Cuộc sống an lành.' },
]);

test('Vietnamese accents, đ, casing, punctuation and decomposed Unicode normalize', () => {
  assert.equal(normalize('  ĐỨC, bình-yên!  '), 'duc binh yen');
  assert.equal(normalize('Hà'.normalize('NFD')), 'ha');
});
test('names-only is the default; meaning search is opt-in', () => {
  assert.deepEqual(searchNames(fixture, { query: 'binh yen' }), []);
  assert.deepEqual(searchNames(fixture, { query: 'binh yen', scope: 'all' }).map(row => row.name), ['Gia An']);
  assert.deepEqual(searchNames(fixture, { query: 'an' }).map(row => row.name), ['Gia An']);
});
test('all query terms must occur in the chosen search scope', () => {
  assert.deepEqual(searchNames(fixture, { query: 'gia binh yen', scope: 'all' }).map(row => row.name), ['Gia An']);
  assert.deepEqual(searchNames(fixture, { query: 'duc thong minh', scope: 'all' }).map(row => row.name), ['Đức Anh']);
  assert.equal(searchNames(fixture, { query: 'gia khongtontai', scope: 'all' }).length, 0);
});
test('Vietnamese order uses given name before middle name, including search and favorites', () => {
  assert.deepEqual(searchNames(fixture).map(row => row.name), ['Gia An', 'Đức Anh', 'Bình', 'Hà']);
  assert.deepEqual(searchNames(fixture, { query: 'an', scope: 'all' }).map(row => row.name), ['Gia An', 'Bình']);
  assert.deepEqual(searchNames(fixture, { savedOnly: true, saved: new Set(['Hà', 'Gia An', 'Bình']) }).map(row => row.name), ['Gia An', 'Bình', 'Hà']);
  const rows = prepareNames([
    { name: 'Minh Anh', meaning: '', gender: 'unisex' },
    { name: 'Đức An', meaning: '', gender: 'unisex' },
    { name: 'Hoài An', meaning: '', gender: 'unisex' },
    { name: 'An', meaning: '', gender: 'unisex' },
    { name: 'Bình', meaning: '', gender: 'unisex' },
  ]);
  assert.deepEqual(rows.map(row => row.name), ['An', 'Đức An', 'Hoài An', 'Minh Anh', 'Bình']);
});
test('unisex names are included in either gender filter', () => {
  assert.deepEqual(searchNames(fixture, { gender: 'female' }).map(row => row.name), ['Gia An', 'Hà']);
  assert.equal(searchNames(fixture, { gender: 'male' }).length, 3);
});
test('length and favorites combine with full text search', () => {
  assert.deepEqual(searchNames(fixture, { length: '1', query: 'an', scope: 'all' }).map(row => row.name), ['Bình']);
  assert.deepEqual(searchNames(fixture, { savedOnly: true, saved: new Set(['Hà', 'Gia An']), query: 'song', scope: 'all' }).map(row => row.name), ['Hà']);
});
test('highlight accent-insensitive matches without changing original Vietnamese text', () => {
  assert.deepEqual(highlightParts('Bình yên', 'binh yen'), [
    { text: 'Bình', matched: true }, { text: ' ', matched: false }, { text: 'yên', matched: true },
  ]);
  assert.deepEqual(highlightParts('Đức', 'duc'), [{ text: 'Đức', matched: true }]);
  assert.deepEqual(highlightParts('y\u0301', 'y'), [{ text: 'y\u0301', matched: true }]);
  assert.deepEqual(highlightParts('Anh', 'an anh'), [{ text: 'Anh', matched: true }]);
  const text = '<img src=x> Bình, bình!';
  const parts = highlightParts(text, 'binh');
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.deepEqual(parts.filter(part => part.matched).map(part => part.text), ['Bình', 'bình']);
});
test('production data is unique, valid, count-consistent, searchable and ordered by given name', async () => {
  const rows = JSON.parse(await readFile(new URL('../public/names.json', import.meta.url), 'utf8'));
  const metadata = JSON.parse(await readFile(new URL('../public/data-info.json', import.meta.url), 'utf8'));
  assert.equal(rows.length, metadata.total);
  assert.equal(rows.length, metadata.legacyTotal + metadata.added + metadata.retainedPrior);
  assert.ok(metadata.refreshed > 0);
  assert.ok(searchNames(prepareNames(rows), { length: '3' }).length > 0);
  assert.equal(new Set(rows.map(row => row.name)).size, rows.length);
  assert.equal(rows.filter(row => row.name === 'Ngọc Hải').length, 1);
  assert.ok(rows.every(row => !/^["“”‘’]|["“”‘’]$/.test(row.name)));
  assert.ok(rows.every(row => row.name && row.meaning && ['male', 'female', 'unisex'].includes(row.gender)));
  const prepared = prepareNames(rows);
  assert.ok(searchNames(prepared, { query: 'binh yen', scope: 'all' }).length > 0);
  assert.ok(searchNames(prepared, { query: 'Ngọc Anh' }).some(row => row.name === 'Ngọc Anh'));
});
test('shuffle preserves every record and leaves the source untouched', () => {
  const before = [...fixture];
  const shuffled = shuffle(fixture, () => 0);
  assert.deepEqual(fixture, before);
  assert.equal(shuffled.length, fixture.length);
  assert.deepEqual(new Set(shuffled), new Set(fixture));
  assert.notDeepEqual(shuffled, fixture);
  assert.deepEqual(shuffle([]), []);
  assert.deepEqual(shuffle([fixture[0]]), [fixture[0]]);
});

test('name queries match whole accent-insensitive words, not parts of other names', () => {
  const rows = prepareNames(['An', 'Minh An', 'Anh', 'Thanh', 'Hải Hà'].map(name => ({name, gender:'unisex', meaning:''})));
  assert.deepEqual(searchNames(rows, {query:'an'}).map(row => row.name), ['An', 'Minh An']);
  assert.deepEqual(searchNames(rows, {query:'hai ha'}).map(row => row.name), ['Hải Hà']);
  assert.deepEqual(highlightParts('An Anh Thanh', 'an', {wholeWords:true}), [{text:'An',matched:true},{text:' Anh Thanh',matched:false}]);
});

test('a fixed given name matches a complete suffix and requires a middle name', () => {
  const rows = prepareNames(['An', 'Gia An', 'Minh An', 'Anh', 'An Bình', 'Hải Hà', 'Minh Hải Hà', 'Hà Hải'].map(name => ({ name, gender: 'unisex', meaning: '' })));
  assert.deepEqual(searchNames(rows, { given: 'an' }).map(row => row.name), ['Gia An', 'Minh An']);
  assert.deepEqual(searchNames(rows, { given: 'hai ha' }).map(row => row.name), ['Minh Hải Hà']);
  assert.deepEqual(searchNames(rows, { given: 'hà' }).map(row => row.name), ['Hải Hà', 'Minh Hải Hà']);
  assert.deepEqual(searchNames(rows, { given: 'an', query: 'minh' }).map(row => row.name), ['Minh An']);
  assert.deepEqual(searchNames(rows, { given: 'an', length: '1' }), []);
  assert.deepEqual(searchNames(rows, { given: '  ' }), searchNames(rows));
});
