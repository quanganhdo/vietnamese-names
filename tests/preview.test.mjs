import { formatMachineName } from '../public/names-format.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { classListRows, createClassListSvg, createNameCardSvg } from '../public/preview.mjs';
import { compareNames } from '../public/search.mjs';

test('class-list sample has one selected row and sorts given name before middle name', () => {
  const rows = classListRows('nguyễn', 'Minh An');
  assert.equal(rows.filter(row => row.selected).length, 1);
  assert.equal(rows.find(row => row.selected).fullName, 'Nguyễn Minh An');
  assert.ok(rows.every((row, index) => !index || compareNames(rows[index - 1], row) <= 0));
  assert.equal(new Set(rows.map(row => row.fullName)).size, rows.length);
  assert.equal(classListRows('Trần', 'Bảo An').filter(row => row.selected).length, 1);
});
test('generated graphic highlights the selected name and safely escapes supplied text', () => {
  const svg = createClassListSvg('nguyễn', 'Minh An');
  assert.equal((svg.match(/data-selected="true"/g) || []).length, 1);
  assert.ok(svg.includes('Nguyễn Minh An'));
  const escaped = createClassListSvg('<script>&', 'Minh An');
  assert.ok(!escaped.includes('<script>'));
  assert.ok(escaped.includes('&lt;script&gt;&amp;'));
});

test('generic travel-name graphic preserves the given-name block and escapes supplied names', () => {
  const svg = createNameCardSvg('nguyễn', 'Minh An');
  assert.ok(svg.includes('SURNAME'));
  assert.ok(svg.includes('GIVEN NAMES'));
  assert.ok(svg.includes('NGUYEN'));
  assert.ok(svg.includes('MINH AN'));
  assert.ok(!svg.includes('AN MINH'));
  const escaped = createNameCardSvg('<script>&', 'Minh An');
  assert.ok(!escaped.includes('<script>'));
  assert.ok(escaped.includes('&lt;SCRIPT&gt;&amp;'));
});

test('machine-name portion encodes accents and word separators without reversing given names', () => {
  assert.equal(formatMachineName('nguyễn', 'Minh An'), 'NGUYEN<<MINH<AN'.padEnd(39, '<'));
  assert.ok(formatMachineName('đặng', 'Đức Anh').startsWith('DANG<<DUC<ANH'));
  assert.ok(formatMachineName('tôn nữ', 'Minh An').startsWith('TON<NU<<MINH<AN'));
  assert.ok(/^[A-Z<]+$/.test(formatMachineName('nguyễn', 'Hải Hà')));
  assert.ok(!createNameCardSvg('Nguyễn', 'Minh An').includes('NAME PREVIEW'));
});
test('class-list graphic uses supplied fresh classmates and omits the extra subtitle', () => {
  const classmates = [['Trần', 'Tuệ An'], ['Phạm', 'Ngọc Hà']];
  const rows = classListRows('Nguyễn', 'Minh An', classmates);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.fullName), ['Nguyễn Minh An', 'Trần Tuệ An', 'Phạm Ngọc Hà']);
  const svg = createClassListSvg('Nguyễn', 'Minh An', classmates);
  assert.ok(!svg.includes('Danh sách mẫu'));
  assert.ok(svg.includes('Nguyễn Minh An'));
  assert.ok(svg.includes('Phạm Ngọc Hà'));
});
