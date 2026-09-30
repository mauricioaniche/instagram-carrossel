import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {prepareUnsplashPhoto,unsplashSource} from './unsplash.mjs';

test('aceita página individual e rejeita busca, domínio externo e protocolo inseguro',()=>{
 assert.equal(unsplashSource('https://unsplash.com/photos/photo-123?x=1'),'https://unsplash.com/photos/photo-123');
 for(const url of ['https://unsplash.com/s/photos/programming?license=free','https://example.com/photos/a','http://unsplash.com/photos/a'])assert.throws(()=>unsplashSource(url));
});
test('salva crédito sem revisão por IA e impede reutilização da foto',async()=>{
 const dir=await mkdtemp('/tmp/unsplash-test-');
 try{
 const imagePath=dir+'/photo.jpg';await writeFile(imagePath,Buffer.from([255,216,255,0]));
 const post={visual:{description:'Teste',scene:0},scenes:[{}]};
 const options={imagePath,imageUrl:'https://unsplash.com/photos/photo-123',historyFile:dir+'/history.json',review:async()=>{throw new Error('Não deve chamar revisão por IA');}};
 await prepareUnsplashPhoto(post,dir,options);
 assert.equal(await readFile(dir+'/creditos-fotos.txt','utf8'),'Crédito da imagem: https://unsplash.com/photos/photo-123\n');
 assert.equal(post.photo.generated,false);
 await assert.rejects(prepareUnsplashPhoto(post,dir,options),/já foi usada/);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('foto interna preserva texto e reel, reúne créditos e é recuperada pelo histórico', async () => {
 const dir = await mkdtemp('/tmp/unsplash-slides-test-');
 try {
  const imagePath = dir + '/photo.jpg';
  await writeFile(imagePath, Buffer.from([255,216,255,0]));
  const post = { visual: { scene: 0 }, scenes: [{texto:'Cena aprovada'}], slides: [{heading:'Título aprovado',body:'Apoio aprovado'}] };
  const options = { imagePath, historyFile: dir + '/history.json' };
  await prepareUnsplashPhoto(post, dir, {...options,imageUrl:'https://unsplash.com/photos/cover'});
  const scenes = structuredClone(post.scenes);
  await prepareUnsplashPhoto(post, dir, {...options,imageUrl:'https://unsplash.com/photos/inside',slideIndex:0,description:'Foto contextual'});
  assert.deepEqual(post.scenes, scenes);
  assert.equal(post.photo.file, 'editorial.jpg');
  assert.equal(post.slides[0].heading, 'Título aprovado');
  assert.equal(post.slides[0].body, 'Apoio aprovado');
  assert.equal(post.slides[0].photo.file, 'slide-01.jpg');
  assert.equal(post.slides[0].photo.description, 'Foto contextual');
  const licenses = JSON.parse(await readFile(dir + '/fotos/licencas.json', 'utf8'));
  assert.equal(licenses.length, 2);
  assert.equal(await readFile(dir + '/creditos-fotos.txt','utf8'), 'Crédito da imagem: https://unsplash.com/photos/cover ; https://unsplash.com/photos/inside\n');
  // Rebuild history from license files, including the newly supported array format.
  await rm(options.historyFile);
  await assert.rejects(prepareUnsplashPhoto(post, dir, {...options,imageUrl:'https://unsplash.com/photos/inside',slideIndex:0}), /já foi usada/);
  await assert.rejects(prepareUnsplashPhoto(post, dir, {...options,imageUrl:'https://unsplash.com/photos/new',slideIndex:1}), /Índice/);
 } finally { await rm(dir, {recursive:true,force:true}); }
});
