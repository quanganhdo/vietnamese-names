import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeNameData } from '../scripts/data.mjs';

test('current meanings replace old wording, repeated current meanings merge, untouched legacy names survive', () => {
  const legacy = [
    { first_name: 'Ngọc Hải', meaning: 'Old wording', sex: 3 },
    { first_name: 'Vũ Anh', meaning: 'Old wording to remove', sex: 3 },
    { first_name: 'Tên Cũ', meaning: 'Unverified old entry', sex: 5 },
  ];
  const snapshot = { version: 1, retrievedAt: '2026-10-13', sources: [
    { url: 'https://www.huggies.com.vn/one', records: [
      { name: 'Vũ Anh', meaning: 'Current source wording', gender: 'male' },
      { name: 'Tên Mới', meaning: 'A new entry', gender: 'female' },
    ] },
    { url: 'https://www.huggies.com.vn/two', records: [
      { name: 'Vũ Anh', meaning: 'Current source wording', gender: 'male' },
      { name: 'Vũ Anh', meaning: 'Another current meaning', gender: 'female' },
    ] },
  ] };
  const { rows, metadata } = mergeNameData(legacy, snapshot);
  assert.deepEqual(rows.find(row => row.name === 'Vũ Anh'), {
    name: 'Vũ Anh', meaning: 'Current source wording\n\nAnother current meaning', gender: 'unisex',
  });
  assert.equal(rows.find(row => row.name === 'Tên Cũ').meaning, 'Unverified old entry');
  assert.equal(rows.find(row => row.name === 'Tên Mới').meaning, 'A new entry');
  assert.equal(metadata.total, 4);
  assert.equal(metadata.refreshed, 2);
  assert.equal(metadata.changed, 1);
  assert.equal(metadata.added, 1);
  assert.equal(metadata.retainedLegacy, 2);
});

test('a current entry without a gender label keeps the legacy label', () => {
  const { rows } = mergeNameData([{ first_name: 'An', meaning: 'Old', sex: 7 }], {
    version: 1, retrievedAt: '2026-10-13',
    sources: [{ url: 'https://www.huggies.com.vn/names', records: [{ name: 'An', meaning: 'Current', gender: null }] }],
  });
  assert.equal(rows[0].gender, 'unisex');
  assert.equal(rows[0].meaning, 'Current');
});

test('production data keeps one entry per name and all distinct source wording after removing repeats', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/huggies-current.json', import.meta.url), 'utf8'));
  const rows = JSON.parse(await readFile(new URL('../public/names.json', import.meta.url), 'utf8'));
  const current = new Map();
  for (const source of snapshot.sources) for (const record of source.records) {
    if (!current.has(record.name)) current.set(record.name, new Set());
    current.get(record.name).add(record.meaning.normalize('NFC').trim().replace(/\s+/g, ' '));
  }
  for (const [name, meanings] of current) {
    const row = rows.find(row => row.name === name);
    assert.ok(row, name);
const vocabulary = text => new Set(text.normalize('NFC').toLocaleLowerCase('vi').match(/[\p{L}\p{N}]+/gu));
    // Every distinct source word survives; no rewritten or legacy-only wording
    // may be introduced when repeated passages are removed.
    assert.deepEqual(vocabulary(row.meaning), vocabulary([...meanings].join(' ')), name);
    const key = text => text.normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const paragraphs = row.meaning.split('\n\n').map(key);
    assert.equal(new Set(paragraphs).size, paragraphs.length, name);
    assert.ok(row.meaning.trim(), name);
  }
  assert.equal(new Set(rows.map(row => row.name)).size, rows.length);
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const svg = await readFile(new URL('../assets/share.svg', import.meta.url), 'utf8');
  assert.ok(!html.includes('id="total-names"'));
  const imageLabel = svg.match(/>([0-9,]+)\+ tên tiếng Việt kèm ý nghĩa<\/text>/);
  assert.ok(imageLabel);
  const lowerBound = Number(imageLabel[1].replaceAll(',', ''));
  assert.ok(lowerBound <= rows.length);
  assert.equal(imageLabel[1], '10,000');
  assert.equal(html.split(imageLabel[1] + '+ tên tiếng Việt kèm ý nghĩa').length - 1, 2);
});

test('a full-name example cannot become a three-word selectable name by dropping one surname', () => {
  const snapshot = { version: 1, retrievedAt: '2026-10-13', sources: [{
    url: 'https://www.huggies.com.vn/names',
    records: [{ name: 'Nguyễn Thanh Tùng', sourceName: 'Phạm Nguyễn Thanh Tùng', meaning: 'Source description', gender: 'male' }],
  }] };
  assert.throws(() => mergeNameData([], snapshot), /surname boundary/);
  snapshot.sources[0].records = [{ name: 'Ngọc Bích Hà', sourceName: 'Ngọc Bích Hà', meaning: 'Source description', gender: 'female' }];
  assert.equal(mergeNameData([], snapshot).rows[0].name, 'Ngọc Bích Hà');
});

test('Huggies product advertisements cannot enter the names dataset', () => {
  const snapshot = { version: 1, retrievedAt: '2026-10-13', sources: [{
    url: 'https://www.huggies.com.vn/names',
    records: [{ name: 'Huggies Skin Perfect', sourceName: 'Huggies Skin Perfect', meaning: 'Advertisement', gender: 'male' }],
  }] };
  assert.throws(() => mergeNameData([], snapshot), /advertisement/);
});

test('every production three-word entry is explicitly listed without a surname in its source', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/huggies-current.json', import.meta.url), 'utf8'));
  const rows = JSON.parse(await readFile(new URL('../public/names.json', import.meta.url), 'utf8'));
  const explicit = new Set(snapshot.sources.flatMap(source => source.records.filter(row =>
    row.name.split(/\s+/).length === 3 && row.sourceName.split(/\s+/).length === 3
  ).map(row => row.name)));
  assert.ok(explicit.size > 0);
  assert.deepEqual(new Set(rows.filter(row => row.name.split(/\s+/).length === 3).map(row => row.name)), explicit);
  assert.ok(!rows.some(row => row.name.startsWith('Huggies ')));
  assert.ok(!rows.some(row => row.name === 'Nguyễn Thanh Tùng' || row.name === 'Lê Ngọc Trà'));
});

test('previously sourced names survive an unavailable current source without being counted as refreshed', () => {
  const snapshot = { version: 1, retrievedAt: '2026-10-14', retainedRecords: [{ name: 'Duy Bình', meaning: 'Last known source wording', gender: 'male', source: { url: 'https://www.huggies.com.vn/names' } }], sources: [{ url: 'https://www.huggies.com.vn/current', records: [{ name: 'An', meaning: 'Current source wording', gender: null }] }] };
  const { rows, metadata } = mergeNameData([{ first_name: 'An', meaning: 'Old', sex: 7 }], snapshot);
  assert.equal(rows.find(row => row.name === 'Duy Bình').meaning, 'Last known source wording');
  assert.equal(metadata.refreshed, 1);
  assert.equal(metadata.retainedPrior, 1);
  assert.equal(metadata.retainedLegacy, 0);
});

test('merge collects distinct descriptions in one entry and strips repeated traits', () => {
  const snapshot = { version: 1, retrievedAt: '2026-10-14', sources: [
    { url: 'https://www.huggies.com.vn/one', records: [
      { name: 'Ngọc Huệ', meaning: 'Ý nghĩa về sự quý phái và hạnh phúc an lành.', gender: 'female' },
    ] },
    { url: 'https://www.huggies.com.vn/two', records: [
      { name: 'Ngọc Huệ', meaning: 'Sang trọng, quý phái', gender: 'female' },
      { name: 'Ngọc Huệ', meaning: 'Sang trọng, quý phái.', gender: 'female' },
    ] },
  ] };
  const { rows } = mergeNameData([], snapshot);
  assert.deepEqual(rows, [{
    name: 'Ngọc Huệ', gender: 'female',
    meaning: 'Ý nghĩa về sự quý phái và hạnh phúc an lành.\n\nSang trọng',
  }]);
  assert.equal(snapshot.sources[1].records[0].meaning, 'Sang trọng, quý phái');
});

test('legacy-only names also have one entry with repeated meaning text removed', () => {
  const { rows } = mergeNameData([
    { first_name: 'Tên Cũ', meaning: 'Thông minh, sáng suốt.', sex: 3 },
    { first_name: 'Tên Cũ', meaning: 'Thông minh, nhân hậu.', sex: 5 },
  ], { version: 1, retrievedAt: '2026-10-14', sources: [
    { url: 'https://www.huggies.com.vn/current', records: [
      { name: 'An', meaning: 'Bình an.', gender: null },
    ] },
  ] });
  assert.deepEqual(rows.find(row => row.name === 'Tên Cũ'), {
    name: 'Tên Cũ', gender: 'unisex', meaning: 'Thông minh, sáng suốt.\n\nNhân hậu.',
  });
});
