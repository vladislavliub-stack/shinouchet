const latinPlate={A:'А',B:'В',E:'Е',K:'К',M:'М',H:'Н',O:'О',P:'Р',C:'С',T:'Т',Y:'У',X:'Х'};
const nameGroups={А:['Анна','Андрей','Александр','Алексей','Антон','Алла','Анастасия'],В:['Владимир','Виктор','Валерий','Василий','Вадим','Вера','Валентина','Виктория','Валентин'],Е:['Евгений','Евгения','Елена','Егор','Елизавета'],К:['Константин','Кирилл','Ксения','Кристина'],М:['Мария','Михаил','Максим','Марина','Матвей'],Н:['Николай','Наталья','Наталия','Нина','Никита','Надежда'],О:['Ольга','Олег','Оксана'],Р:['Роман','Руслан','Раиса'],С:['Светлана','Сергей','Семён','Семен','Степан','София'],Т:['Татьяна','Тимофей','Тимур'],У:['Ульяна'],Х:['Харитон','Христина']};
const nameLetters=Object.fromEntries(Object.entries(nameGroups).flatMap(([letter,names])=>names.map(name=>[name.toUpperCase(),letter])));
const letterNames={А:'А',ВЭ:'В',ВЕ:'В',В:'В',Е:'Е',Ё:'Е',КА:'К',К:'К',ЭМ:'М',М:'М',ЭН:'Н',Н:'Н',О:'О',ЭР:'Р',Р:'Р',ЭС:'С',С:'С',ТЭ:'Т',ТЕ:'Т',Т:'Т',У:'У',ХА:'Х',ИКС:'Х',Х:'Х',...latinPlate,...nameLetters};
const digitNames={НОЛЬ:'0',НУЛЬ:'0',НОЛИК:'0',ОДИН:'1',ЕДИНИЦА:'1',ДВА:'2',ДВЕ:'2',ТРИ:'3',ЧЕТЫРЕ:'4',ПЯТЬ:'5',ШЕСТЬ:'6',СЕМЬ:'7',ВОСЕМЬ:'8',ДЕВЯТЬ:'9'};
const letterPattern=Object.keys(letterNames).sort((a,b)=>b.length-a.length).map(name=>[...name].join('[\\s-]*')).join('|');
const digitPattern='(?:[0-9]|'+Object.keys(digitNames).join('|')+')';
const separator='[\\s,.:;—–-]*';
const cardinalNumbers={СТО:100,ДВЕСТИ:200,ТРИСТА:300,ЧЕТЫРЕСТА:400,ПЯТЬСОТ:500,ШЕСТЬСОТ:600,СЕМЬСОТ:700,ВОСЕМЬСОТ:800,ДЕВЯТЬСОТ:900,ДЕСЯТЬ:10,ОДИННАДЦАТЬ:11,ДВЕНАДЦАТЬ:12,ТРИНАДЦАТЬ:13,ЧЕТЫРНАДЦАТЬ:14,ПЯТНАДЦАТЬ:15,ШЕСТНАДЦАТЬ:16,СЕМНАДЦАТЬ:17,ВОСЕМНАДЦАТЬ:18,ДЕВЯТНАДЦАТЬ:19,ДВАДЦАТЬ:20,ТРИДЦАТЬ:30,СОРОК:40,ПЯТЬДЕСЯТ:50,ШЕСТЬДЕСЯТ:60,СЕМЬДЕСЯТ:70,ВОСЕМЬДЕСЯТ:80,ДЕВЯНОСТО:90};
const hundredsPattern=Object.keys(cardinalNumbers).filter(word=>cardinalNumbers[word]>=100).join('|');
const teensPattern=Object.keys(cardinalNumbers).filter(word=>cardinalNumbers[word]<20).join('|');
const tensPattern=Object.keys(cardinalNumbers).filter(word=>cardinalNumbers[word]>=20&&cardinalNumbers[word]<100).join('|');
const unitsPattern=Object.keys(digitNames).join('|');
const cardinalPattern='(?:'+hundredsPattern+')(?:[\\s-]+(?:(?:'+teensPattern+')|(?:'+tensPattern+')(?:[\\s-]+(?:'+unitsPattern+'))?|(?:'+unitsPattern+')))?';
const makePlatePattern=digits=>new RegExp('(?<![\\p{L}\\d])(?<first>'+letterPattern+')'+separator+'(?<digits>'+digits+')'+separator+'(?<second>'+letterPattern+')'+separator+'(?<third>'+letterPattern+')(?:'+separator+'(?:РЕГИОН'+separator+')?(?<region>[0-9](?:[\\s-]*[0-9]){1,2}))?(?![\\p{L}\\d])','iu');
const platePatterns=[makePlatePattern(digitPattern+separator+digitPattern+separator+digitPattern),makePlatePattern(cardinalPattern)];
const decodeLetter=value=>letterNames[value.toUpperCase().replace(/[\s-]/g,'')];
const decodeDigits=value=>{
 const words=value.toUpperCase().split(/[\s-]+/);
 if(words.some(word=>cardinalNumbers[word]>=100))return String(words.reduce((total,word)=>total+(cardinalNumbers[word]??Number(digitNames[word]??0)),0));
 return (value.toUpperCase().match(new RegExp(digitPattern,'g'))||[]).map(part=>digitNames[part]??part).join('');
};
export function extractPlate(value){
 const match=platePatterns.map(pattern=>String(value??'').match(pattern)).filter(Boolean).sort((a,b)=>a.index-b.index)[0];
 if(!match)return null;
 const {first,digits,second,third,region=''}=match.groups;
 return {plate:decodeLetter(first)+decodeDigits(digits)+decodeLetter(second)+decodeLetter(third)+region.replace(/[\s-]/g,''),start:match.index,end:match.index+match[0].length,raw:match[0]};
}
export const normalizePlate = value => extractPlate(value)?.plate??String(value??'').toUpperCase().replace(/[ABEKMHOPCTYX]/g,c=>latinPlate[c]).replace(/[^АВЕКМНОРСТУХ0-9]/g,'');
export const validPlate = value => /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}(\d{2,3})?$/.test(normalizePlate(value));
export function formatPlate(value){
 const plate=normalizePlate(value),match=plate.match(/^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})(\d{2,3})?$/);
 return match?`${match[1]} ${match[2]} ${match[3]}${match[4]?' '+match[4]:''}`:plate;
}
export function mergeRecognizedFields(draft,parsed,previous={}) {
 const next={...draft};
 for(const field of ['plate','car','operations','note']) {
  const empty=Array.isArray(draft[field])?!draft[field].some(s=>s.trim()):!draft[field]?.trim();
  if(empty||JSON.stringify(draft[field])===JSON.stringify(previous[field]))next[field]=parsed[field];
 }
 return next;
}
export function parseSpeech(text) {
 const plate=extractPlate(text);
 const withoutPlate=plate?(text.slice(0,plate.start).replace(/(?:госномер|номер)\s*[:—-]?\s*$/iu,'')+' '+text.slice(plate.end)):text;
 // Browser dictation often has no punctuation. Split at explicit work verbs too.
 const separated=withoutPlate.replace(/\s+(?=(?:замена|заменил|поменял|балансировка|отбалансировал|ремонт|монтаж|демонтаж|переобул|установка|установил|поставил|правка|прокатка|подкачка|примечание|замечание|на заднем|на переднем|грыжа|восьмёрка)(?=\s|[,;.!]|$))/gi,'; ');
 const parts = separated.split(/[,;\n.!]+/).map(s=>s.trim()).filter(Boolean);
 const operations=[], rest=[]; let car='';
 for (const p of parts) {
  let clean=p.replace(/(?:госномер\s*|номер\s*)?[АВЕКМНОРСТУХABEKMHOPCTYX]\s*\d{3}\s*[АВЕКМНОРСТУХABEKMHOPCTYX]{2}(?:\s*\d{2,3})?/ig,'').replace(/^[\s:—-]+/,'').trim();
  if(!clean) continue;
  if (/^(?:(?:лада|lada|kia|киа|тойота|toyota|renault|рено|hyundai|хендай|хёндэ|шкода|skoda|volkswagen|фольксваген|bmw|бмв|ваз|nissan|ниссан|ford|форд|granta|гранта)\b)/iu.test(clean) || /^(лада|киа|тойота|рено|хендай|хёндэ|шкода|фольксваген|бмв|ваз|ниссан|форд|гранта)/i.test(clean)) {car=clean;continue;}
  if(/^(?:замен|помен|баланс|отбаланс|ремонт|почин|монтаж|демонтаж|переобу|установ|постав|сня|съём|правк|прокат|подкач|шиномонтаж)/i.test(clean)) operations.push(clean);
  else rest.push(clean);
 }
 const disposal=/(?:в\s+утиль|утилизир|на\s+утилизац)/iu.test(text)&&!/(?:не\s+(?:в\s+)?утиль|не\s+утилизир|не\s+на\s+утилизац)/iu.test(text);
 return {plate:plate?.plate||'',car,operations:operations.length?operations:[''],note:rest.join('. '),transcript:text,disposal};
}
export function changes(before,after,at=new Date().toISOString()) {
 return ['plate','car','operations','note','time','photo'].filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])).map(field=>({at,field,old:before[field],new:after[field]}));
}
export function demoRecords() {
 const date=new Date(); const time=(days,h,m)=>{const d=new Date(date);d.setDate(d.getDate()-days);d.setHours(h,m,0,0);return d.toISOString();};
 return [
  {id:'demo-1',plate:'А123ВС777',car:'Lada Granta',operations:['Замена 4 колёс','Балансировка 4 колёс'],note:'Проверить задний левый диск при следующем визите',time:time(0,14,35)},
  {id:'demo-2',plate:'М456ОР799',car:'Kia Rio',operations:['Ремонт прокола'],note:'Заднее правое колесо',time:time(0,13,20)},
  {id:'demo-3',plate:'К707АМ197',car:'Škoda Octavia',operations:['Сезонная замена 4 колёс','Замена 2 вентилей'],note:'',time:time(0,11,45)},
  {id:'demo-4',plate:'А123ВС777',car:'Lada Granta',operations:['Ремонт прокола'],note:'Переднее левое колесо',time:time(14,10,15)}
 ].map(r=>({...r,demo:true,history:[],photo:'',createdAt:r.time}));
}
