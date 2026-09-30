import { readFile } from 'node:fs/promises';

// Embedded fonts keep HTML previews and PNG rendering identical and offline.
export async function loadCarouselFonts() {
  const files = {
    regular: 'source-serif-4/files/source-serif-4-latin-400-normal.woff2',
    bold: 'source-serif-4/files/source-serif-4-latin-700-normal.woff2',
    italic: 'source-serif-4/files/source-serif-4-latin-400-italic.woff2',
    ui: 'inter/files/inter-latin-400-normal.woff2',
  };
  return Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) =>
    [key, (await readFile(new URL(`../node_modules/@fontsource/${file}`, import.meta.url))).toString('base64')])));
}
