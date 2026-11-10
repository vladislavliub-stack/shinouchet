import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionRequest} from '../api/session.js';
import {recordsRequest} from '../api/records.js';
import {authenticatedTranscribe} from '../api/transcribe.js';
import {session,ApiError} from '../server/auth.mjs';
import {parseSpeech} from '../src/core.js';
import {fromCloud} from '../src/cloud.js';
const vlad='98f3a667-bca0-4bb6-9f2b-da011ee69ceb';
const origin='https://shinouchet.vercel.app';
const req=(path,opts={})=>new Request(origin+'/api/'+path,opts);
const json=data=>Response.json(data);
const cookie='__Host-work-access=verified';
const authFetch=async(url)=>{if(url.endsWith('/auth/v1/user'))return json({id:vlad});if(url.includes('/work_members?'))return json([{login:'Vlad'}]);throw Error('Unexpected endpoint: '+url);};
test('journal and voice reject unauthenticated requests without contacting Groq',async()=>{
 assert.equal((await recordsRequest(req('records'))).status,401);
 let calls=0;const result=await authenticatedTranscribe(req('transcribe',{method:'POST',body:new Uint8Array(100)}),{authSession:async()=>{throw new ApiError('Войдите',401);},fetcher:async()=>{calls++;}});
 assert.equal(result.status,401);assert.equal(calls,0);
});
test('login resolves server-side alias, issues HttpOnly cookies, never returns email/password/tokens',async()=>{
 const response=await sessionRequest(req('session',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({login:'VLAD',password:'fake-test-only'})}),{env:{SHINOUCHET_LOGIN_EMAILS:JSON.stringify({vlad:'internal@example.invalid'})},fetcher:async(url,opts)=>{
  if(url.includes('grant_type=password')){assert.deepEqual(JSON.parse(opts.body),{email:'internal@example.invalid',password:'fake-test-only'});return json({user:{id:vlad,email:'internal@example.invalid'},access_token:'test-access',refresh_token:'test-refresh'});}
  return authFetch(url,opts);
 }});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{user:{id:vlad,login:'Vlad'}});
 const cookies=response.headers.getSetCookie();assert.equal(cookies.length,2);assert.ok(cookies.every(c=>c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=Lax')));
});
test('unknown aliases, cross-origin logins and unauthorized identities are refused',async()=>{
 assert.equal((await sessionRequest(req('session',{method:'POST',headers:{origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'}))).status,403);
 assert.equal((await sessionRequest(req('session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"login":"nobody","password":"x"}'}))).status,401);
 await assert.rejects(session(req('session',{headers:{cookie}}),{fetcher:async()=>json({id:'someone-else'})}),/Нет доступа/);
});
test('expired access token refreshes and is verified before database access',async()=>{
 let refreshed=false;
 const result=await session(req('records',{headers:{cookie:cookie+'; __Host-work-refresh=old'}}),{fetcher:async(url,opts)=>{
  if(url.endsWith('/auth/v1/user'))return refreshed?json({id:vlad}):Response.json({error:'expired'},{status:401});
  if(url.includes('grant_type=refresh_token')){refreshed=true;return json({access_token:'new-access',refresh_token:'new-refresh'});}
  return authFetch(url,opts);
 }});
 assert.equal(result.token,'new-access');assert.equal(result.cookies.length,2);
});
test('journal RPC receives the caller token and preserves conflict errors',async()=>{
 const response=await recordsRequest(req('records',{method:'POST',headers:{cookie,origin,'Content-Type':'application/json'},body:JSON.stringify({action:'approve',id:'test',version:2,comment:'Согласен'})}),{fetcher:async(url,opts)=>{
  if(url.includes('/rpc/work_action')){assert.equal(opts.headers.Authorization,'Bearer verified');assert.deepEqual(JSON.parse(opts.body),{p_id:'test',p_version:2,p_action:'approve',p_comment:'Согласен'});return Response.json({code:'40001',message:'Запись уже изменена'},{status:409});}
  return authFetch(url,opts);
 }});
 assert.equal(response.status,409);assert.match((await response.json()).error,/уже изменена/);assert.match(response.headers.get('Cache-Control'),/no-store/);
});
test('disposal dictation detects a proposal but never treats negation as agreement',()=>{
 assert.equal(parseSpeech('Константин 565 Ольга Ольга. Замена. Старые шины в утиль').disposal,true);
 assert.equal(parseSpeech('Шины не в утиль').disposal,false);
 assert.equal(parseSpeech('Не утилизировать шины').disposal,false);
 assert.equal(parseSpeech('Балансировка колёс').disposal,false);
});
test('cloud rows keep author, review and independent operations',()=>{
 const r=fromCloud({id:'a',created_by:vlad,operations:['Замена','Балансировка'],status:'approved',disposal:true,history:[]});
 assert.equal(r.author,'Vlad');assert.equal(r.status,'approved');assert.equal(r.demo,false);assert.deepEqual(r.operations,['Замена','Балансировка']);
});
test('composite RPC arrays are normalized into one saved record',async()=>{
 const response=await recordsRequest(req('records',{method:'POST',headers:{cookie,origin,'Content-Type':'application/json'},body:JSON.stringify({action:'save',record:{id:'saved',plate:'К565ОО',operations:['Замена'],time:'2026-11-09T12:00:00Z'}})}),{fetcher:async(url,opts)=>url.includes('/rpc/work_save')?json([{id:'saved',version:1}]):authFetch(url,opts)});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{record:{id:'saved',version:1}});
});
