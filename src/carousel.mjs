import { paletteFor } from './palette.mjs';
const escape = (text) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function carouselHtml(post, fonts) {
  const colors = theme => { const p = paletteFor(post.title, 0, theme); return `--bg:${p.fundo};--ink:${p.texto};--accent:${p.acento}`; };
  const items = [{ heading: post.title, body: post.coverText || '', photo: post.photo }, ...post.slides.map(s => typeof s === 'string' ? { heading: s, body: '' } : s)];
  const photo = p => p ? `<img class="photo" src="fotos/${escape(p.file)}" alt="${escape(p.description || post.visual?.description || '')}">` : '';
  const headingSize = (item, cover) => cover ? (item.heading.length > 65 ? 100 : item.heading.length > 35 ? 112 : 128) : (item.body || item.heading.length > 100 ? 72 : item.heading.length > 65 ? 84 : 96);
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${escape(post.title)}</title>
<style>
@font-face{font-family:SourceSerif;src:url(data:font/woff2;base64,${fonts.regular});font-weight:400}
@font-face{font-family:SourceSerif;src:url(data:font/woff2;base64,${fonts.bold});font-weight:700}
@font-face{font-family:SourceSerif;src:url(data:font/woff2;base64,${fonts.italic || fonts.regular});font-weight:400;font-style:italic}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${fonts.ui || ''});font-weight:400}
*{box-sizing:border-box}body{margin:0;background:#555}
.slide{width:1080px;height:1350px;position:relative;background:var(--bg);color:var(--ink);overflow:hidden;margin-bottom:30px}
.content{position:absolute;left:96px;right:96px;top:150px;bottom:96px;padding-bottom:24px;display:flex;flex-direction:column;justify-content:flex-start}
.content>*{flex-shrink:0}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1)}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08) 15%,rgba(0,0,0,.65) 52%,rgba(0,0,0,.94) 100%)}
.illustrated{color:#F3EFE5}.illustrated .content{top:auto;bottom:96px;max-height:1158px;justify-content:flex-end}.illustrated .rule{background:#D1B894}
.photo-slide .photo{height:400px}.photo-slide .content{top:464px}
.rule{width:90px;height:5px;background:var(--accent);margin-bottom:48px;flex-shrink:0}
h1,h2,p{font-family:SourceSerif,Georgia,serif;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.heading{font-weight:700;line-height:1.08;letter-spacing:-.02em;text-wrap:pretty}
.support{font-size:48px;font-weight:400;line-height:1.3;margin-top:52px}
.dense .support{font-size:44px}.opening .support{font-size:48px;margin-top:36px}
.cover{height:1920px}.cover .content{top:420px;bottom:420px}.cover.illustrated .content{top:auto;bottom:420px;max-height:1080px}
</style><body>${items.map((item, i) => {
    const isCover = i === 0;
    const classes = ['slide', isCover ? 'opening' : '', item.photo ? (isCover ? 'illustrated' : 'photo-slide') : '', item.body?.length > 240 ? 'dense' : ''].filter(Boolean).join(' ');
    return `<section style="${colors(item.theme || post.theme)}" class="${classes}">${photo(item.photo)}${isCover && item.photo ? '<div class="shade"></div>' : ''}<div class="content"><div class="rule"></div><h2 class="heading" style="font-size:${headingSize(item, isCover)}px">${escape(item.heading)}</h2>${item.body ? `<p class="support">${escape(item.body)}</p>` : ''}</div></section>`;
  }).join('')}
<section style="${colors(post.theme)}" class="slide cover ${post.photo ? 'illustrated' : ''}">${photo(post.photo)}${post.photo ? '<div class="shade"></div>' : ''}<div class="content"><div class="rule"></div><p class="heading" style="font-size:${headingSize({ heading: post.reelTitle }, true)}px">${escape(post.reelTitle)}</p></div></section></body></html>`;
}
