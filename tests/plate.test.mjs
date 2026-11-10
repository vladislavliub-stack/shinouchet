import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePlate,extractPlate,parseSpeech,validPlate} from '../src/core.js';
test('spoken Cyrillic letter names become standard plates',()=>{
 for(const input of ['ХА 003 ВВ','ха003вэвэ','ХА 0 0 3 ВЭ ВЭ','ХА ноль ноль три вэ вэ','Х А 003 В Е В Е','X003BB']){
  assert.equal(normalizePlate(input),'Х003ВВ',input);assert.ok(validPlate(input),input);
 }
 assert.equal(normalizePlate('ЭМ 970 О ЭР'),'М970ОР');
 assert.equal(normalizePlate('ЭС 123 КА ТЭ 799'),'С123КТ799');
 assert.equal(normalizePlate('икс 003 в в регион 77'),'Х003ВВ77');
});
test('extracting the plate keeps leading zeros and region',()=>{
 const input='Госномер: ХА 003 ВЭ ВЭ регион 077. Форд, ремонт прокола';
 const result=extractPlate(input);assert.equal(result.plate,'Х003ВВ077');assert.equal(input.slice(result.start,result.end),result.raw);
 const parsed=parseSpeech(input);assert.equal(parsed.plate,'Х003ВВ077');assert.equal(parsed.car,'Форд');assert.deepEqual(parsed.operations,['ремонт прокола']);assert.equal(parsed.note,'');
});
test('recognized plate is not left in another field',()=>{
 const parsed=parseSpeech('ХА 003 ВВ, Форд. Балансировка четырёх колёс, проверить диск');
 assert.equal(parsed.plate,'Х003ВВ');assert.equal(parsed.car,'Форд');assert.deepEqual(parsed.operations,['Балансировка четырёх колёс']);assert.equal(parsed.note,'проверить диск');
 assert.equal(parsed.transcript,'ХА 003 ВВ, Форд. Балансировка четырёх колёс, проверить диск');
});
test('ambiguous or incomplete text is not invented into a plate',()=>{
 for(const text of ['ХА 03 ВВ','ХА 003 В','ХА 003 ВВ7777','проверить 003 колеса','Форд ремонт прокола'])assert.equal(extractPlate(text),null,text);
 assert.equal(normalizePlate('a123'),'А123');
});
