import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generatePng,prepareGeneratedImage} from './generated-image.mjs';
const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(1024,16);png.writeUInt32BE(1536,20);
const post=()=>({title:'Teste',visual:{description:'Programação',prompt:'A modern clean software development workspace.',scene:1},scenes:[{texto:'A',foto:'old.jpg'},{texto:'B'}]});
test('reprovação gera outra imagem com correção e remove referências antigas',async t=>{
 const out=await mkdtemp(join(tmpdir(),'ig-generated-test-'));t.after(()=>rm(out,{recursive:true,force:true}));const p=post();let attempts=0;const prompts=[];
 await prepareGeneratedImage(p,out,{generate:async prompt=>{prompts.push(prompt);return png},review:async()=>({approved:++attempts===2,reason:'Remove the obsolete computer.'})});
 assert.equal(attempts,2);assert.match(prompts[1],/Remove the obsolete computer/);assert.equal(p.scenes[0].foto,undefined);assert.equal(p.scenes[1].foto,'editorial.png');assert.ok(p.photo.generated);assert.equal(JSON.parse(await readFile(join(out,'avaliacoes-imagens.json'),'utf8')).length,2);
});
test('falha na revisão não aceita a imagem nem tenta novamente silenciosamente',async t=>{
 const out=await mkdtemp(join(tmpdir(),'ig-generated-test-'));t.after(()=>rm(out,{recursive:true,force:true}));const p=post();let calls=0;
 await assert.rejects(prepareGeneratedImage(p,out,{generate:async()=>{calls++;return png},review:async()=>{throw Error('review unavailable')}}),/review unavailable/);assert.equal(calls,1);assert.equal(p.photo,undefined);
});
test('API usa modelo explícito e recusa HTTP inválido e conteúdo que não é PNG',async()=>{
 let body;await generatePng('scene',{apiKey:'test',imageModel:'user-model',fetchImpl:async(url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({data:[{b64_json:png.toString('base64')}]})}}});assert.equal(body.model,'user-model');assert.equal(body.n,1);
 await assert.rejects(generatePng('scene',{apiKey:'test',fetchImpl:async()=>({ok:false,status:429})}),/429/);
 await assert.rejects(generatePng('scene',{apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>({data:[{b64_json:'invalid'}]})})}),/PNG/);
});
