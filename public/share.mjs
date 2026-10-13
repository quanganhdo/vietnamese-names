import { cleanName, capitalizeFamily, formatFullName } from './names-format.mjs';

export function encodeSavedNames(names) {
  const unique = [...new Set([...names].filter(name => typeof name === 'string').map(cleanName).filter(Boolean))];
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, names: unique }));
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeSavedNames(hash) {
  try {
    const value = new URLSearchParams(hash.replace(/^#/, '')).get('saved');
    if (!value || value.length > 500000 || !/^[\w-]+$/.test(value)) return null;
    const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
    const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0))));
    if (payload.v !== 1 || !Array.isArray(payload.names)) return null;
    if (!payload.names.every(name => typeof name === 'string' && name.length <= 200)) return null;
    return [...new Set(payload.names.map(cleanName).filter(Boolean))];
  } catch { return null; }
}

export function readSharedUrl(href) {
  const url = new URL(href);
  return {
    name: cleanName((url.searchParams.get('name') || '').slice(0, 200)),
    family: url.searchParams.has('family') ? capitalizeFamily(url.searchParams.get('family').slice(0, 80)) : undefined,
    savedOnly: url.searchParams.get('view') === 'saved',
    names: decodeSavedNames(url.hash),
  };
}

export function createShareUrl(base, { kind = 'page', name = '', names = [], family = '', display = 'vi', query = '', given = '', gender = 'all', length = 'all', scope = 'name' } = {}) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  const params = url.searchParams;
  params.set('family', capitalizeFamily(family).trim());
  if (display === 'en') params.set('display', 'en');
  if (kind === 'name') {
    params.set('name', cleanName(name));
    params.set('q', cleanName(name));
  } else if (kind === 'saved') {
    params.set('view', 'saved');
    url.hash = 'saved=' + encodeSavedNames(names);
  } else {
    if (query.trim()) params.set('q', query.trim());
    if (given.trim()) params.set('given', given.trim());
    if (gender !== 'all') params.set('gender', gender);
    if (length !== 'all') params.set('length', length);
    if (scope !== 'name') params.set('scope', scope);
  }
  return url.href;
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));
}

function wrap(text, width) {
  const lines = [];
  let line = '';
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const chars = [...word];
    if (line && [...line].length + chars.length + 1 > width) { lines.push(line); line = ''; }
    while (chars.length > width) {
      if (line) { lines.push(line); line = ''; }
      lines.push(chars.splice(0, width).join(''));
    }
    if (chars.length) line = line ? line + ' ' + chars.join('') : chars.join('');
  }
  if (line) lines.push(line);
  return lines;
}

export function createShareSvg({ kind, family = '', display = 'vi', name = '', meaning = '', names = [] }) {
  let content = '';
  let height = 630;
  if (kind === 'saved') {
    const columns = names.length > 8 ? 2 : 1;
    const perColumn = Math.ceil(names.length / columns);

    content += names.map((name, index) => {
      const text = formatFullName(family, name, display);
      const x = 72 + Math.floor(index / perColumn) * 568;
      const y = 184 + (index % perColumn) * 78;
      const width = columns === 1 ? 1056 : 480;
      const font = columns === 1 ? 38 : 34;
      return '<text x="' + x + '" y="' + y + '" font-size="' + font + '"' +
        (text.length * font * .62 > width ? ' textLength="' + width + '" lengthAdjust="spacingAndGlyphs"' : '') + '>' + xml(text) + '</text>';
    }).join('');
    height = Math.max(630, 184 + perColumn * 78 + 64);
  } else {
    const full = formatFullName(family, name, display);
    const font = full.length > 80 ? 38 : full.length > 40 ? 48 : 62;
    const lines = wrap(full, Math.floor(1056 / (font * .7)));
    content = lines.map((line, index) => '<text x="72" y="' + (184 + index * (font + 10)) + '" font-size="' + font + '" font-weight="600">' + xml(line) + '</text>').join('');
    let y = 184 + (lines.length - 1) * (font + 10) + 70;
    if (meaning) {

      const all = wrap(meaning, 56);
      content += all.map((line, index) => '<text x="72" y="' + (y + index * 38) + '" font-size="28">' + xml(line) + '</text>').join('');
      y += all.length * 38;
    }
    height = Math.max(630, y + 88);
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="' + height + '" viewBox="0 0 1200 ' + height + '"><rect width="1200" height="' + height + '" fill="#fff"/><g font-family="Arial, sans-serif" fill="#202020"><text x="72" y="82" font-size="36" font-weight="600">tenhay.fyi</text>' + content + '</g></svg>';
}

export async function svgToPng(svg) {
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Image could not be rendered'));
      image.src = source;
    });
    const canvas = document.createElement('canvas');
    const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    canvas.width = Number(root.getAttribute('width')) || 1200;
    canvas.height = Number(root.getAttribute('height')) || 630;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG unavailable')), 'image/png'));
  } finally { URL.revokeObjectURL(source); }
}
