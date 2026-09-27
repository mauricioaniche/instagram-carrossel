import { paletteFor } from './palette.mjs';
const escape = (text) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function carouselHtml(post, fonts) {
  const colors = i => { const p = paletteFor(post.title, i); return `--bg:${p.fundo};--ink:${p.texto};--accent:${p.acento}`; };
  const items = [{ heading: post.title, body: post.coverText || '' }, ...post.slides.map(s => typeof s === 'string' ? { heading: s, body: '' } : s)];
  const photo = post.photo ? `<img class="photo" src="fotos/${escape(post.photo.file)}" alt="${escape(post.visual.description)}"><div class="shade"></div>` : '';
  const illustrated = i => photo && i === 0;
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${escape(post.title)}</title>
<style>
@font-face{font-family:SourceSerif;src:url(data:font/woff2;base64,${fonts.serif});font-weight:700}
*{box-sizing:border-box}body{margin:0;background:#555}
.slide{width:1080px;height:1350px;position:relative;background:var(--bg);color:var(--ink);overflow:hidden;margin-bottom:30px}
.content{position:absolute;left:96px;right:96px;top:150px;bottom:150px;display:flex;flex-direction:column;justify-content:center}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1.08) brightness(1.05)}
.slide:not(.cover) .photo{height:58%}.slide:not(.cover) .shade{height:58%}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 25%,var(--bg) 90%)}
.illustrated{color:var(--ink)}.illustrated .content{bottom:120px;padding:40px;left:56px;right:56px;background:var(--bg);border-radius:24px;justify-content:flex-end;top:auto}.illustrated .content{max-height:850px}.illustrated .rule{margin-bottom:24px}
.cover.illustrated .content{top:auto;bottom:430px}.cover.illustrated p{font-size:90px}
.rule{width:90px;height:6px;background:var(--accent);margin-bottom:48px;flex-shrink:0}
h1,h2,p{font-family:SourceSerif,serif;line-height:1.18;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.heading{font-size:80px;line-height:1.12}.support{font-size:46px;line-height:1.3;margin-top:30px;font-family:Arial,sans-serif}.illustrated .heading{font-size:72px}.cover{height:1920px}.cover .content{top:420px;bottom:420px}
</style><body>${items.map((item, i) => `<section style="${colors(i)}" class="slide ${illustrated(i) ? 'dark illustrated' : i % 3 === 0 ? 'dark' : ''}">${illustrated(i) ? photo : ''}<div class="content"><div class="rule"></div><h2 class="heading" style="font-size:${item.heading.length > 100 ? 64 : 72}px">${escape(item.heading)}</h2>${item.body ? `<p class="support">${escape(item.body)}</p>` : ''}</div></section>`).join('')}
<section style="${colors(0)}" class="slide dark cover ${photo ? 'illustrated' : ''}">${photo}<div class="content"><div class="rule"></div><p style="font-size:96px">${escape(post.reelTitle)}</p></div></section></body></html>`;
}
