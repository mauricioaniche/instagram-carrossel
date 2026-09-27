import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomInt } from 'node:crypto';
import { reviewPhoto } from './photo-review.mjs';

const compositions = ['overhead editorial composition', 'intimate detail with shallow depth of field', 'wider environmental scene', 'three-quarter view with generous negative space'];
const colors = ['ivory and sage accents', 'pale blue and apricot accents', 'warm cream and teal accents', 'soft lavender and peach accents'];
export function imagePrompt(post) {
  return `${post.visual.prompt}\nArt direction variation: ${compositions[randomInt(compositions.length)]}; ${colors[randomInt(colors.length)]}. Bright clean modern editorial conceptual photograph. Respect the post-specific subject above. Vertical composition, main subject in upper 60%, quiet lower area for a title overlay. No typography, logos, watermarks, old technology, or real named people. Realistic anatomy and equipment.`;
}
export async function generatePng(prompt, { apiKey = process.env.OPENAI_API_KEY, imageModel = 'gpt-image-2.5-flare', fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('Configure OPENAI_API_KEY ou informe --image com uma imagem gerada.');
  const response = await fetchImpl('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: imageModel, prompt, n: 1, size: '1024x1536', quality: 'high', output_format: 'png' }),
    signal: AbortSignal.timeout(240000),
  });
  if (!response.ok) throw new Error(`Geração de imagem falhou (HTTP ${response.status}). Confira acesso ao modelo, chave e saldo da API.`);
  const result = await response.json();
  if (typeof result.data?.[0]?.b64_json !== 'string') throw new Error('API de imagens não retornou PNG em base64.');
  const bytes = Buffer.from(result.data[0].b64_json, 'base64');
  validatePng(bytes);
  return bytes;
}
function validatePng(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.readUInt32BE(16) < 1024 || bytes.readUInt32BE(20) < 1024) throw new Error('Use imagem PNG válida com ao menos 1024 pixels em cada dimensão.');
}
export async function prepareGeneratedImage(post, out, options = {}) {
  const { imagePath, source, binary, model, review = reviewPhoto, generate = generatePng } = options;
  const folder = join(out, 'fotos'); await mkdir(folder, { recursive: true });
  const reports = []; let correction = '';
  for (let attempt = 1; attempt <= (imagePath ? 1 : 3); attempt++) {
    const prompt = imagePrompt(post) + correction;
    await writeFile(join(out, `image-prompt-${attempt}.txt`), prompt);
    const candidatePath = join(folder, `candidate-${attempt}.png`);
    const bytes = imagePath ? await readFile(imagePath) : await generate(prompt, options);
    validatePng(bytes); await writeFile(candidatePath, bytes);
    const assessment = await review({ imagePath: candidatePath, source, post, candidate: { title: 'Imagem conceitual gerada por IA', query: prompt } }, { binary, model });
    reports.push({ attempt, prompt, ...assessment });
    await writeFile(join(out, 'avaliacoes-imagens.json'), JSON.stringify(reports, null, 2));
    if (assessment.approved) {
      await copyFile(candidatePath, join(folder, 'editorial.png'));
      post.photo = { file: 'editorial.png', generated: true, provider: imagePath ? 'supplied-generated-image' : 'openai-images-api', model: imagePath ? null : options.imageModel || 'gpt-image-2.5-flare', review: assessment };
      // Elimina referências de imagens de roteiros antigos antes de selecionar uma cena.
      post.scenes.forEach(scene => { delete scene.foto; });
      post.scenes[post.visual.scene].foto = 'editorial.png';
      return post.photo;
    }
    correction = `\nThe previous generated image was rejected. Correct these issues: ${assessment.reason}`;
  }
  throw new Error('Imagem rejeitada pela revisão visual. Consulte avaliacoes-imagens.json; nenhuma imagem não aprovada será renderizada.');
}
