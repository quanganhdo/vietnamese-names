import { cleanName } from '../public/names-format.mjs';

const word = String.raw`[\p{Lu}Đ][\p{L}\p{M}]*`;
const namePattern = new RegExp('^' + word + '(?: ' + word + '){0,3}$', 'u');
const families = { nguyen: 'Nguyễn', tran: 'Trần', le: 'Lê', pham: 'Phạm', phan: 'Phan', do: 'Đỗ', dang: 'Đặng', hoang: 'Hoàng', huynh: 'Huỳnh', truong: 'Trương', duong: 'Dương', vu: 'Vũ', vo: 'Võ', bui: 'Bùi', dinh: 'Đinh', ngo: 'Ngô', ly: 'Lý', ho: 'Hồ', mai: 'Mai', cao: 'Cao', luu: 'Lưu', lam: 'Lâm', trinh: 'Trịnh', luong: 'Lương', doan: 'Đoàn' };
const familyPattern = new RegExp(String.raw`họ\s+(` + Object.values(families).join('|') + String.raw`)(?=\s|$|[,.:])`, 'iu');
const skipSection = /biệt danh|tên (?:gọi )?ở nhà|nickname|tiếng (?:anh|nhật|trung|hàn|pháp|đức|nga|ý|thái|tây ban nha)|huggies|tiếng nước ngoài|công cụ|phần mềm|năm nào|thông tin cơ bản/i;
const ignoreLabels = new Set(['Tags', 'Tag', 'ALT', 'Bố', 'Mẹ', 'Con', 'Mệnh', 'Đặt Tên Con', 'Title', 'URL Source', 'Published Time', 'Tên', 'STT', 'Ý Nghĩa', 'Hán Việt', 'Tiếng Việt', 'Tên Gọi', 'Mệnh Kim', 'Mệnh Mộc', 'Mệnh Thủy', 'Mệnh Hỏa', 'Mệnh Hoả', 'Mệnh Thổ', 'Tình Duyên', 'Sự Nghiệp', 'Vận Mệnh', 'Xuất Xứ', 'Thần Số', 'Phong Thủy']);
export const sourceText = value => value.normalize('NFC').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, ' ').replace(/[\*_]/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const validName = value => !/^(?:Mệnh|Hành|Chữ|Năm) /u.test(value) && namePattern.test(value) && !ignoreLabels.has(value) && !value.startsWith('Huggies');
const genderOf = text => {
  const male = /bé trai|con trai|\bnam\b/i.test(text);
  const female = /bé gái|con gái|\bnữ\b/i.test(text);
  return male && female ? 'unisex' : male ? 'male' : female ? 'female' : null;
};

export function extractHuggiesArticle(markdown, { url, knownNames = new Set() } = {}) {
  const decodedUrl = decodeURIComponent(url);
  if (/tieng-(?!viet)|han-quoc|biet-danh|ten-o-nha|dat-ten-o-nha|dat-ten-con-trai-o-nha/.test(decodedUrl)) {
    return { records: [], fullNameExamples: [], excluded: 'foreign-or-nickname-article' };
  }
  const lines = markdown.split('\n');
  const bodyStart = lines.findIndex(line => line === 'Markdown Content:') + 1;
  const records = [], fullNameExamples = [], contexts = [], capturedDefinitions = new Set();
  const defaultGender = /con-trai|be-trai/.test(decodedUrl) ? 'male' : /con-gai|be-gai/.test(decodedUrl) ? 'female' : null;
  const slugFamily = decodedUrl.match(/(?:con-(?:trai|gai)|bo)-ho-([a-z]+)(?:-|$)/)?.[1];
  let table = null, flatTable = false;

  function context() {
    const headings = contexts.map(row => row.heading);
    return {
      heading: headings.join(' / '),
      wordCount: [...headings].reverse().filter(value => !(/(?:3|ba) chữ/i.test(value) && /(?:4|bốn) chữ/i.test(value))).map(value => /(?:4|bốn) chữ/i.test(value) ? 4 : /(?:3|ba) chữ/i.test(value) ? 3 : null).find(Boolean),
      gender: defaultGender || [...headings].reverse().map(genderOf).find(value => value) || null,
      family: [...headings].reverse().map(value => value.match(familyPattern)?.[1]).find(Boolean) || families[slugFamily],
      families: [...headings].map(value => value.match(familyPattern)?.[1]).filter(Boolean).concat(families[slugFamily] || []),
      skip: headings.some(value => skipSection.test(value)),
    };
  }
  function add(rawName, rawMeaning, line, format, suppliedContext = context()) {
    const sourceName = cleanName(sourceText(rawName).replace(/^\d+[.)]\s*/, '').replace(/^Tên\s+/, '').replace(/[:：]$/, ''));
    const meaning = sourceText(rawMeaning).replace(/^Ý nghĩa:\s*/i, '').split(/Gợi ý tên đệm\s*\/\s*tên lót:/i)[0].trim();
    if (!validName(sourceName) || meaning.length < 3 || suppliedContext.skip || /^\d{4}(?:[, -]|$)/.test(meaning) || /^https?:/.test(meaning)) return;
    const item = { sourceName, meaning, gender: suppliedContext.gender, line, format, heading: suppliedContext.heading };
    const words = sourceName.replace(/([\p{Ll}\p{M}])([\p{Lu}])/gu, '$1 $2').split(' ');
    if (words.length >= 4) { fullNameExamples.push({ ...item, name: sourceName }); return; }
    if (sourceName.length === 1 && /^[A-ZĐ]$/u.test(sourceName) && /chữ cái|alphabet|theo vần/i.test(suppliedContext.heading)) return;
    const family = suppliedContext.families?.find(value => value === words[0]) || (/theo họ|kèm họ|họ tên/i.test(suppliedContext.heading) && Object.values(families).includes(words[0]) ? words[0] : null);
    if (words.length === 3 && !family && Object.values(families).includes(words[0]) && !knownNames.has(sourceName) && suppliedContext.wordCount !== 3) {
      fullNameExamples.push({ ...item, name: sourceName, reason: 'possible-surname' }); return;
    }
    let name = words.join(' ');
    if (family && words.length >= 2 && words[0] === family) name = words.slice(1).join(' ');
    if (records.some(row => row.name === name && row.meaning === meaning && row.gender === item.gender)) return;
    records.push({ name, ...item });
  }
  for (let index = bodyStart; index < lines.length; index++) {
    const raw = lines[index], text = sourceText(raw);
    if (/^Tags\s*:/i.test(text)) break;
    const heading = raw.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      while (contexts.length && contexts.at(-1).level >= level) contexts.pop();
      contexts.push({ level, heading: sourceText(heading[2]) });
      table = null; flatTable = false;
      const nameMatch = sourceText(heading[2]).match(/^(?:Giải mã\s+)?(?:Ý nghĩa (?:của )?tên|Tên)\s+([\p{Lu}Đ][\p{L}\p{M}]*(?: [\p{Lu}Đ][\p{L}\p{M}]*){0,2})(?=\s|$)/u);
      if (nameMatch && !capturedDefinitions.has(nameMatch[1]) && !context().skip) {
        const paragraphs = [];
        for (let end = index + 1; end < lines.length && !/^#{1,6}\s/.test(lines[end]); end++) {
          const part = sourceText(lines[end]).replace(/^[*•-]\s*/, '');
          if (!part || /^(?:>>|>>>|Xem thêm|Tham khảo|Đọc thêm)/i.test(part) || /https?:|!\[/.test(lines[end]) || /^\|/.test(lines[end])) continue;
          if (/Huggies|\btã\b|\bbỉm\b|kem dưỡng/i.test(part)) continue;
          paragraphs.push(part);
        }
        if (paragraphs.length) {
          add(nameMatch[1], paragraphs.join(' '), index + 1, 'definition');
          capturedDefinitions.add(nameMatch[1]);
        }
      }
      continue;
    }
    if (text.includes('Tên') && text.includes('Ý nghĩa') && /^\*\*Tên/.test(raw)) { flatTable = true; continue; }
    if (/^\|/.test(raw)) {
      flatTable = false;
      const cells = raw.trim().replace(/^\||\|$/g, '').split('|').map(sourceText);
      if (cells.every(value => /^[-: ]+$/.test(value))) continue;
      const nameColumn = cells.findIndex(value => /^(?:họ và )?tên(?:\s|$)/i.test(value) && value.split(' ').length <= 8);
      const meaningColumn = cells.findIndex(value => /^(?:ý nghĩa|mô tả)(?:\s|$)/i.test(value));
      if (nameColumn >= 0 && meaningColumn >= 0 && nameColumn !== meaningColumn) {
        table = { name: nameColumn, meaning: meaningColumn };
      } else if (table) add(cells[table.name] || '', cells[table.meaning] || '', index + 1, 'table');
      continue;
    }
    table = null;
    if (flatTable && text && !/^(?:>>|Xem thêm|Đọc thêm)/i.test(text)) {
      // The reader may concatenate adjacent cells without a space. When the
      // name cell is bold, its markup is the boundary even if a heading has
      // the wrong given name or the meaning starts with a capitalized word.
      const boldCell = raw.match(/^\s*\*\*([^*]+)\*\*\s*(.+)$/u);
      if (boldCell && validName(sourceText(boldCell[1]))) {
        add(boldCell[1], boldCell[2], index + 1, 'flat-table');
        continue;
      }
      const words = text.split(' ');
      const candidates = [1, 2, 3, 4].map(size => ({ name: words.slice(0, size).join(' '), meaning: words.slice(size).join(' '), size }))
        .filter(value => validName(value.name) && value.meaning);
      const focal = context().heading.match(/tên ([\p{Lu}Đ][\p{L}\p{M}]*)/u)?.[1];
      const row = candidates.find(value => focal && value.name.split(' ').at(-1) === focal)
        || candidates.filter(value => knownNames.has(value.name)).sort((a, b) => b.size - a.size)[0];
      if (row) add(row.name, row.meaning, index + 1, 'flat-table');
    }
    if (/^(?:>>|Xem thêm|Đọc thêm)/i.test(text) || /https?:/.test(raw) && /^\s*[*>-]/.test(raw) && !/[:：]/.test(raw.replace(/https?:[^)]*/g, ''))) continue;
    const pair = text.replace(/^[•*-]\s*/, '').replace(/^\d+[.)]\s*/, '').match(/^([^:：]{1,80})[:：]\s*(.+)$/u);
    if (pair) add(pair[1], pair[2], index + 1, 'list');
  }
  return { records, fullNameExamples };
}
