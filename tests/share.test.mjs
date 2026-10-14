import test from 'node:test';
import assert from 'node:assert/strict';
import { createShareUrl, readSharedUrl, encodeSavedNames, decodeSavedNames, createShareSvg } from '../public/share.mjs';

test('preview links restore Unicode names, surnames and English display', () => {
  const url = createShareUrl('https://tenhay.fyi/?q=old#old', { kind: 'name', name: 'Hải Hà', family: 'tôn nữ', display: 'en' });
  const shared = readSharedUrl(url);
  assert.equal(shared.name, 'Hải Hà');
  assert.equal(shared.family, 'Tôn Nữ');
  assert.equal(new URL(url).searchParams.get('display'), 'en');
  assert.equal(new URL(url).searchParams.get('q'), 'Hải Hà');
  assert.equal(new URL(url).hash, '');
});
test('saved links restore all unique Unicode names and preserve a blank surname', () => {
  const url = createShareUrl('https://preview.example/names/', { kind: 'saved', names: ['Hải Hà', 'Minh An', 'Ngọc Hải', 'Minh An'], family: '' });
  const shared = readSharedUrl(url);
  assert.deepEqual(shared.names, ['Hải Hà', 'Minh An', 'Ngọc Hải']);
  assert.equal(shared.savedOnly, true);
  assert.equal(shared.family, '');
  assert.equal(new URL(url).pathname, '/names/');
  assert.ok(!new URL(url).search.includes('Hải'));
});
test('page links preserve filters without carrying unrelated selected or saved state', () => {
  const url = new URL(createShareUrl('https://tenhay.fyi/?name=old#saved=old', { query: 'binh yen', given: 'An', gender: 'female', length: '2', scope: 'all', family: 'Trần' }));
  for (const [key,value] of Object.entries({q:'binh yen',given:'An',gender:'female',length:'2',scope:'all'})) assert.equal(url.searchParams.get(key),value);
  assert.equal(url.searchParams.has('name'), false);
  assert.equal(url.hash, '');
});
test('invalid saved payloads are ignored; empty and long lists round trip', () => {
  assert.equal(decodeSavedNames('#saved=garbage'), null);
  assert.equal(decodeSavedNames('#saved=%'), null);
  assert.equal(decodeSavedNames('#saved='+btoa(JSON.stringify({ v: 2, names: [] }))), null);
  assert.equal(decodeSavedNames('#saved='+btoa(JSON.stringify({ v: 1, names: [7] }))), null);
  assert.deepEqual(decodeSavedNames('#saved='+encodeSavedNames([])), []);
  const names=Array.from({length:1000},(_,i)=>'Tên '+i);
  assert.deepEqual(decodeSavedNames('#saved='+encodeSavedNames(names)),names);
});
test('name sharing images retain name order and safely escape supplied XML', () => {
  const svg = createShareSvg({ kind: 'name', name: 'Minh An', family: 'Nguyễn', display: 'en', meaning: '<img src=x> bình yên & an lành' });
  assert.ok(svg.includes('Minh An Nguyen'));
  assert.ok(!svg.includes('An Minh'));
  assert.ok(svg.includes('&lt;img'));
  assert.ok(!svg.includes('<img'));
  assert.ok(svg.includes('&amp;'));
  assert.ok(!svg.includes('Tên tiếng Việt và ý nghĩa'));
});
test('saved images and restoring links both contain the complete list', () => {
  const names=Array.from({length:12},(_,i)=>'Tên '+i);
  const svg=createShareSvg({kind:'saved',names,family:'Nguyễn'});
  assert.ok(names.every(name=>svg.includes('Nguyễn '+name+'<')));
  assert.ok(!svg.includes('tên trong liên kết'));
  assert.equal(readSharedUrl(createShareUrl('https://tenhay.fyi/',{kind:'saved',names})).names.length,12);
});
test('name shares contain the selected name and full meaning without extra preview sections', () => {
  const meaning = 'Bình yên, an lành. '.repeat(80) + 'HẾT Ý NGHĨA';
  const svg = createShareSvg({kind:'name',name:'Minh An',family:'Nguyễn',meaning});
  assert.ok(svg.includes('Nguyễn Minh An'));
  assert.ok(svg.includes('HẾT Ý NGHĨA'));
  assert.ok(Number(svg.match(/height="(\d+)"/)[1]) > 630);
  assert.ok(!svg.includes('NGUYỄN MINH AN'));
  assert.ok(!svg.includes('Tiếng Anh, không dấu'));
  assert.ok(!svg.includes('DANH SÁCH LỚP'));
  assert.ok(!svg.includes('SURNAME'));
  assert.ok(!svg.includes('GIVEN NAMES'));
});

test('saved links can restore the entire expanded production catalogue', async () => {
  const { readFile } = await import('node:fs/promises');
  const names = JSON.parse(await readFile(new URL('../public/names.json', import.meta.url), 'utf8')).map(row => row.name);
  const url = createShareUrl('https://tenhay.fyi/', { kind: 'saved', names });
  assert.deepEqual(readSharedUrl(url).names, names);
});

test('individual image remains readable at phone width and preserves all meaning paragraphs', () => {
  const meaning = 'Con có cuộc sống bình an, hạnh phúc.\n\nThông minh và nhân hậu.';
  const svg = createShareSvg({kind:'name',name:'Hải Hà',family:'Tôn Nữ',meaning});
  const texts = [...svg.matchAll(/<text x="(\d+)" y="(\d+)" font-size="(\d+)"([^>]*)>([^<]*)<\/text>/gu)]
    .map(match => ({ x:Number(match[1]), y:Number(match[2]), font:Number(match[3]), attributes:match[4], text:match[5] }));
  const title = texts.filter(row => row.attributes.includes('font-weight="600"') && row.text !== 'tenhay.fyi');
  const body = texts.filter(row => !row.attributes.includes('font-weight'));
  assert.ok(title.every(row => row.font * 360 / 1200 >= 28));
  assert.ok(body.every(row => row.font * 360 / 1200 >= 16));
  assert.equal(body.map(row => row.text).join(' '), meaning.replace(/\s+/gu, ' '));
  assert.ok(body[0].y - title.at(-1).y > title.at(-1).font * .6);
  const paragraphStart = body.findIndex(row => row.text.startsWith('Thông minh'));
  assert.ok(body[paragraphStart].y - body[paragraphStart - 1].y > body[0].font * 1.5);
  const height = Number(svg.match(/height="(\d+)"/u)[1]);
  assert.ok(body.at(-1).y + body.at(-1).font < height);
});

test('measured wrapping fits long bold names and long meaning tokens without shrinking or clipping', () => {
  const measure = (text, size, weight) => [...text].reduce((width, character) =>
    width + size * (character === 'W' ? 1.2 : .6) * (weight === 600 ? 1.2 : 1), 0);
  const name = 'Hải Đăng Khoa';
  const family = 'Tôn Nữ Nguyễn Phúc';
  const meaning = 'W'.repeat(80);
  const svg = createShareSvg({kind:'name',name,family,meaning},measure);
  const texts = [...svg.matchAll(/<text x="(\d+)" y="(\d+)" font-size="(\d+)"([^>]*)>([^<]*)<\/text>/gu)]
    .map(match => ({ x:Number(match[1]), y:Number(match[2]), font:Number(match[3]), weight:match[4].includes('600') ? 600 : 400, text:match[5] }));
  const content = texts.filter(row => row.text !== 'tenhay.fyi');
  for (const row of content) assert.ok(row.x + measure(row.text,row.font,row.weight) <= 1128, row.text);
  assert.equal(content.filter(row => row.weight === 600).map(row => row.text).join(' '), family + ' ' + name);
  assert.equal(content.filter(row => row.weight === 400).map(row => row.text).join(''), meaning);
  assert.ok(content.filter(row => row.weight === 400).every(row => row.font >= 52));
});
