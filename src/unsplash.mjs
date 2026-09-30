import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withPhotoHistory } from './photo-history.mjs';
import { fileURLToPath } from 'node:url';

export function unsplashSource(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'unsplash.com' || !/^\/photos\/[^/]+\/?$/.test(url.pathname)) throw new Error('Informe o link da página da foto gratuita: https://unsplash.com/photos/...');
  return url.origin + url.pathname.replace(/\/$/, '');
}

// A seleção e o download são feitos na busca pública, conferindo a licença free.
export async function prepareUnsplashPhoto(post, out, { imagePath, imageUrl, slideIndex, description, historyFile = fileURLToPath(new URL('../out/.photo-history.json', import.meta.url)) } = {}) {
  if (slideIndex !== undefined && (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= (post.slides?.length ?? 0))) {
    throw new Error('Índice de slide interno inválido (0 = primeiro slide após a capa).');
  }
  const sourceUrl = unsplashSource(imageUrl);
  return withPhotoHistory(historyFile, async used => {
    if (used.has(new URL(sourceUrl).pathname)) throw new Error('Esta foto já foi usada. Escolha outra foto gratuita no Unsplash.');
    const bytes = await readFile(imagePath);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpeg) throw new Error('A foto deve ser PNG ou JPEG.');
    const stem = slideIndex === undefined ? 'editorial' : `slide-${String(slideIndex + 1).padStart(2, '0')}`;
    const file = `${stem}.${png ? 'png' : 'jpg'}`;
    await mkdir(join(out, 'fotos'), { recursive: true });
    await copyFile(imagePath, join(out, 'fotos', file));
    const photo = { file, sourceUrl, provider: 'unsplash', generated: false,
      ...(description ? { description } : {}) };
    if (slideIndex === undefined) {
      post.photo = photo;
      post.scenes.forEach(scene => { delete scene.foto; });
      post.scenes[post.visual.scene].foto = file;
    } else {
      const slide = post.slides[slideIndex];
      post.slides[slideIndex] = typeof slide === 'string' ? { heading: slide, body: '', photo } : { ...slide, photo };
    }
    const photos = [post.photo, ...(post.slides || []).map(s => s.photo)].filter(Boolean);
    await writeFile(join(out, 'fotos/licencas.json'), JSON.stringify(photos.length === 1 ? photos[0] : photos, null, 2));
    const sources = [...new Set(photos.map(p => p.sourceUrl))];
    await writeFile(join(out, 'creditos-fotos.txt'), `Crédito da imagem: ${sources.join(' ; ')}\n`);
    return photo;
  });
}
