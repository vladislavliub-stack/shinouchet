// Recognition can deliver its last result after stop(). Keep listening until end.
export function createRecognition({Recognition,onText,onEnd,onError}) {
 const recognition=new Recognition();
 recognition.lang='ru-RU';
 recognition.continuous=true;
 recognition.interimResults=true;
 let text='',ended=false;
 recognition.onresult=event=>{
  if(ended)return;
  text=Array.from(event.results,result=>result[0].transcript).join(' ').trim();
  onText(text,Array.from(event.results).every(result=>result.isFinal));
 };
 recognition.onerror=event=>onError(event.error);
 recognition.onend=()=>{if(ended)return;ended=true;onEnd(text);};
 return {
  start:()=>recognition.start(),
  stop:()=>{if(!ended){try{recognition.stop();}catch{ended=true;onEnd(text);}}},
 };
}
