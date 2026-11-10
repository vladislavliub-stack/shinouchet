import test from 'node:test';import assert from 'node:assert/strict';
import {recordsRequest} from '../api/records.js';
import {authenticatedTranscribe} from '../api/transcribe.js';
import {canWrite,WRITER_ID,REVIEWER_ID} from '../src/permissions.js';
const base='https://shinouchet.vercel.app';
function request(action){return new Request(base+'/api/records',{method:'POST',headers:{Cookie:'__Host-work-access=test',Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action,id:'fixture',version:1,record:{createdBy:WRITER_ID},user:{id:WRITER_ID,login:'Vlad'}})});}
function backend(id,onRPC=()=>{}){return async(url,options)=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({id});
 if(url.includes('/work_members?'))return Response.json([{login:id===WRITER_ID?'Vlad':'OlgaAnat'}]);
 if(url.includes('/rpc/')){onRPC(url,JSON.parse(options.body));return Response.json({id:'fixture'});}
 if(url.includes('/work_visits?'))return Response.json([]);
 throw Error('Unexpected URL');
};}
test('only the verified writer identity enables creation',()=>{
 assert.equal(canWrite({id:WRITER_ID}),true);
 assert.equal(canWrite({id:REVIEWER_ID,login:'Vlad'}),false);
 assert.equal(canWrite({login:'Vlad'}),false);
 assert.equal(canWrite(null),false);
});
test('reviewer cannot save, import, delete or restore, even with forged writer fields',async()=>{
 let calls=0;
 for(const action of ['save','import','delete','restore']){
  const result=await recordsRequest(request(action),{fetcher:backend(REVIEWER_ID,()=>calls++)});
  assert.equal(result.status,403,action);
 }
 assert.equal(calls,0);
});
test('reviewer can read and send both decisions',async()=>{
 const get=new Request(base+'/api/records',{headers:{Cookie:'__Host-work-access=test'}});
 assert.equal((await recordsRequest(get,{fetcher:backend(REVIEWER_ID)})).status,200);
 const sent=[];
 for(const action of ['approve','reject'])assert.equal((await recordsRequest(request(action),{fetcher:backend(REVIEWER_ID,(url,body)=>sent.push(body.p_action))})).status,200);
 assert.deepEqual(sent,['approve','reject']);
});
test('reviewer speech is blocked before any audio reaches Groq',async()=>{
 let calls=0;const result=await authenticatedTranscribe(new Request(base+'/api/transcribe',{method:'POST',body:new Uint8Array(100)}),{authSession:async()=>({user:{id:REVIEWER_ID},cookies:[]}),fetcher:async()=>{calls++;}});
 assert.equal(result.status,403);assert.equal(calls,0);
});
test('writer retains creation and speech access',async()=>{
 let called=false;
 assert.equal((await recordsRequest(request('save'),{fetcher:backend(WRITER_ID,()=>called=true)})).status,200);
 assert.ok(called);
 const result=await authenticatedTranscribe(new Request(base+'/api/transcribe',{method:'POST',headers:{Origin:base,'Content-Type':'audio/webm'},body:new Uint8Array(101)}),{authSession:async()=>({user:{id:WRITER_ID},cookies:[]}),env:{GROQ_API_KEY:'test-only'},fetcher:async()=>Response.json({text:'Проверка'})});
 assert.equal(result.status,200);
});
