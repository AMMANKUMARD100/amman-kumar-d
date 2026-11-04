export function cors(req: Request): Record<string,string> | null {
 const origin=req.headers.get('origin')||'';
 const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!origin||!allowed.includes(origin))return null;
 return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
}
export function json(data: unknown,status=200,headers: Record<string,string>={}) {
 return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','X-Content-Type-Options':'nosniff'}});
}
export async function limitedBody(req: Request,max: number): Promise<Uint8Array> {
 const declared=Number(req.headers.get('content-length')||0);if(declared>max)throw new Error('Request too large.');
 if(!req.body)throw new Error('Missing body.');const reader=req.body.getReader();const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new Error('Request too large.');}chunks.push(value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(length);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return all;
}