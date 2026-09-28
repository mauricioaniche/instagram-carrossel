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
export async function prepareUnsplashPhoto(post, out, { imagePath, imageUrl, historyFile = fileURLToPath(new URL('../out/.photo-history.json', import.meta.url)) } = {}) {
  const sourceUrl = unsplashSource(imageUrl);
  return withPhotoHistory(historyFile, async used => {
    if (used.has(new URL(sourceUrl).pathname)) throw new Error('Esta foto já foi usada. Escolha outra foto gratuita no Unsplash.');
    const bytes = await readFile(imagePath);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpeg) throw new Error('A foto deve ser PNG ou JPEG.');
    const file = png ? 'editorial.png' : 'editorial.jpg';
    await mkdir(join(out, 'fotos'), { recursive: true });
    await copyFile(imagePath, join(out, 'fotos', file));
    post.photo = { file, sourceUrl, provider: 'unsplash', generated: false };
    post.scenes.forEach(scene => { delete scene.foto; });
    post.scenes[post.visual.scene].foto = file;
    await writeFile(join(out, 'fotos/licencas.json'), JSON.stringify(post.photo, null, 2));
    await writeFile(join(out, 'creditos-fotos.txt'), `Crédito da imagem: ${sourceUrl}\n`);
    return post.photo;
  });
}
