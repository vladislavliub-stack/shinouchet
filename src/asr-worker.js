// Pinned browser runtime, multilingual Whisper base. Audio stays on the device.
let pipelinePromise=null;
self.onmessage=async({data:{id,audio}})=>{
 const send=(type,extra)=>self.postMessage({id,type,...extra});
 try{
  if(!pipelinePromise){
   send('progress',{message:'Загрузка модели · ~100 МБ'});
   pipelinePromise=(async()=>{
    const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
    env.allowLocalModels=false;
    env.backends.onnx.wasm.numThreads=1;
    env.backends.onnx.wasm.proxy=false;
    const files=new Map();
    return pipeline('automatic-speech-recognition','Xenova/whisper-base',{
     quantized:true,revision:'main',
     progress_callback:event=>{
      if(event.status==='progress'){
       files.set(event.file,event.loaded||0);
       const mb=[...files.values()].reduce((a,b)=>a+b,0)/1048576;
       send('progress',{message:'Загрузка · '+mb.toFixed(1)+' МБ'});
      }
     },
    });
   })();
  }
  const transcriber=await pipelinePromise;
  send('progress',{message:'Распознаю…'});
  let peak=0;for(const value of audio)peak=Math.max(peak,Math.abs(value));
  if(peak<0.002)throw new Error('Тихая запись. Повторите.');
  const result=await transcriber(audio,{language:'russian',task:'transcribe',chunk_length_s:30,stride_length_s:5,return_timestamps:false,max_new_tokens:128});
  const text=(result.text||'').trim();
  if(!text)throw new Error('Речь не разобрана. Повторите.');
  send('result',{text});
 }catch(error){
  pipelinePromise=null;
  send('error',{message:'Распознавание: '+(error.message||'ошибка загрузки модели')});
 }
};
