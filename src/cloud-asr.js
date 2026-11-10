export function createCloudTranscriber({fetcher=fetch}={}){
 let controller=null;
 return {
  async transcribe(blob,progress=()=>{}){
   if(controller)throw new Error('Распознавание уже идёт');
   controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),65000);
   try{
    progress('Распознаю…');
    const response=await fetcher('./api/transcribe',{method:'POST',headers:{'Content-Type':blob.type||'audio/webm'},body:blob,signal:controller.signal});
    let data;try{data=await response.json();}catch{throw new Error('Сервис речи недоступен');}
    if(!response.ok)throw new Error(data.error||'Ошибка распознавания');
    if(!data.text?.trim())throw new Error('Речь не разобрана');
    return data.text.trim();
   }catch(error){if(error.name==='AbortError')throw new Error('Распознавание остановлено');throw error;}
   finally{clearTimeout(timer);controller=null;}
  },
  cancel(){controller?.abort();},
 };
}
