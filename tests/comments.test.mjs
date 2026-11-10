import test from 'node:test';import assert from 'node:assert/strict';
import {recordsRequest} from '../api/records.js';
import {fromCloud} from '../src/cloud.js';
import {workbook} from '../src/xlsx.js';
import {REVIEWER_ID} from '../src/permissions.js';
const base='https://shinouchet.vercel.app';
test('reviewer general comment uses authenticated dedicated RPC without a disposal requirement',async()=>{
 let sent;
 const response=await recordsRequest(new Request(base+'/api/records',{method:'POST',headers:{Origin:base,Cookie:'__Host-work-access=test','Content-Type':'application/json'},body:JSON.stringify({action:'comment',id:'fixture',version:3,comment:'Проверить пробег',user:{login:'Vlad'}})}),{fetcher:async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:REVIEWER_ID});
  if(url.includes('/work_members?'))return Response.json([{login:'OlgaAnat'}]);
  assert.ok(url.endsWith('/rpc/work_comment'));sent=JSON.parse(options.body);
  assert.equal(options.headers.Authorization,'Bearer test');
  return Response.json({id:'fixture',status:'none',comments:[{by:'OlgaAnat',text:sent.p_comment}]});
 }});
 assert.equal(response.status,200);assert.deepEqual(sent,{p_id:'fixture',p_version:3,p_comment:'Проверить пробег'});
 assert.equal((await response.json()).record.status,'none');
});
test('general comments remain separate from disposal decision in mapping and Excel',async()=>{
 const comment={by:'OlgaAnat',at:'2026-11-10T10:00:00Z',text:'Проверить <пробег>'};
 const row=fromCloud({id:'fixture',plate:'К565ОО',operations:['Замена'],visited_at:comment.at,status:'approved',disposal:true,review_comment:'Согласна',comments:[comment],history:[{...comment,field:'comment',new:comment.text}]});
 assert.equal(row.status,'approved');assert.equal(row.reviewComment,'Согласна');assert.deepEqual(row.comments,[comment]);
 assert.deepEqual(fromCloud({}).comments,[]);
 const xml=new TextDecoder().decode(await workbook([row]).arrayBuffer());
 for(const text of ['Статус комментариев','Прокомментировано','OlgaAnat','Согласовано','Согласна','Проверить &lt;пробег&gt;'])assert.ok(xml.includes(text),text);
 assert.ok(!xml.includes('>ID<'));
});
