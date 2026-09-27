import { readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomInt } from 'node:crypto';

const formats = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']);
export const musicSettings = { volume: 0.18, fadeInSeconds: 1, fadeOutSeconds: 2 };

export async function selectMusic(directory, preferred) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('Adicione uma música à pasta music/ do projeto antes de gerar o reel.');
    throw error;
  }
  const files = entries.filter(entry => entry.isFile() && formats.has(extname(entry.name).toLowerCase())).map(entry => entry.name).sort();
  if (!files.length) throw new Error('A pasta music/ não contém músicas compatíveis (MP3, WAV, M4A, AAC, FLAC ou OGG).');
  if (preferred !== undefined && !files.includes(preferred)) throw new Error('--music deve ser o nome de uma música existente na pasta music/ do projeto.');
  const file = preferred ?? files[randomInt(files.length)];
  return { file, path: join(directory, file) };
}

export async function prepareMusic(track, publicDir, out) {
  await mkdir(join(publicDir, 'music'), { recursive: true });
  await copyFile(track.path, join(publicDir, 'music', track.file));
  const metadata = { file: track.file, source: `music/${track.file}`, ...musicSettings, loop: true };
  await writeFile(join(out, 'musica.json'), JSON.stringify(metadata, null, 2) + '\n');
  return { musica: metadata.source, volume: metadata.volume };
}
