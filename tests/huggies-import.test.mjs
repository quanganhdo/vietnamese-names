
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHuggiesArticle } from '../scripts/huggies-import.mjs';

const url = 'https://www.huggies.com.vn/mang-thai/dat-ten-cho-con/y-nghia-ten-duy';
test('source tables preserve Vietnamese spelling, meaning and line provenance', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Tên đệm cho bé gái\n| STT | Tên | Ý nghĩa |\n| --- | --- | --- |\n| 1 | Bảo Ngọc | Con là viên ngọc quý. |', { url });
  assert.deepEqual(result.records.map(({ name, meaning, gender, line }) => ({ name, meaning, gender, line })), [{ name: 'Bảo Ngọc', meaning: 'Con là viên ngọc quý.', gender: 'female', line: 5 }]);
});
test('flattened source tables retain every name without consuming the first word of its meaning', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Tên đệm cho con trai tên Duy\n**Tên****Ý nghĩa**\nNhật Duy Mang nghĩa ánh sáng trí tuệ.\nThế Duy Người có tư duy rộng mở.\nAn Duy Thể hiện sự an hòa.', { url });
  assert.deepEqual(result.records.map(row => row.name), ['Nhật Duy', 'Thế Duy', 'An Duy']);
  assert.equal(result.records[0].meaning, 'Mang nghĩa ánh sáng trí tuệ.');
});
test('explicit surname context strips the surname while four-word examples stay separate', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Tên con gái họ Lê\n* **Lê Ngọc Hà:** Con là viên ngọc trong trẻo.\n* **Lê Thị Ngọc Hà:** Con là viên ngọc trong trẻo.', { url });
  assert.equal(result.records[0].name, 'Ngọc Hà');
  assert.equal(result.records[0].sourceName, 'Lê Ngọc Hà');
  assert.equal(result.fullNameExamples[0].sourceName, 'Lê Thị Ngọc Hà');
});
test('mixed surname sections do not import surnames as middle names', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Tên con gái theo họ\n* **Nguyễn Hải An:** Con có cuộc sống bình an.\n* **Trần Ngọc Hà:** Con là viên ngọc trong trẻo.', { url });
  assert.deepEqual(result.records.map(row => row.name), ['Hải An', 'Ngọc Hà']);
});
test('foreign names, nicknames, advertisements and metadata are excluded', () => {
  const result = extractHuggiesArticle('Title: Dữ liệu tên\nMarkdown Content:\n## Tên con gái\n* **Bảo Ngọc:** Con là viên ngọc quý.\n* **Huggies Black Label:** Sản phẩm tã.\n## Tên tiếng Pháp cho con gái\n* **Alice:** Cao quý.\n## Biệt danh\n* **Andy:** Mạnh mẽ.\nTags: Các bài viết khác', { url });
  assert.deepEqual(result.records.map(row => row.name), ['Bảo Ngọc']);
});
test('alphabet index entries are not mistaken for names with meanings', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Tên theo chữ cái\nB: Bảo Long, Bách Tùng, Bình An\n* **BảoLong:** Con rồng quý.', { url });
  assert.deepEqual(result.records.map(row => row.name), ['Bảo Long']);
  assert.equal(result.records[0].sourceName, 'BảoLong');
});
test('ambiguous full names stay separate while explicit three-word names remain selectable', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Tên hay\n* **Nguyễn Hải An:** Cuộc sống bình an.\n## Tên con gái 3 chữ\n* **Mai Thanh Hà:** Nhẹ nhàng, trong trẻo.', { url });
  assert.deepEqual(result.records.map(row => row.name), ['Mai Thanh Hà']);
  assert.equal(result.fullNameExamples[0].sourceName, 'Nguyễn Hải An');
});

test('meaning cells mentioning tên or ý nghĩa are data rows rather than headers', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Tên cho bé trai\n| Tên | Ý nghĩa |\n| --- | --- |\n| Công | **Ý nghĩa:** Tên Công mang ý nghĩa thành công. **Gợi ý tên đệm / tên lót:** Minh Công, Đức Công. |\n| Khiêm | **Ý nghĩa:** Tên Khiêm là khiêm nhường. |', { url });
  assert.deepEqual(result.records.map(row => row.name), ['Công', 'Khiêm']);
  assert.equal(result.records[0].meaning, 'Tên Công mang ý nghĩa thành công.');
});
test('calendar years, tool recommendations and image labels are not baby names', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Tên con\nALT: Một số tên hay\nBố: Nguyễn Hải Long\nHành Kim: Kim loại\nBính Tý: 1936, 1996 – Giản Hạ Thuỷ.\n## Công cụ đặt tên\nDattencon: Gợi ý tên\n## Tên tiếng nước ngoài\nJohn: Chúa từ bi.', { url });
  assert.equal(result.records.length, 0);
});

test('a broad three-or-four-word heading does not hide an explicit three-word list', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Đặt tên con gái 3 chữ hay 4 chữ\n### Tên con gái 3 chữ\n* **Mai Thanh Hà:** Nhẹ nhàng, trong trẻo.', { url });
  assert.equal(result.records[0].name, 'Mai Thanh Hà');
  assert.equal(result.fullNameExamples.length, 0);
});
test('three-word full names listed inside an explicit four-word section remain excluded', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Tên con 3 chữ hay 4 chữ\n### Tên con 4 chữ\n* **Hoàng Nhật Duy:** Cuộc sống sáng lạn.', { url });
  assert.equal(result.records.length, 0);
  assert.equal(result.fullNameExamples[0].sourceName, 'Hoàng Nhật Duy');
});

test('bold flattened name cells preserve both words when joined to meanings and the heading is wrong', () => {
  const result = extractHuggiesArticle('Markdown Content:\n## Các tên đệm cho con gái tên Huyền\n**Tên ghép****Ý nghĩa ngắn gọn**\n**Mỹ Linh**Vẻ đẹp thanh tú, dịu dàng và cao quý\n**Ngọc Linh**Ngọc quý tỏa sáng, trong sáng và bền vững', {
    url: 'https://www.huggies.com.vn/mang-thai/dat-ten-cho-con/y-nghia-ten-phuong-linh',
    knownNames: new Set(['Mỹ', 'Ngọc']),
  });
  assert.deepEqual(result.records.map(({ name, meaning }) => ({ name, meaning })), [
    { name: 'Mỹ Linh', meaning: 'Vẻ đẹp thanh tú, dịu dàng và cao quý' },
    { name: 'Ngọc Linh', meaning: 'Ngọc quý tỏa sáng, trong sáng và bền vững' },
  ]);
});
