import test from 'node:test';
import assert from 'node:assert/strict';
import {canReview,WRITER_ID,REVIEWER_ID} from '../src/permissions.js';
import {recordsRequest} from '../api/records.js';
const record={id:'fixture',createdBy:WRITER_ID,disposal:true,deletedAt:null};
test('Vlad can review own and other disposal entries',()=>{
 assert.equal(canReview({id:WRITER_ID},record),true);
 assert.equal(canReview({id:WRITER_ID},{...record,createdBy:REVIEWER_ID}),true);
});
test('OlgaAnat retains review access and own-entry restriction',()=>{
 assert.equal(canReview({id:REVIEWER_ID},record),true);
 assert.equal(canReview({id:REVIEWER_ID},{...record,createdBy:REVIEWER_ID}),false);
});
test('review controls reject deleted, regular and unauthorized entries',()=>{
 for(const user of [{id:WRITER_ID},{id:REVIEWER_ID}]){
  assert.equal(canReview(user,{...record,deletedAt:'2026-11-16'}),false);
  assert.equal(canReview(user,{...record,disposal:false}),false);
 }
 for(const user of [null,{}, {id:'outsider',login:'Vlad'}])assert.equal(canReview(user,record),false);
});
test('Vlad API forwards both decisions and independent comments with version',async()=>{
 const sent=[];
 const fetcher=async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:WRITER_ID});
  if(url.includes('/work_members?'))return Response.json([{login:'Vlad'}]);
  if(url.includes('/rpc/')){sent.push({url,body:JSON.parse(options.body)});return Response.json({id:record.id});}
  throw Error('Unexpected request');
 };
 for(const action of ['approve','reject','comment']){
  const response=await recordsRequest(new Request('https://shinouchet.vercel.app/api/records',{
   method:'POST',headers:{Cookie:'__Host-work-access=test',Origin:'https://shinouchet.vercel.app','Content-Type':'application/json'},
   body:JSON.stringify({id:record.id,version:7,action,comment:'Проверено Владом'})
  }),{fetcher});
  assert.equal(response.status,200);
 }
 assert.deepEqual(sent.map(x=>x.body.p_action),['approve','reject',undefined]);
 assert.ok(sent.every(x=>x.body.p_version===7&&x.body.p_comment==='Проверено Владом'));
 assert.ok(sent[2].url.endsWith('/work_comment'));
});
