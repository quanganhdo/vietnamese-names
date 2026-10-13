import { cleanName, capitalizeFamily, formatFullName, formatMachineName, splitName } from './names-format.mjs';
import { compareNames } from './search.mjs';

const sample = [
  ['Trần', 'Bảo An'], ['Phạm', 'Minh Anh'], ['Lê', 'Gia Bảo'],
  ['Nguyễn', 'Ngọc Bích'], ['Võ', 'Minh Châu'], ['Đặng', 'Thùy Dương'],
  ['Bùi', 'Khánh Linh'], ['Hoàng', 'Bảo Ngọc'], ['Phan', 'Minh Quân'],
];
const collator = new Intl.Collator('vi');

export function classListRows(family, name, classmates = sample) {
  const selected = {
    family: capitalizeFamily(family).trim().replace(/\s+/g, ' '),
    name: cleanName(name),
    selected: true,
  };
  selected.fullName = formatFullName(selected.family, selected.name);
  const rows = classmates.map(([family, name]) => ({ family, name, fullName: formatFullName(family, name), selected: false }))
    .filter(row => row.fullName !== selected.fullName);
  return [...rows, selected].map(row => ({ ...row, ...splitName(row.name) }))
    .sort((a, b) => compareNames(a, b) || collator.compare(a.family, b.family));
}

function xml(text) {
  return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));
}

function wrap(text, width = 28) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && [...line, ...word].length + 1 > width) { lines.push(line); line = ''; }
    const characters = [...word];
    while (characters.length > width) {
      if (line) { lines.push(line); line = ''; }
      lines.push(characters.splice(0, width).join(''));
    }
    const tail = characters.join('');
    if (tail) line = line ? `${line} ${tail}` : tail;
  }
  if (line) lines.push(line);
  return lines;
}

export function createClassListSvg(family, name, classmates) {
  const rows = classListRows(family, name, classmates);
  let y = 98;
  const graphics = rows.map((row, index) => {
    const lines = wrap(row.fullName);
    const height = Math.max(48, lines.length * 30 + 16);
    const graphic = `<g${row.selected ? ' data-selected="true"' : ''}>
      <rect x="20" y="${y}" width="440" height="${height}" fill="${row.selected ? '#fff0a3' : '#fff'}"/>
      <text x="49" y="${y + 31}" text-anchor="middle" font-size="21">${index + 1}</text>
      ${lines.map((line, offset) => `<text x="92" y="${y + 31 + offset * 30}" font-size="22" font-weight="${row.selected ? '700' : '400'}">${xml(line)}</text>`).join('')}
      <path d="M20 ${y + height}H460" fill="none" stroke="#777"/>
    </g>`;
    y += height;
    return graphic;
  }).join('');
  const title = `Danh sách lớp mẫu. ${formatFullName(family, name)} được tô sáng.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${y + 20}" viewBox="0 0 480 ${y + 20}" role="img">
    <title>${xml(title)}</title>
    <rect width="480" height="${y + 20}" fill="#fff"/>
    <g font-family="'Times New Roman', serif" fill="#111">
      <text x="240" y="36" text-anchor="middle" font-size="26" font-weight="700">DANH SÁCH LỚP</text>
      <rect x="20" y="60" width="440" height="38" fill="#f1f1f1"/>
      <text x="49" y="86" text-anchor="middle" font-size="20" font-weight="700">STT</text>
      <text x="270" y="86" text-anchor="middle" font-size="22" font-weight="700">Họ và tên</text>
      ${graphics}
    </g>
    <path d="M20 60H460V${y}H20Z M80 60V${y} M20 98H460" fill="none" stroke="#777"/>
  </svg>`;
}

export function createNameCardSvg(family, name) {
  const surname = formatFullName(family, '', 'en').toUpperCase() || '—';
  const given = formatFullName('', name, 'en').toUpperCase();
  let y = 34;
  const fields = [['SURNAME', surname], ['GIVEN NAMES', given]].map(([label, value]) => {
    const lines = wrap(value, 27);
    const top = y;
    y += 25 + lines.length * 32 + 22;
    return `<text x="24" y="${top}" font-size="22" fill="#555">${label}</text>
      ${lines.map((line, index) => `<text x="24" y="${top + 30 + index * 32}" font-size="26" font-weight="600">${xml(line)}</text>`).join('')}`;
  }).join('');
  const machineLines = formatMachineName(family, name).match(/.{1,39}/g);
  const bandTop = y - 8;
  const height = bandTop + machineLines.length * 28 + 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${height}" viewBox="0 0 480 ${height}" role="img">
    <title>${xml(`Surname: ${surname}. Given names: ${given}.`)}</title>
    <rect x="1" y="1" width="478" height="${height - 2}" rx="4" fill="#fff" stroke="#aaa"/>
    <g font-family="Arial, sans-serif" fill="#111">${fields}</g>
    <rect x="2" y="${bandTop}" width="476" height="${height - bandTop - 2}" fill="#f3f3f3"/>
    <g font-family="'Courier New', monospace" font-size="22" fill="#111">
      ${machineLines.map((line, index) => `<text x="24" y="${bandTop + 29 + index * 28}" textLength="${line.length * 432 / 39}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${xml(line)}</text>`).join('')}
    </g>
  </svg>`;
}
