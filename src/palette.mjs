// Light backgrounds, dark ink, stable colors when rerendering a post.
export const palettes = [
  { fundo: '#FFF0D6', texto: '#332513', acento: '#A44616' },
  { fundo: '#DDF3EE', texto: '#123E38', acento: '#087C70' },
  { fundo: '#E5EDFF', texto: '#22345A', acento: '#355BBC' },
  { fundo: '#F6E3EE', texto: '#52233E', acento: '#A82E70' },
  { fundo: '#EEE6FF', texto: '#392555', acento: '#7550B5' },
  { fundo: '#F1F3CB', texto: '#353C17', acento: '#627521' },
];
export function paletteFor(text, index = 0) {
  let hash = 0;
  for (const c of text) hash = (Math.imul(hash, 31) + c.codePointAt(0)) >>> 0;
  return palettes[(hash + index) % palettes.length];
}
