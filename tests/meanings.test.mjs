import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateMeanings } from '../scripts/meanings.mjs';

test('keeps distinct descriptions while removing duplicates despite case, punctuation and Unicode form', () => {
  assert.deepEqual(deduplicateMeanings([
    'Thông minh, sáng suốt.', 'Thông minh, sáng suốt'.normalize('NFD'), 'THÔNG MINH, SÁNG SUỐT!',
    'Nhân hậu và sống tình cảm.',
  ]), ['Thông minh, sáng suốt.', 'Nhân hậu và sống tình cảm.']);
});

test('removes repeated whole sentences within and across descriptions', () => {
  assert.deepEqual(deduplicateMeanings([
    'Con sống bình an. Con luôn hạnh phúc.',
    'Con luôn hạnh phúc. Con được mọi người yêu mến.',
    'Con được mọi người yêu mến. Con được mọi người yêu mến.',
  ]), ['Con sống bình an. Con luôn hạnh phúc.', 'Con được mọi người yêu mến.']);
});

test('omits an entire short passage already present in a longer description', () => {
  assert.deepEqual(deduplicateMeanings(['Bình an.', 'Con có cuộc sống bình an, hạnh phúc.']),
    ['Con có cuộc sống bình an, hạnh phúc.']);
});

test('Ngọc Huệ retains sang trọng while removing repeated quý phái', () => {
  assert.deepEqual(deduplicateMeanings([
    'Ý nghĩa về sự quý phái và hạnh phúc an lành.', 'Sang trọng, quý phái',
  ]), ['Ý nghĩa về sự quý phái và hạnh phúc an lành.', 'Sang trọng']);
});

test('overlapping trait lists preserve each distinct trait without deleting both copies', () => {
  assert.deepEqual(deduplicateMeanings([
    'Thông minh, tuấn tú.', 'Thông minh, giàu sang.', 'Giàu sang, nhân hậu.',
  ]), ['Thông minh, tuấn tú.', 'Giàu sang.', 'Nhân hậu.']);
  assert.deepEqual(deduplicateMeanings(['Thông minh, thông minh, nhân hậu.']),
    ['Thông minh, nhân hậu.']);
});

test('keeps differently worded descriptions and narrative sentences intact', () => {
  const meanings = [
    'Gợi hình ảnh sông biển rộng lớn, khoáng đạt.',
    'Gợi hình ảnh biển và sông rộng lớn, mênh mông.',
    'Con quý giá như viên ngọc, đồng thời thông minh và tinh anh.',
    'Con thông minh, nhân hậu, luôn được mọi người yêu mến.',
  ];
  assert.deepEqual(deduplicateMeanings(meanings), meanings);
});

test('does not remove positive traits because a source mentions their negation', () => {
  assert.deepEqual(deduplicateMeanings([
    'Bình an.', 'Con không bình an.', 'Thông minh, nhân hậu.', 'Con không thông minh.',
  ]), ['Bình an.', 'Con không bình an.', 'Thông minh, nhân hậu.', 'Con không thông minh.']);
});

test('preserves accents, numbers, one-word meanings and comma punctuation in narrative', () => {
  const meanings = ['An.', 'Ân.', 'Êm.', 'Em.', 'Con sinh năm 2026, sống vui vẻ.',
    'Con có tài, có đức.', 'Thông minh: có trí tuệ tốt, học nhanh.'];
  assert.deepEqual(deduplicateMeanings(meanings), meanings);
});

test('cleanup is stable when applied again', () => {
  const result = deduplicateMeanings([
    'Ý nghĩa về sự quý phái và hạnh phúc an lành.', 'Sang trọng, quý phái',
    'Sang trọng, thông minh.', 'Con có cuộc sống bình an. Con có cuộc sống bình an.',
  ]);
  assert.deepEqual(deduplicateMeanings(result), result);
});

test('removes repeats exposed by shortening a trait list', () => {
  assert.deepEqual(deduplicateMeanings([
    'Đơn giản và mộc mạc.', 'Dung dị, tinh tế.', 'Dung nghĩa là dung dị, đơn giản và mộc mạc.',
  ]), ['Tinh tế.', 'Dung nghĩa là dung dị, đơn giản và mộc mạc.']);
});
