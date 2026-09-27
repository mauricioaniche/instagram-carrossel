import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { licensedPhoto, preparePhoto } from './photos.mjs';
const goodReview = { approved:true,reason:'Foto relevante e moderna.',relevance:9,quality:9,clean:9,modern:9,queries:[] };
const page = { title: 'File:Computer.jpg', index: 1, imageinfo: [{ width: 2400, height: 1800, mime: 'image/jpeg', url: 'https://upload.wikimedia.org/photo.jpg', thumburl: 'https://thumb.wikimedia.org/photo.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Computer.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a>Author</a>' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } } }] };
test('rejeita licença não comercial, falta de autoria e baixa resolução', () => {
  assert.equal(licensedPhoto(page).author, 'Author');
  for (const change of [{ width: 500 }, { extmetadata: { ...page.imageinfo[0].extmetadata, LicenseShortName: { value: 'CC BY-NC 4.0' } } }, { extmetadata: {} }]) assert.equal(licensedPhoto({ ...page, imageinfo: [{ ...page.imageinfo[0], ...change }] }), null);
});
test('baixa, registra créditos e conecta cena; falha sem foto', async t => {
  const out = await mkdtemp(join(tmpdir(), 'ig-photo-test-')); t.after(() => rm(out, { recursive: true, force: true }));
  const post = { visual: { queries: ['computer room', 'historic computer'], description: 'Computação', slide: 0, scene: 1 }, scenes: [{ texto: 'A' }, { texto: 'B' }] };
  const fetchImpl = async url => url.includes('w/api.php') ? Response.json({ query: { pages: { 1: page } } }) : new Response(new Uint8Array([255, 216, 255]), { headers: { 'content-type': 'image/jpeg' } });
  await preparePhoto(post, out, { evaluate:async()=>goodReview,fetchImpl, historyFile: join(out, '.history.json'), pause: async () => {} });
  assert.equal(post.scenes[1].foto, 'editorial.jpg'); assert.equal(post.scenes[0].foto, undefined);
  assert.match(await readFile(join(out, 'creditos-fotos.txt'), 'utf8'), /Author.*CC BY-SA/);
  await assert.rejects(preparePhoto(post, out, { fetchImpl: async () => Response.json({}), historyFile: join(out, '.empty-history.json'), pause: async () => {} }), /Nenhuma mídia sem foto/);
});

test('embaralha candidatos, deduplica e exclui histórico', async () => {
  const { shuffledUnused, photoKey } = await import('./photo-history.mjs');
  const a = { sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg' };
  const b = { sourceUrl: 'https://commons.wikimedia.org/wiki/File:B.jpg' };
  const c = { sourceUrl: 'https://commons.wikimedia.org/wiki/File:C.jpg' };
  assert.deepEqual(shuffledUnused([a,a,b,c], new Set([photoKey(a)]), () => 0), [c,b]);
});
test('histórico persiste entre execuções e reserva fotos sem repetição', async t => {
  const { withPhotoHistory, photoKey } = await import('./photo-history.mjs');
  const out = await mkdtemp(join(tmpdir(), 'ig-history-'));t.after(() => rm(out,{recursive:true,force:true}));
  const file=join(out,'.history.json');const a={sourceUrl:'https://commons.wikimedia.org/wiki/File:A.jpg'};
  await withPhotoHistory(file,async used=>{assert.equal(used.size,0);return a;});
  await withPhotoHistory(file,async used=>{assert.ok(used.has(photoKey(a)));return {sourceUrl:'https://commons.wikimedia.org/wiki/File:B.jpg'};});
});

test('imagem reprovada provoca nova busca; apenas a aprovada entra no histórico', async t => {
 const out=await mkdtemp(join(tmpdir(),'ig-review-'));t.after(()=>rm(out,{recursive:true,force:true}));
 const post={title:'Revisão de código',slides:[],visual:{queries:['old computer'],description:'Revisão',scene:0},scenes:[{texto:'Teste'}]};
 const second={...page,title:'File:Team.jpg',imageinfo:[{...page.imageinfo[0],descriptionurl:'https://commons.wikimedia.org/wiki/File:Team.jpg'}]};
 const searches=[];let reviewed=0;
 const fetchImpl=async url=>{if(url.includes('w/api.php')){searches.push(url);return Response.json({query:{pages:{1:url.includes('modern')?second:page}}});}return new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}});};
 await preparePhoto(post,out,{fetchImpl,pause:async()=>{},historyFile:join(out,'.history.json'),source:'Texto integral',evaluate:async ({source})=>{assert.equal(source,'Texto integral');reviewed++;return reviewed===1?{...goodReview,approved:false,reason:'Hardware antigo.',modern:2,queries:['modern team']}:goodReview;}});
 assert.equal(reviewed,2);assert.equal(searches.length,2);assert.equal(post.photo.title,'File:Team.jpg');
 assert.deepEqual(JSON.parse(await readFile(join(out,'.history.json'),'utf8')),['/wiki/File:Team.jpg']);
 assert.equal(JSON.parse(await readFile(join(out,'avaliacoes-fotos.json'),'utf8'))[0].approved,false);
});
test('falha de IA e notas baixas nunca aprovam uma foto', async t=>{
 const {validatePhotoReview}=await import('./photo-review.mjs');
 assert.equal(validatePhotoReview({...goodReview,relevance:3}).approved,false);
 assert.throws(()=>validatePhotoReview({...goodReview,quality:'9'}));
 const out=await mkdtemp(join(tmpdir(),'ig-fail-review-'));t.after(()=>rm(out,{recursive:true,force:true}));
 const post={visual:{queries:['computer'],scene:0},scenes:[{}]};
 const fetchImpl=async url=>url.includes('w/api.php')?Response.json({query:{pages:{1:page}}}):new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}});
 await assert.rejects(preparePhoto(post,out,{fetchImpl,pause:async()=>{},historyFile:join(out,'.history.json'),evaluate:async()=>{throw Error('AI unavailable');}}),/AI unavailable/);
 assert.equal(post.photo,undefined);
});
test('uma busca ruidosa não ocupa todas as vagas da avaliação visual', async t=>{
 const out=await mkdtemp(join(tmpdir(),'ig-balanced-'));t.after(()=>rm(out,{recursive:true,force:true}));
 const post={visual:{queries:['noisy','precise'],scene:0},scenes:[{}]};
 const makePage=n=>({...page,title:`File:Photo${n}.jpg`,index:n,imageinfo:[{...page.imageinfo[0],descriptionurl:`https://commons.wikimedia.org/wiki/File:Photo${n}.jpg`}]});
 const fetchImpl=async url=>url.includes('w/api.php')?Response.json({query:{pages:Object.fromEntries((url.includes('precise')?[9]:[1,2,3,4,5,6]).map(n=>[n,makePage(n)]))}}):new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}});
 const queries=[];
 await preparePhoto(post,out,{fetchImpl,pause:async()=>{},maxRounds:1,candidatesPerRound:2,historyFile:join(out,'.history.json'),evaluate:async ({candidate})=>{queries.push(candidate.query);return {...goodReview,approved:candidate.query==='precise'};}});
 assert.deepEqual(queries,['noisy','precise']);assert.equal(post.photo.title,'File:Photo9.jpg');
});
