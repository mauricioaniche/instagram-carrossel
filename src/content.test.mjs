import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, validateScript } from './content.mjs';
import { carouselHtml } from './carousel.mjs';

const source = 'A tese principal. Um exemplo secundário. A conclusão.';
const script = { visual: { prompt: 'A clean modern coding workspace in bright natural light.', description: 'Computação', scene: 0 }, title: 'A tese principal.', reelTitle: 'A conclusão.', slides: ['A tese principal.', 'A conclusão.'], scenes: [{ texto: 'A conclusão.' }] };

test('aceita seleções independentes que omitem conteúdo secundário', () => {
  const result = validateScript(script, source);
  assert.deepEqual(result.slides, script.slides);
  assert.deepEqual(result.scenes, script.scenes);
  assert.equal(result.reelTitle, 'A conclusão.');
  assert.ok(!result.slides.join(' ').includes('secundário'));
});

test('texto de entrada longo não é limitado pela quantidade de slides', () => {
  const result = validateScript(script, source + ' Informação secundária.'.repeat(1500));
  assert.equal(result.slides.length, 2);
});

test('normaliza UTF-8 BOM e espaços, rejeita vazio e trechos inventados', () => {
  assert.equal(normalizeText('\uFEFFOlá\r\n mundo. '), 'Olá mundo.');
  assert.throws(() => normalizeText(' \n'), /vazio/);
  assert.throws(() => validateScript({ ...script, title: 'Conclusão inventada.' }, source), /literal/);
});

test('rejeita roteiros vazios, longos e sem as cenas esperadas', () => {
  for (const invalid of [null, {}, { ...script, slides: [] }, { ...script, slides: Array(8).fill(source) },
    { ...script, scenes: [] }, { ...script, scenes: ['texto'] }, { ...script, title: 'a'.repeat(101) }]) {
    assert.throws(() => validateScript(invalid, source));
  }
  const sentence = 'palavra '.repeat(17).trim();
  assert.throws(() => validateScript({ title: 'palavra', reelTitle: 'palavra', slides: [sentence], scenes: Array(8).fill({ texto: sentence }) }, sentence), /45 segundos/);
});

test('escapa HTML e usa a capa própria do reel', () => {
  const post = { ...script, title: '<script>alert("teste")</script>', reelTitle: 'Capa distinta', slides: ['<img src=x>'] };
  const html = carouselHtml(post, { serif: '' });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Capa distinta'));
});

test('valida direção visual e índices existentes', () => {
  assert.deepEqual(validateScript(script, source).visual, script.visual);
  for (const visual of [undefined, { ...script.visual, scene: 1 }, { ...script.visual, prompt: '' }]) assert.throws(() => validateScript({ ...script, visual }, source), /visual/);
});
test('imagem somente na capa do carrossel e na capa separada do reel', () => {
  const html = carouselHtml({ ...script, photo: { file: 'editorial.jpg' } }, { serif: '' });
  const carouselSections = html.split('<section').slice(1, -1);
  assert.ok(carouselSections[0].includes('<img class="photo"'));
  assert.ok(carouselSections.slice(1).every(s => !s.includes('<img')));
  assert.equal((html.match(/<img class="photo"/g) || []).length, 2);
});

test('valida e renderiza conclusão com complemento e slides com duas hierarquias', () => {
  const structured = { ...script, title: 'A conclusão.', coverText: 'A tese principal.',
    slides: [{ heading: 'A tese principal.', body: 'Um exemplo secundário.' }, { heading: 'A conclusão.', body: '' }] };
  const result = validateScript(structured, source);
  assert.equal(result.coverText, structured.coverText);
  assert.deepEqual(result.slides, structured.slides);
  const html = carouselHtml(result, { serif: '' });
  assert.ok(html.indexOf('class="heading"') < html.indexOf('class="support"'));
  assert.ok(html.includes('Um exemplo secundário.'));
  assert.throws(() => validateScript({ ...structured, coverText: 'Inventado.' }, source), /literal/);
  assert.throws(() => validateScript({ ...structured, slides: [{ heading: 'A conclusão.', body: 'Inventado.' }] }, source), /literal/);
});
