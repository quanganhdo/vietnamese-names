import { cleanName } from '../public/names-format.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

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

await writeFile(resolve(root, 'public/names.json'), JSON.stringify(rows));
await writeFile(resolve(root, 'public/data-info.json'), JSON.stringify(metadata, null, 2) + '\n');
const html = await readFile(resolve(root, 'public/index.html'), 'utf8');
await writeFile(resolve(root, 'public/index.html'), html.replace(/(<span id="total-names">)[^<]+/, (_, tag) => tag + rows.length.toLocaleString('en-US')));
console.log('Built ' + rows.length.toLocaleString('en-US') + ' names');
