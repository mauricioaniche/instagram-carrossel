import { mkdir, writeFile, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { reviewPhoto, validatePhotoReview } from './photo-review.mjs';
import { shuffledUnused, withPhotoHistory } from './photo-history.mjs';

const agent = 'VoapostInstagramGenerator/1.0 (https://github.com/devalura/voapost)';
const plain = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function licensedPhoto(page) {
  const info = page.imageinfo?.[0];
  const m = info?.extmetadata || {};
  const license = plain(m.LicenseShortName?.value);
  if (!/^(Public domain|CC0(?: 1\.0)?|CC BY(?:-SA)? \d\.\d)$/i.test(license)) return null;
  if (!info || Math.min(info.width, info.height) < 1080 || !['image/jpeg', 'image/png'].includes(info.mime)) return null;
  const author = plain(m.Artist?.value);
  if (!author || !info.descriptionurl || !info.url) return null;
  return { title: page.title, author, license, licenseUrl: m.LicenseUrl?.value || '',
    sourceUrl: info.descriptionurl, originalUrl: info.url, downloadUrl: info.thumburl || info.url,
    mime: info.mime, width: info.width, height: info.height };
}

async function request(url, fetchImpl) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['commons.wikimedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org'].includes(parsed.hostname)) throw new Error('URL de foto fora da Wikimedia.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(url, { headers: { 'User-Agent': agent }, signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (response.ok) return response;
    if (![429, 502, 503, 504].includes(response.status) || attempt === 2) throw new Error(`Wikimedia retornou HTTP ${response.status}.`);
    await sleep(3000 * (attempt + 1));
  }
}

export async function preparePhoto(post, out, { fetchImpl = fetch, pause = sleep, historyFile = fileURLToPath(new URL('../out/.photo-history.json', import.meta.url)), evaluate = reviewPhoto, source, binary, model, maxRounds = 3, candidatesPerRound = 4 } = {}) {
  return withPhotoHistory(historyFile, used => selectPhoto(post, out, { fetchImpl, pause, used, evaluate, source, binary, model, maxRounds, candidatesPerRound }));
}
async function selectPhoto(post, out, { fetchImpl, pause, used, evaluate, source, binary, model, maxRounds, candidatesPerRound }) {
  const errors = [], reviews = [], attempted = new Set(used), searched = new Set();
  let queries = post.visual.queries;
  const temp = await mkdtemp(join(tmpdir(), 'ig-candidates-'));
  await mkdir(out, { recursive: true });
  try {
    for (let round = 0; round < maxRounds; round++) {
      const pool = [], suggestions = [];
      for (const query of queries.filter(q => !searched.has(q)).slice(0,3)) {
        searched.add(query);
        await pause(2500);
        try {
          const url = new URL('https://commons.wikimedia.org/w/api.php');
          url.search = new URLSearchParams({ action:'query',format:'json',generator:'search',gsrnamespace:'6',
            gsrsearch:`${query.replace(/\bpair programming\b/gi, '\"pair programming\"')} filetype:bitmap -intitle:logo -intitle:collage -intitle:screenshot -intitle:historic -intitle:museum`,gsrlimit:'20',
            prop:'imageinfo',iiprop:'url|extmetadata|size|mime',iiurlwidth:'1600' });
          const data = await (await request(url.href,fetchImpl)).json();
          if(data.error) throw new Error(data.error.info || 'Busca indisponível.');
          pool.push(...Object.values(data.query?.pages || {}).sort((a,b)=>a.index-b.index).map(licensedPhoto).filter(Boolean).filter(p=>!attempted.has(new URL(p.sourceUrl).pathname)).slice(0,6).map(p=>({...p,query})));
        } catch(e) { errors.push(e.message); }
      }
      // Balance the searches: a noisy query must not crowd out a precise one.
      const groups = [...new Set(pool.map(p=>p.query))].map(query=>shuffledUnused(pool.filter(p=>p.query===query),attempted));
      const balanced=[];const seen=new Set();
      for(let rank=0;rank<6;rank++)for(const group of groups){const candidate=group[rank];if(candidate&&!seen.has(candidate.sourceUrl)){seen.add(candidate.sourceUrl);balanced.push(candidate);}}
      for (const candidate of balanced.slice(0,candidatesPerRound)) {
        attempted.add(new URL(candidate.sourceUrl).pathname);
        let imagePath, mime;
        try {
          await pause(2500);
          const response=await request(candidate.downloadUrl,fetchImpl);
          mime=response.headers.get('content-type')?.split(';')[0];
          if(!['image/jpeg','image/png'].includes(mime))throw new Error('Download não retornou JPEG/PNG.');
          if(Number(response.headers.get('content-length'))>25000000)throw new Error('Foto excede 25 MB.');
          const chunks=[];let size=0;
          for await(const chunk of response.body){size+=chunk.length;if(size>25000000)throw new Error('Foto excede 25 MB.');chunks.push(chunk);}
          imagePath=join(temp,mime==='image/png'?'candidate.png':'candidate.jpg');
          await writeFile(imagePath,Buffer.concat(chunks));
        } catch(e) { errors.push(e.message); continue; }
        // Fail closed if the AI is unavailable or returns an invalid response.
        const review=validatePhotoReview(await evaluate({imagePath,post,source,candidate},{binary,model}));
        reviews.push({round:round+1,sourceUrl:candidate.sourceUrl,title:candidate.title,...review});
        await writeFile(join(out,'avaliacoes-fotos.json'),JSON.stringify(reviews,null,2));
        console.log(`Foto ${review.approved?'aprovada':'rejeitada'}: ${candidate.title} — ${review.reason}`);
        if(!review.approved){suggestions.push(...review.queries);continue;}
        const file=mime==='image/png'?'editorial.png':'editorial.jpg';
        await mkdir(join(out,'fotos'),{recursive:true});
        await copyFile(imagePath,join(out,'fotos',file));
        const photo={...candidate,description:post.visual.description,file,mime,review};
        await writeFile(join(out,'fotos','licencas.json'),JSON.stringify(photo,null,2));
        await writeFile(join(out,'creditos-fotos.txt'),`Foto: ${photo.title} — ${photo.author}. ${photo.license}.\n${photo.sourceUrl}\n${photo.licenseUrl}\nTratamento: ajuste de cor e luminosidade, recorte e zoom.\nInclua estes créditos na legenda ao publicar.\n`);
        post.photo=photo;post.scenes[post.visual.scene].foto=file;
        return photo;
      }
      queries=[...new Set(suggestions)].filter(q=>!searched.has(q));
      if(!queries.length)break;
    }
    throw new Error(`Não foi possível obter uma foto relevante, limpa, moderna e de qualidade aprovada pela IA. Nenhuma mídia sem foto será renderizada. ${errors.slice(-3).join(' ')}`);
  } finally { await rm(temp,{recursive:true,force:true}); }
}
