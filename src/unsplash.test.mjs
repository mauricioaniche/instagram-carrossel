import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {prepareUnsplashPhoto,unsplashSource} from './unsplash.mjs';

test('aceita página individual e rejeita busca, domínio externo e protocolo inseguro',()=>{
 assert.equal(unsplashSource('https://unsplash.com/photos/photo-123?x=1'),'https://unsplash.com/photos/photo-123');
 for(const url of ['https://unsplash.com/s/photos/programming?license=free','https://example.com/photos/a','http://unsplash.com/photos/a'])assert.throws(()=>unsplashSource(url));
});
test('revisão aprovada salva crédito e impede reutilização da foto',async()=>{
 const dir=await mkdtemp('/tmp/unsplash-test-');
 try{
 const imagePath=dir+'/photo.jpg';await writeFile(imagePath,Buffer.from([255,216,255,0]));
 const post={visual:{description:'Teste',scene:0},scenes:[{}]};
 const options={imagePath,imageUrl:'https://unsplash.com/photos/photo-123',historyFile:dir+'/history.json',review:async()=>({approved:true,relevance:9,quality:9,clean:9,modern:9,reason:'Aprovada',queries:[]})};
 await prepareUnsplashPhoto(post,dir,options);
 assert.equal(await readFile(dir+'/creditos-fotos.txt','utf8'),'Crédito da imagem: https://unsplash.com/photos/photo-123\n');
 assert.equal(post.photo.generated,false);
 await assert.rejects(prepareUnsplashPhoto(post,dir,options),/já foi usada/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
