import { cleanName } from '../public/names-format.mjs';

const genders = new Set(['male', 'female', 'unisex']);
const cleanMeaning = value => value.normalize('NFC').trim().replace(/\s+/g, ' ');

export function mergeNameData(legacyRows, snapshot) {
  if (snapshot.version !== 1 || !snapshot.sources?.length || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.retrievedAt)) {
    throw new Error('Invalid current Huggies snapshot');
  }
  const names = new Map();
  for (const row of legacyRows) {
    const name = cleanName(row.first_name);
    const meaning = cleanMeaning(row.meaning);
    const gender = { 3: 'male', 5: 'female', 7: 'unisex' }[row.sex];
    if (!name || !meaning || !gender) throw new Error('Invalid legacy Huggies record');
    const existing = names.get(name);
    if (!existing) names.set(name, { name, gender, meanings: [meaning] });
    else {
      if (existing.gender !== gender) existing.gender = 'unisex';
      if (!existing.meanings.includes(meaning)) existing.meanings.push(meaning);
    }
  }
  const baselineCount = names.size;
  const current = new Map();
  for (const source of snapshot.sources) {
    if (!source.url?.startsWith('https://www.huggies.com.vn/') || !source.records?.length) throw new Error('Invalid Huggies source');
    for (const row of source.records) {
      const name = cleanName(row.name);
      if (name.startsWith('Huggies ')) throw new Error('Huggies advertisement in name records');
      if (name.split(/\s+/).length >= 3 && (!row.sourceName || cleanName(row.sourceName).split(/\s+/).length !== name.split(/\s+/).length)) {
        throw new Error('Unspecified surname boundary in three-word source name');
      }
      const meaning = cleanMeaning(row.meaning);
      if (!name || !meaning || (row.gender !== null && !genders.has(row.gender))) throw new Error('Invalid current Huggies record');
      let existing = current.get(name);
      if (!existing) {
        existing = { name, meanings: [], genders: new Set(), sources: new Set() };
        current.set(name, existing);
      }
      if (!existing.meanings.includes(meaning)) existing.meanings.push(meaning);
      if (row.gender) existing.genders.add(row.gender);
      existing.sources.add(source.url);
    }
  }
  let added = 0;
  let changed = 0;
  for (const row of current.values()) {
    const previous = names.get(row.name);
    const labels = [...row.genders];
    const gender = labels.length > 1 ? 'unisex' : labels[0] || previous?.gender || 'unisex';
    if (!previous) added++;
    else if (previous.gender !== gender || previous.meanings.join('\n\n') !== row.meanings.join('\n\n')) changed++;
    // Current source wording replaces every legacy meaning for this name.
    names.set(row.name, { name: row.name, gender, meanings: row.meanings });
  }
  const rows = [...names.values()].map(({ name, gender, meanings }) => ({ name, gender, meaning: meanings.join('\n\n') }));
  const metadata = {
    retrievedAt: snapshot.retrievedAt,
    coverage: snapshot.coverage,
    legacyDirectoryStatus: snapshot.legacyDirectoryStatus,
    total: rows.length,
    legacyTotal: baselineCount,
    refreshed: current.size,
    changed,
    added,
    retainedLegacy: baselineCount - (current.size - added),
    sourceCount: snapshot.sources.length,
    excludedFullNameExamples: snapshot.sources.reduce((total, source) => total + (source.fullNameExamples?.length || 0), 0),
    sourceRecords: snapshot.sources.reduce((total, source) => total + source.records.length, 0),
    sources: snapshot.sources.map(({ id, url, accessedAt, readerCrawl, records }) => ({ id, url, accessedAt, readerCrawl, records: records.length })),
  };
  return { rows, metadata };
}
