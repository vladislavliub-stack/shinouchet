import test from 'node:test';import assert from 'node:assert/strict';
import {parseSpeech,normalizePlate,formatPlate,validPlate} from '../src/core.js';
test('user name examples produce canonical Cyrillic plates',()=>{
 assert.equal(normalizePlate('Константин 565 Ольга Ольга'),'К565ОО');
 assert.equal(formatPlate('Константин 565 Ольга Ольга'),'К 565 ОО');
 assert.equal(normalizePlate('Евгений 142 Светлана Владимир'),'Е142СВ');
 assert.equal(formatPlate('Евгений 142 Светлана Владимир'),'Е 142 СВ');
 assert.ok(validPlate('Евгений 142 Светлана Владимир'));
});
test('whole spoken number is understood when transcription keeps words',()=>{
 assert.equal(normalizePlate('Константин пятьсот шестьдесят пять Ольга Ольга'),'К565ОО');
 assert.equal(normalizePlate('Евгений сто сорок два Светлана Владимир'),'Е142СВ');
 assert.equal(normalizePlate('Анна двести один Роман Ульяна'),'А201РУ');
 assert.equal(normalizePlate('Михаил девятьсот одиннадцать Николай Харитон'),'М911НХ');
});
test('names, phonetic letters and literal letters may be mixed',()=>{
 assert.equal(normalizePlate('константин 005 Ольга О 799'),'К005ОО799');
 assert.equal(normalizePlate('Е 142 Светлана ВЭ'),'Е142СВ');
 assert.equal(normalizePlate('Татьяна ноль ноль семь Евгений Максим'),'Т007ЕМ');
});
test('plate names do not leak into note or operations',()=>{
 const result=parseSpeech('Номер Константин 565 Ольга Ольга. Замена двух колёс, балансировка четырёх. Проверить диск.');
 assert.equal(result.plate,'К565ОО');assert.equal(result.note,'Проверить диск');assert.deepEqual(result.operations,['Замена двух колёс','балансировка четырёх']);
});
test('ordinary people names outside a complete plate stay as notes',()=>{
 const result=parseSpeech('Светлана попросила проверить диск. Ремонт прокола');
 assert.equal(result.plate,'');assert.equal(result.note,'Светлана попросила проверить диск');
});
