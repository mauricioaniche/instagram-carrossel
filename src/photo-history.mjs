import { mkdir, readFile, readdir, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomInt } from 'node:crypto';

export const photoKey = photo => new URL(photo.sourceUrl).pathname;
export function shuffledUnused(candidates, used, pick = randomInt) {
  const unique = [...new Map(candidates.map(p => [photoKey(p), p])).values()].filter(p => !used.has(photoKey(p)));
  for (let i = unique.length - 1; i > 0; i--) { const j = pick(i + 1); [unique[i], unique[j]] = [unique[j], unique[i]]; }
  return unique;
}
async function scan(root, entries) {
  for (const f of await readdir(root, { withFileTypes: true })) {
    if (f.name.startsWith('.')) continue;
    const path = join(root, f.name);
    if (f.isDirectory()) await scan(path, entries);
    else if (f.name === 'licencas.json') {
      try { const p = JSON.parse(await readFile(path, 'utf8')); if (p.sourceUrl) entries.push(photoKey(p)); } catch {}
    }
  }
}
export async function withPhotoHistory(file, action) {
  await mkdir(dirname(file), { recursive: true });
  const lock = file + '.lock';
  let acquired = false;
  for (let i = 0; i < 120; i++) {
    try { await mkdir(lock); acquired = true; break; } catch (e) { if (e.code !== 'EEXIST') throw e; }
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!acquired) throw new Error(`Histórico de fotos ocupado. Confira execuções em andamento antes de remover ${lock}.`);
  try {
    let entries;
    try { entries = JSON.parse(await readFile(file, 'utf8')); if (!Array.isArray(entries)) throw new Error('Histórico inválido'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; entries = []; await scan(dirname(file), entries); }
    const result = await action(new Set(entries));
    entries.push(photoKey(result));
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify([...new Set(entries)], null, 2));
    await rename(temp, file);
    return result;
  } finally { await rm(lock, { recursive: true, force: true }); }
}
