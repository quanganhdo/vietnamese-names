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

test('production data uses every current source meaning and no legacy-only meanings for refreshed names', async () => {
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
    assert.deepEqual(new Set(row.meaning.split('\n\n')), meanings, name);
  }
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const svg = await readFile(new URL('../assets/share.svg', import.meta.url), 'utf8');
  const formatted = rows.length.toLocaleString('en-US');
  assert.ok(html.includes('<span id="total-names">' + formatted + '</span>'));
  assert.equal((html.match(new RegExp(formatted + ' tên tiếng Việt kèm ý nghĩa', 'g')) || []).length, 2);
  assert.ok(svg.includes(formatted + ' tên tiếng Việt kèm ý nghĩa'));
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
