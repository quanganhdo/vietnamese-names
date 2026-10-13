import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, capitalizeFamily, formatFullName } from '../public/names-format.mjs';

test('remove stray quotes around names, including the source Ngọc Hải typo', () => {
  assert.equal(cleanName('"Ngọc Hải'), 'Ngọc Hải');
  assert.equal(cleanName(' “Ngọc Hải” '), 'Ngọc Hải');
  assert.equal(cleanName('Ngọc  Hải'), 'Ngọc Hải');
  assert.equal(cleanName('Ngọc Hải'.normalize('NFD')), 'Ngọc Hải');
});
test('capitalize Vietnamese surnames and each word without losing typing spaces', () => {
  assert.equal(capitalizeFamily('nguyễn'), 'Nguyễn');
  assert.equal(capitalizeFamily('NGUYỄN VĂN'), 'Nguyễn Văn');
  assert.equal(capitalizeFamily('đặng thị'), 'Đặng Thị');
  assert.equal(capitalizeFamily('nguyễn '), 'Nguyễn ');
  assert.equal(capitalizeFamily('  nguyễn  văn'), '  Nguyễn  Văn');
  assert.equal(capitalizeFamily('nguyễn'.normalize('NFD')), 'Nguyễn');
});

test('Vietnamese format keeps surname, middle name and given name with accents', () => {
  assert.equal(formatFullName('nguyễn', 'Minh An'), 'Nguyễn Minh An');
  assert.equal(formatFullName('', 'Minh An'), 'Minh An');
});
test('English format moves surname to the end and keeps the other name words in original order without accents', () => {
  assert.equal(formatFullName('nguyễn', 'Minh An', 'en'), 'Minh An Nguyen');
  assert.equal(formatFullName('đặng', 'Đức Anh', 'en'), 'Duc Anh Dang');
  assert.equal(formatFullName('tôn nữ', 'Hữu Minh An', 'en'), 'Huu Minh An Ton Nu');
  assert.equal(formatFullName('nguyễn', 'Hà', 'en'), 'Ha Nguyen');
  assert.equal(formatFullName('', 'Minh An', 'en'), 'Minh An');
});
