export async function decodeAudio(blob) {
 const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(!Context||!globalThis.OfflineAudioContext)throw new Error('Этот браузер не умеет декодировать запись. Откройте приложение в Chrome.');
 const context=new Context();
 try{
  const audio=await context.decodeAudioData(await blob.arrayBuffer());
  if(!audio.length||audio.duration<0.3)throw new Error('Запись слишком короткая. Надиктуйте работу ещё раз.');
  const offline=new OfflineAudioContext(1,Math.ceil(audio.duration*16000),16000);
  const source=offline.createBufferSource();source.buffer=audio;source.connect(offline.destination);source.start();
  return (await offline.startRendering()).getChannelData(0).slice();
 }finally{await context.close();}
}
export function createLocalTranscriber({WorkerClass=globalThis.Worker,timeoutMs=300000}={}){
 let worker=null,job=null,sequence=0;
 function stop(message){if(job){clearTimeout(job.timer);job.reject(new Error(message));job=null;}worker?.terminate();worker=null;}
 function getWorker(){
  if(worker)return worker;
  worker=new WorkerClass(new URL('./asr-worker.js',import.meta.url),{type:'module'});
  worker.onerror=()=>stop('Не удалось загрузить распознаватель. Проверьте интернет и повторите.');
  worker.onmessage=({data})=>{
   if(!job||job.id!==data.id)return;
   if(data.type==='progress'){job.progress(data.message);return;}
   const current=job;job=null;clearTimeout(current.timer);
   if(data.type==='result')current.resolve(data.text);
   else {worker.terminate();worker=null;current.reject(new Error(data.message||'Не удалось распознать запись.'));}
  };
  return worker;
 }
 return {
  transcribe(samples,progress=()=>{}){
   if(job)return Promise.reject(new Error('Предыдущая запись ещё распознаётся.'));
   return new Promise((resolve,reject)=>{
    const id=++sequence;
    job={id,resolve,reject,progress,timer:setTimeout(()=>stop('Распознавание заняло слишком много времени. Сохранена запись для повторной попытки.'),timeoutMs)};
    try{getWorker().postMessage({id,audio:samples},[samples.buffer]);}catch(error){stop(error.message);}
   });
  },
  cancel:()=>stop('Распознавание отменено. Аудиозапись можно прослушать и распознать снова.'),
 };
}
