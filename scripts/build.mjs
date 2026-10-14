import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { mergeNameData } from './data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const legacy = [];
for (const filename of ['names.jl', 'allnames.jl']) {
  const source = await readFile(resolve(root, filename), 'utf8');
  for (const line of source.split('\n').filter(line => line.trim())) legacy.push(JSON.parse(line));
}
const snapshot = JSON.parse(await readFile(resolve(root, 'data/huggies-current.json'), 'utf8'));
const { rows, metadata } = mergeNameData(legacy, snapshot);
const subtitle = '10,000+ tên tiếng Việt kèm ý nghĩa';
const imageAlt = 'tenhay.fyi và dòng “' + subtitle + '” trên nền trắng.';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#fff"/><g font-family="Arial, Liberation Sans, sans-serif" text-anchor="middle"><text x="600" y="290" font-size="160" font-weight="700" fill="#202020">tenhay.fyi</text><text x="600" y="402" font-size="60" font-weight="600" fill="#333">' + subtitle + '</text></g></svg>\n';
const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: process.platform === 'linux' ? 'Liberation Sans' : 'Arial' } }).render().asPng();
let html = await readFile(resolve(root, 'public/index.html'), 'utf8');
html = html.replace(/((?:property="og:image:alt"|name="twitter:image:alt") content=")[^"]+/, (_, tag) => tag + imageAlt)
  .replace(/(name="twitter:image:alt" content=")[^"]+/, (_, tag) => tag + imageAlt);
await writeFile(resolve(root, 'public/names.json'), JSON.stringify(rows));
await writeFile(resolve(root, 'public/data-info.json'), JSON.stringify(metadata, null, 2) + '\n');
await writeFile(resolve(root, 'assets/share.svg'), svg);
await writeFile(resolve(root, 'public/share.png'), png);
await writeFile(resolve(root, 'public/index.html'), html);
const { sources, ...summary } = metadata;
console.log(JSON.stringify(summary, null, 2));
