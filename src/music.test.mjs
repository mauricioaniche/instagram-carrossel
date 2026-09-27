import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectMusic, prepareMusic } from './music.mjs';
import { backgroundVolume } from './music-volume.mjs';

test('seleciona somente músicas da pasta e copia a faixa escolhida para a renderização', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ig-music-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'music');
  await mkdir(directory);
  await writeFile(join(directory, 'faixa.MP3'), 'audio fixture');
  await writeFile(join(directory, 'notas.txt'), 'não é música');
  await mkdir(join(directory, 'pasta.mp3'));
  const track = await selectMusic(directory);
  assert.equal(track.file, 'faixa.MP3');
  assert.equal((await selectMusic(directory, 'faixa.MP3')).path, track.path);
  await assert.rejects(selectMusic(directory, '../outra.mp3'), /--music/);
  const props = await prepareMusic(track, join(root, 'public'), root);
  assert.equal(props.musica, 'music/faixa.MP3');
  assert.equal(await readFile(join(root, 'public', props.musica), 'utf8'), 'audio fixture');
  assert.equal(JSON.parse(await readFile(join(root, 'musica.json'))).file, track.file);
});

test('pasta ausente ou vazia não gera um reel silencioso', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ig-music-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(selectMusic(join(root, 'missing')), /Adicione uma música/);
  await assert.rejects(selectMusic(root), /não contém músicas/);
});

test('volume de fundo tem fades nos extremos e permanece estável no meio do reel', () => {
  for (const total of [30, 114, 940]) {
    assert.equal(backgroundVolume(0, total), 0);
    assert.equal(backgroundVolume(total - 1, total), 0);
    assert.equal(backgroundVolume(Math.floor(total / 3), total), 0.18);
    for (let frame = 0; frame < total; frame++) assert.ok(backgroundVolume(frame, total) >= 0 && backgroundVolume(frame, total) <= 0.18);
  }
  assert.equal(backgroundVolume(300, 940), backgroundVolume(600, 940));
});
