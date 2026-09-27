import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, chmod, readdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateScript } from './codex.mjs';

const cli = fileURLToPath(new URL('../generate.mjs', import.meta.url));
const source = 'Ideia principal. Detalhe secundário. Conclusão importante.';
const selection = { visual: { prompt: 'A clean modern coding workspace in bright natural light.', description: 'Computação', scene: 0 }, title: 'Entenda a ideia principal', reelTitle: 'Conclusão importante.', slides: ['Conclusão importante.'], scenes: [{ texto: 'Ideia principal.' }] };
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args]);
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function fixture(t, body) {
  const temp = await mkdtemp(join(tmpdir(), 'ig-cli-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const input = join(temp, 'post com espaços.txt');
  const binary = join(temp, 'fake-codex');
  const out = join(temp, 'saída');
  await writeFile(input, source);
  await writeFile(binary, `#!/usr/bin/env node\nconst fs = require('node:fs');\nconst args = process.argv.slice(2);\nconst prompt = fs.readFileSync(0, 'utf8');\n${body}`);
  await chmod(binary, 0o755);
  return { input, out, binary, args: [input, '--plan-only', '--out', out, '--codex', binary] };
}

test('CLI envia o post ao Codex e salva a seleção, sem renderizar no modo plan-only', async t => {
  const f = await fixture(t, `
    if (!prompt.includes(${JSON.stringify(source)})) process.exit(4);
    if (args[args.indexOf('--model') + 1] !== 'modelo-do-usuario') process.exit(5);
    if (!args.includes('--output-schema') || args.includes(${JSON.stringify(source)})) process.exit(6);
    fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], ${JSON.stringify(JSON.stringify(selection))});`);
  const result = await run([...f.args, '--model', 'modelo-do-usuario']);
  assert.equal(result.code, 0, result.stderr);
  const saved = JSON.parse(await readFile(join(f.out, 'roteiro.json'), 'utf8'));
  assert.deepEqual(saved.slides, selection.slides);
  assert.deepEqual(saved.scenes, selection.scenes);
  assert.ok(!(await readdir(f.out)).includes('reel.mp4'));
  const again = await run(f.args);
  assert.equal(again.code, 1); // não sobrescreve uma geração anterior
});

test('CLI pede correção para JSON inválido e aceita a segunda seleção válida', async t => {
  const f = await fixture(t, `
    const response = args[args.indexOf('--output-last-message') + 1];
    if (response.endsWith('-2.json') && (!prompt.includes('reescrita fiel') || prompt.includes('somente trechos literais'))) process.exit(7);
    fs.writeFileSync(response, response.endsWith('-1.json') ? 'invalid json' : ${JSON.stringify(JSON.stringify(selection))});`);
  const result = await run(f.args);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /correção/);
});

test('CLI falha sem fallback para o post inteiro quando o Codex falha ou retorna roteiro inválido', async t => {
  for (const body of ['process.stderr.write("login necessário"); process.exit(1);',
    `fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], ${JSON.stringify(JSON.stringify({ ...selection, title: '' }))});`]) {
    const f = await fixture(t, body);
    const result = await run(f.args);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Codex/);
    assert.ok(!(await readdir(f.out)).includes('roteiro.json'));
  }
});

test('CLI informa dependência ausente, arquivo ausente e argumentos inválidos', async t => {
  const f = await fixture(t, '');
  const missing = await run([f.input, '--plan-only', '--out', f.out, '--codex', join(f.out, 'inexistente')]);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /Codex CLI não encontrado/);
  for (const args of [[], ['inexistente.txt'], ['post.csv'], ['--nao-existe']]) {
    const result = await run(args);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Erro:/);
  }
});

test('encerra uma chamada do Codex que excede o tempo limite', { timeout: 5000 }, async t => {
  const f = await fixture(t, "setInterval(() => {}, 1000);");
  await mkdir(f.out);
  await assert.rejects(generateScript(source, { temp: f.out, out: f.out, binary: f.binary, timeoutMs: 100 }), /tempo limite/);
});
