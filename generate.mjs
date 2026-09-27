#!/usr/bin/env node
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm, rename } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { normalizeText } from './src/content.mjs';
import { generateScript } from './src/codex.mjs';
import { prepareUnsplashPhoto } from './src/unsplash.mjs';
import { paletteFor } from './src/palette.mjs';
import { carouselHtml } from './src/carousel.mjs';
import { selectMusic, prepareMusic } from './src/music.mjs';

const root = dirname(fileURLToPath(import.meta.url));

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    model: { type: 'string' }, codex: { type: 'string' }, 'plan-only': { type: 'boolean' },
    image: { type: 'string' }, 'image-url': { type: 'string' }, music: { type: 'string' }, browser: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('Uso: node generate.mjs post.txt [--out pasta-nova] [--browser /caminho/chrome] [--model modelo] [--codex /caminho/codex] [--plan-only] [--image foto.jpg --image-url https://unsplash.com/photos/...] [--music nome.mp3]\nGera carrossel/*.png, reel.mp4 com música de music/, capa-reel.png, carrossel.html, roteiro.json e musica.json.');
    return;
  }
  if (positionals.length !== 1 || extname(positionals[0]).toLowerCase() !== '.txt') throw new Error('Informe exatamente um arquivo .txt. Use --help para ver o uso.');
  if (!values['plan-only'] && (!values.image || !values['image-url'])) throw new Error('Escolha uma foto gratuita no Unsplash e informe --image foto.jpg e --image-url https://unsplash.com/photos/... .');
  const input = resolve(positionals[0]);
  const source = normalizeText(await readFile(input, 'utf8'));
  const music = values['plan-only'] ? null : await selectMusic(join(root, 'music'), values.music);
  const codexBinary = values.codex?.includes('/') || values.codex?.includes('\\') ? resolve(values.codex) : values.codex;
  const outParent = values.out ? dirname(resolve(values.out)) : join(root, 'out');
  await mkdir(outParent, { recursive: true });
  const out = values.out ? resolve(values.out) : join(outParent, `${basename(input, extname(input))}-${Date.now()}`);
  // Reserva exclusiva: uma execução nunca substitui arquivos existentes.
  await mkdir(out);
  const temp = await mkdtemp(join(tmpdir(), 'instagram-generator-'));
  let browser;
  try {
    console.log('Selecionando os pontos principais com o Codex…');
    const post = await generateScript(source, { temp, out, binary: codexBinary, model: values.model });
    await writeFile(join(out, 'roteiro.json'), JSON.stringify(post, null, 2));
    if (values['plan-only']) {
      console.log(`Roteiro gerado: ${join(out, 'roteiro.json')}`);
      return;
    }
    console.log('Conferindo a foto do Unsplash e sua relação com o post…');
    await prepareUnsplashPhoto(post, out, { source, binary: codexBinary, model: values.model, imagePath: resolve(values.image), imageUrl: values['image-url'] });
    await writeFile(join(out, 'roteiro.json'), JSON.stringify(post, null, 2));
    const publicDir = join(temp, 'public');
    const audioProps = await prepareMusic(music, publicDir, out);
    await mkdir(join(publicDir, 'fotos'), { recursive: true });
    await copyFile(join(out, 'fotos', post.photo.file), join(publicDir, 'fotos', post.photo.file));
    const fontsDir = join(publicDir, 'fonts');
    await mkdir(fontsDir, { recursive: true });
    for (const [dest, pkg, source] of [
      ['anton-400', 'anton', 'anton-latin-400-normal'],
      ['inter-400', 'inter', 'inter-latin-400-normal'],
      ['inter-700', 'inter', 'inter-latin-700-normal'],
      ['ss-400', 'source-serif-4', 'source-serif-4-latin-400-normal'],
      ['ss-400i', 'source-serif-4', 'source-serif-4-latin-400-italic'],
      ['ss-700', 'source-serif-4', 'source-serif-4-latin-700-normal'],
      ['inter-500', 'inter', 'inter-latin-500-normal'],
      ['inter-600', 'inter', 'inter-latin-600-normal'],
    ]) await copyFile(join(root, 'node_modules', '@fontsource', pkg, 'files', `${source}.woff2`), join(fontsDir, `${dest}.woff2`));
    const fonts = {
      display: (await readFile(join(fontsDir, 'anton-400.woff2'))).toString('base64'),
      regular: (await readFile(join(fontsDir, 'inter-400.woff2'))).toString('base64'),
      bold: (await readFile(join(fontsDir, 'inter-700.woff2'))).toString('base64'),
    };
    const html = join(out, 'carrossel.html');
    await writeFile(html, carouselHtml(post, fonts));
    const { chromium } = await import('playwright');
    const browserExecutable = values.browser ? resolve(values.browser) : [
      chromium.executablePath(),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ].find(path => existsSync(path));
    if (!browserExecutable || !existsSync(browserExecutable)) throw new Error('Navegador não encontrado. Execute npm run setup ou informe --browser /caminho/chrome.');
    browser = await chromium.launch({ executablePath: browserExecutable });
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(html).href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
    });
    const overflow = await page.locator('.content').evaluateAll(nodes => nodes.some(n => n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth));
    if (overflow) throw new Error('O roteiro ultrapassa a área disponível. Distribua o desenvolvimento em mais slides ou resuma a explicação, preservando as ideias e a legibilidade.');
    await mkdir(join(out, 'carrossel'));
    const slides = page.locator('.slide:not(.cover)');
    for (let i = 0; i < await slides.count(); i++) await slides.nth(i).screenshot({ path: join(out, 'carrossel', `${String(i + 1).padStart(2, '0')}.png`) });
    await page.locator('.cover').screenshot({ path: join(out, 'capa-reel.png') });
    await browser.close();
    browser = undefined;
    console.log(`Carrossel: ${post.slides.length + 1} slides. Renderizando ${post.scenes.length} cenas do reel…`);
    const { bundle } = await import('@remotion/bundler');
    const { selectComposition, renderMedia } = await import('@remotion/renderer');
    const serveUrl = await bundle({ entryPoint: join(root, 'src/index.tsx'), publicDir, outDir: join(temp, 'bundle') });
    const inputProps = { cenas: post.scenes, paleta: paletteFor(post.scenes[0]?.texto ?? ''), ...audioProps };
    const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps, browserExecutable, chromeMode: 'chrome-for-testing' });
    await renderMedia({ serveUrl, composition, inputProps, browserExecutable, chromeMode: 'chrome-for-testing', codec: 'h264', pixelFormat: 'yuv420p', outputLocation: join(out, 'reel.partial.mp4'), concurrency: 2 });
    await rename(join(out, 'reel.partial.mp4'), join(out, 'reel.mp4'));
    console.log(`Concluído: ${out}\nReel: ${(composition.durationInFrames / composition.fps).toFixed(1)} segundos. Música: ${music.file}.`);
  } catch (error) {
    throw new Error(`${error.message}\nSaída incompleta em: ${out}`, { cause: error });
  } finally {
    if (browser) await browser.close();
    await rm(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(`Erro: ${error.message}`); process.exitCode = 1; });
