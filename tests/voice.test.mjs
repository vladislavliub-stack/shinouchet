import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecognition} from '../src/voice.js';
import {parseSpeech,mergeRecognizedFields} from '../src/core.js';

class Recognition {
 static current;
 constructor(){Recognition.current=this;}
 start(){this.started=true;}
 stop(){this.stopped=true;}
 result(text,final){const item=[{transcript:text}];item.isFinal=final;this.onresult({results:[item]});}
 end(){this.onend();}
}
const empty=()=>({plate:'',car:'',operations:[''],note:'',time:'2026-11-06T10:00:00Z',photo:'photo',transcript:''});
test('final dictation automatically fills card without parse button',()=>{
 let draft=empty(),previous={};
 const apply=()=>{const parsed=parseSpeech(draft.transcript);draft=mergeRecognizedFields(draft,parsed,previous);previous=parsed;};
 const voice=createRecognition({Recognition,onText:(text,final)=>{draft.transcript=text;if(final)apply();},onEnd:apply,onError:()=>{}});
 voice.start();
 assert.equal(Recognition.current.lang,'ru-RU');
 Recognition.current.result('номер А123ВС777 Лада Гранта замена двух колёс балансировка четырёх',true);
 assert.equal(draft.plate,'А123ВС777');assert.equal(draft.car,'Лада Гранта');assert.deepEqual(draft.operations,['замена двух колёс','балансировка четырёх']);
 assert.equal(draft.photo,'photo');assert.equal(draft.time,'2026-11-06T10:00:00Z');
});
test('late final result after stop updates interim text and card',()=>{
 let draft=empty(),previous={},ended=0;
 const apply=()=>{const parsed=parseSpeech(draft.transcript);draft=mergeRecognizedFields(draft,parsed,previous);previous=parsed;};
 const voice=createRecognition({Recognition,onText:text=>{draft.transcript=text;apply();},onEnd:()=>{ended++;apply();},onError:()=>{}});
 Recognition.current.result('А123ВС777, Лада Гранта, замена двух',false);
 voice.stop();
 Recognition.current.result('А123ВС777, Лада Гранта, замена двух колёс, балансировка четырёх',true);
 Recognition.current.end();Recognition.current.end();
 assert.deepEqual(draft.operations,['замена двух колёс','балансировка четырёх']);assert.equal(ended,1);
});
test('automatic filling preserves manual corrections and existing photo number',()=>{
 const base={...empty(),plate:'М456ОР799',car:'Kia Rio',note:'Моя заметка'};
 const parsed=parseSpeech('А123ВС777, Лада Гранта, замена двух колёс');
 const next=mergeRecognizedFields(base,parsed);
 assert.equal(next.plate,base.plate);assert.equal(next.car,base.car);assert.equal(next.note,base.note);assert.deepEqual(next.operations,['замена двух колёс']);
 const edited={...next,operations:['Замена 4 колёс (исправлено)']};
 assert.deepEqual(mergeRecognizedFields(edited,parseSpeech('балансировка четырёх'),parsed).operations,edited.operations);
});
test('recognition errors are exposed and stale results after end ignored',()=>{
 let error='',calls=0;
 const voice=createRecognition({Recognition,onText:()=>calls++,onEnd:()=>{},onError:e=>error=e});
 voice.start();Recognition.current.onerror({error:'network'});Recognition.current.end();Recognition.current.result('Поздний текст',true);
 assert.equal(error,'network');assert.equal(calls,0);
});
