// Sober backgrounds and high-contrast text; stable when rerendering a post.
export const palettes = [
  { fundo: '#111315', texto: '#F5F5F2', acento: '#73B9B2' },
  { fundo: '#101C2D', texto: '#F3F5F7', acento: '#8FAECB' },
  { fundo: '#112923', texto: '#F1F5F2', acento: '#8AB8A6' },
];
export function paletteFor(text, index = 0) {
  let hash = 0;
  for (const c of text) hash = (Math.imul(hash, 31) + c.codePointAt(0)) >>> 0;
  return palettes[(hash + index) % palettes.length];
}
