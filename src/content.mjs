export function normalizeText(input) {
  const text = input.replace(/^\uFEFF/u, '').replace(/\s+/gu, ' ').trim();
  if (!text) throw new Error('O arquivo .txt está vazio.');
  return text;
}

// A seleção é feita pelo Codex. Aqui só validamos o roteiro antes de renderizar.
export function validateScript(script, source) {
  const text = normalizeText(source);
  if (!script || typeof script !== 'object') throw new Error('O Codex não retornou um roteiro JSON.');
  const excerpt = (value, limit, name) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${name}: texto obrigatório.`);
    const normalized = normalizeText(value);
    if (normalized.length > limit) throw new Error(`${name}: limite de ${limit} caracteres excedido.`);
    if (!text.includes(normalized)) throw new Error(`${name}: use um trecho literal do post, sem inventar ou reescrever.`);
    return normalized;
  };
  const title = excerpt(script.title, 100, 'Capa do carrossel');
  const coverText = script.coverText ? excerpt(script.coverText, 160, 'Explicação da capa') : '';
  const reelTitle = excerpt(script.reelTitle, 100, 'Capa do reel');
  if (!Array.isArray(script.slides) || script.slides.length < 1 || script.slides.length > 7) throw new Error('O carrossel deve ter de 1 a 7 páginas de conteúdo, além da capa.');
  if (!Array.isArray(script.scenes) || script.scenes.length < 1 || script.scenes.length > 8) throw new Error('O reel deve ter de 1 a 8 cenas.');
  const slides = script.slides.map((s, i) => typeof s === 'string'
    ? excerpt(s, 220, `Slide ${i + 1}`)
    : { heading: excerpt(s?.heading, 100, `Título do slide ${i + 1}`),
        body: s?.body === '' ? '' : excerpt(s?.body, 220, `Explicação do slide ${i + 1}`) });
  const scenes = script.scenes.map((s, i) => ({ texto: excerpt(s?.texto, 140, `Cena ${i + 1}`) }));
  const seconds = scenes.reduce((total, s) => total + Math.round(Math.max(3.8, s.texto.split(/\s+/u).length / 3 + 1.6) * 30) / 30, 0);
  if (seconds > 45) throw new Error('O reel excede 45 segundos. Selecione menos trechos.');
  const v = script.visual;
  if (!v || typeof v.description !== 'string' || !v.description.trim() || v.description.length > 300 ||
      typeof v.prompt !== 'string' || v.prompt.trim().length < 30 || v.prompt.length > 1800 ||
      !Number.isInteger(v.scene) || v.scene < 0 || v.scene >= scenes.length) {
    throw new Error('Direção visual inválida: informe descrição, prompt de geração e cena existente.');
  }
  const visual = { description: v.description.trim(), prompt: v.prompt.trim(), scene: v.scene };
  return { text, title, coverText, reelTitle, slides, scenes, visual };
}
