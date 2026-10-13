import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { cleanName } from '../public/names-format.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const legacy = [];
for (const filename of ['names.jl', 'allnames.jl']) {
  const source = await readFile(resolve(root, filename), 'utf8');
  for (const line of source.split('\n').filter(line => line.trim())) legacy.push(JSON.parse(line));
}
const names = new Map();
for (const row of legacy) {
  const name = cleanName(row.first_name);
  const meaning = row.meaning.normalize('NFC').trim().replace(/\s+/g, ' ');
  const gender = { 3: 'male', 5: 'female', 7: 'unisex' }[row.sex];
  if (!name || !meaning || !gender) throw new Error('Invalid legacy Huggies record');
  const existing = names.get(name);
  if (!existing) names.set(name, { name, gender, meanings: [meaning] });
  else {
    if (existing.gender !== gender) existing.gender = 'unisex';
    if (!existing.meanings.includes(meaning)) existing.meanings.push(meaning);
  }
}
const rows = [...names.values()].map(({ name, gender, meanings }) => ({ name, gender, meaning: meanings.join('\n\n') }));
const metadata = { total: rows.length, legacyTotal: rows.length, added: 0, changed: 0, refreshed: 0, coverage: 'legacy-2017' };
const count = rows.length.toLocaleString('en-US');
const subtitle = count + ' tên tiếng Việt kèm ý nghĩa';
const imageAlt = 'tenhay.fyi và dòng “' + subtitle + '” trên nền trắng.';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#fff"/><g font-family="Arial, sans-serif" text-anchor="middle"><text x="600" y="296" font-size="104" font-weight="700" fill="#202020">tenhay.fyi</text><text x="600" y="366" font-size="32" fill="#666">' + subtitle + '</text></g></svg>\n';
const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render().asPng();
let html = await readFile(resolve(root, 'public/index.html'), 'utf8');
html = html.replace(/(<span id="total-names">)[^<]+/, (_, tag) => tag + count)
  .replace(/((?:property="og:image:alt"|name="twitter:image:alt") content=")[^"]+/, (_, tag) => tag + imageAlt)
  .replace(/(name="twitter:image:alt" content=")[^"]+/, (_, tag) => tag + imageAlt);
await writeFile(resolve(root, 'public/names.json'), JSON.stringify(rows));
await writeFile(resolve(root, 'public/data-info.json'), JSON.stringify(metadata, null, 2) + '\n');
await writeFile(resolve(root, 'assets/share.svg'), svg);
await writeFile(resolve(root, 'public/share.png'), png);
await writeFile(resolve(root, 'public/index.html'), html);
const { sources, ...summary } = metadata;
console.log(JSON.stringify(summary, null, 2));
