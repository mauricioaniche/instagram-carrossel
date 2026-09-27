import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { normalizeText, validateScript } from './content.mjs';

export function runCodex(binary, args, prompt, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const executable = binary || process.execPath;
    const commandArgs = binary ? args : [fileURLToPath(new URL('../node_modules/@openai/codex/bin/codex.js', import.meta.url)), ...args];
    const child = spawn(executable, commandArgs, { cwd, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'ignore', 'pipe'] });
    let diagnostics = '';
    let timedOut = false;
    // Limita tanto o tempo da chamada quanto o volume do diagnóstico em memória.
    const timer = setTimeout(() => {
      timedOut = true;
      // A CLI npm inicia um binário filho: encerra o grupo para não deixá-lo rodando.
      if (process.platform !== 'win32' && child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') child.kill('SIGKILL'); }
      } else child.kill('SIGKILL');
    }, timeoutMs);
    child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk.toString()).slice(-8000); });
    child.stdin.on('error', () => {}); // EPIPE será tratado pelo status/erro do processo.
    child.once('error', error => {
      clearTimeout(timer);
      reject(new Error(error.code === 'ENOENT' ? 'Codex CLI não encontrado. Execute npm ci e npx codex login nesta pasta, ou confira --codex /caminho/codex.' : error.message));
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error('O Codex excedeu o tempo limite de geração. Tente novamente.'));
      if (code !== 0) {
        const errors = diagnostics.split('\n').filter(line => line.startsWith('ERROR:'));
        const detail = (errors.length ? errors.join('\n') : diagnostics.trim()).slice(-2000);
        return reject(new Error(`Codex falhou (${signal || code}). Verifique npx codex login, a versão da CLI e sua disponibilidade de uso.\n${detail}`));
      }
      resolve();
    });
    child.stdin.end(prompt);
  });
}

export async function generateScript(source, { temp, out, binary, model, timeoutMs = 180000 }) {
  const text = normalizeText(source);
  const instructions = await readFile(new URL('./editorial-prompt.txt', import.meta.url), 'utf8');
  const schema = fileURLToPath(new URL('./script.schema.json', import.meta.url));
  const examples = JSON.parse(await readFile(new URL('../examples/editorial.json', import.meta.url), 'utf8'));
  const basePrompt = `${instructions}\nReferências editoriais (entrada e carrossel de referência):\n${JSON.stringify(examples)}\nPost atual a adaptar:\n${JSON.stringify({ post: text })}\n`;
  await writeFile(join(out, 'prompt.txt'), basePrompt);
  let correction = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const responseFile = join(out, `codex-response-${attempt}.json`);
    const args = ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '--color', 'never',
      '-c', 'approval_policy="never"', '--output-schema', schema, '--output-last-message', responseFile];
    if (model) args.push('--model', model);
    args.push('-');
    await runCodex(binary, args, basePrompt + correction, temp, timeoutMs);
    try {
      const result = JSON.parse(await readFile(responseFile, 'utf8'));
      return validateScript(result, text);
    } catch (error) {
      if (attempt === 2) throw new Error(`Roteiro do Codex inválido após duas tentativas: ${error.message}`);
      console.log('O roteiro precisa de ajuste; solicitando uma correção ao Codex…');
      correction = `\nUma tentativa anterior não passou na validação: ${error.message}\nGere novamente o roteiro completo respeitando os limites, com reescrita fiel ao post atual, uma ideia por slide e direção visual com índices válidos. Não copie fatos dos exemplos para o post atual.\n`;
    }
  }
}
