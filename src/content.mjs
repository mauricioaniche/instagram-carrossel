export function normalizeText(input) {
  const text = input.replace(/^\uFEFF/u, '').replace(/\s+/gu, ' ').trim();
  if (!text) throw new Error('O arquivo .txt está vazio.');
  return text;
}

// O Codex faz a adaptação editorial. A validação é estrutural; fidelidade exige revisão do conteúdo.
export function validateScript(script, source) {
  const text = normalizeText(source);
  if (!script || typeof script !== 'object') throw new Error('O Codex não retornou um roteiro JSON.');
  const editorialText = (value, limit, name) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${name}: texto obrigatório.`);
    const normalized = normalizeText(value);
    if (normalized.length > limit) throw new Error(`${name}: limite de ${limit} caracteres excedido.`);
    return normalized;
  };
  const title = editorialText(script.title, 100, 'Capa do carrossel');
  const coverText = script.coverText ? editorialText(script.coverText, 160, 'Explicação da capa') : '';
  const reelTitle = editorialText(script.reelTitle, 100, 'Capa do reel');
  if (!Array.isArray(script.slides) || script.slides.length < 1 || script.slides.length > 19) throw new Error('O carrossel deve ter de 1 a 19 páginas de conteúdo, além da capa.');
  if (!Array.isArray(script.scenes) || script.scenes.length < 1 || script.scenes.length > 8) throw new Error('O reel deve ter de 1 a 8 cenas.');
  const slides = script.slides.map((s, i) => typeof s === 'string'
    ? editorialText(s, 220, `Slide ${i + 1}`)
    : { heading: editorialText(s?.heading, 140, `Título do slide ${i + 1}`),
        body: s?.body === '' ? '' : editorialText(s?.body, 320, `Explicação do slide ${i + 1}`) });
  const scenes = script.scenes.map((s, i) => ({ texto: editorialText(s?.texto, 140, `Cena ${i + 1}`) }));
  const seconds = scenes.reduce((total, s) => total + Math.round(Math.max(3.8, s.texto.split(/\s+/u).length / 3 + 1.6) * 30) / 30, 0);
  if (seconds > 45) throw new Error('O reel excede 45 segundos. Resuma o roteiro ou use menos cenas.');
  const v = script.visual;
  if (!v || typeof v.description !== 'string' || !v.description.trim() || v.description.length > 300 ||
      typeof v.prompt !== 'string' || v.prompt.trim().length < 30 || v.prompt.length > 1800 ||
      !Number.isInteger(v.scene) || v.scene < 0 || v.scene >= scenes.length) {
    throw new Error('Direção visual inválida: informe descrição, plano de busca e cena existente.');
  }
  const visual = { description: v.description.trim(), prompt: v.prompt.trim(), scene: v.scene };
  return { text, title, coverText, reelTitle, slides, scenes, visual };
}
