// Sober editorial tones, selected explicitly for each page.
export const palettes = [
  { fundo: '#F3EFE5', texto: '#191814', acento: '#A54B38' },
  { fundo: '#191814', texto: '#F3EFE5', acento: '#D1B894' },
  { fundo: '#172A3A', texto: '#F3EFE5', acento: '#D1B894' },
  { fundo: '#25282B', texto: '#F3EFE5', acento: '#D1B894' },
  { fundo: '#203B3B', texto: '#F3EFE5', acento: '#D1B894' },
];
export function paletteFor(_text, _index = 0, theme = 'light') {
  const themes = { light: 0, dark: 1, navy: 2, slate: 3, petrol: 4 };
  return palettes[themes[theme] ?? 0];
}
