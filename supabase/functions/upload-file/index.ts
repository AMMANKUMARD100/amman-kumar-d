import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {cors,json,limitedBody} from '../_shared/http.ts';
Deno.serve(async(req:Request)=>{
 const headers=cors(req);if(!headers)return json({error:'Origin not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'Method not allowed.'},405,headers);
 const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return json({error:'Authentication required.'},401,headers);
 const url=Deno.env.get('SUPABASE_URL')!;const anon=Deno.env.get('SUPABASE_ANON_KEY')!;const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 if(!url||!anon||!key)return json({error:'Storage backend is not configured.'},503,headers);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user},error:authError}=await userClient.auth.getUser(auth.slice(7));
 if(authError||!user)return json({error:'Session expired. Sign in again.'},401,headers);
 const {data:admin,error:roleError}=await userClient.rpc('is_admin');if(roleError||admin!==true)return json({error:'Administrator access required.'},403,headers);
 if(!req.headers.get('content-type')?.startsWith('multipart/form-data'))return json({error:'Expected multipart file upload.'},415,headers);
 let form:FormData;try{const bytes=await limitedBody(req,8*1024*1024+32768);form=await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')!}}).formData();}catch(e){return json({error:e instanceof Error?e.message:'Invalid upload.'},400,headers);}
 const bucket=String(form.get('bucket')||'');const file=form.get('file');
 if(!['certificates','resumes','project-images'].includes(bucket)||!(file instanceof File))return json({error:'Invalid bucket or missing file.'},400,headers);
 const max=(bucket==='project-images'?5:8)*1024*1024;if(file.size===0||file.size>max)return json({error:`Maximum file size is ${max/1024/1024} MB.`},400,headers);
 const data=new Uint8Array(await file.arrayBuffer());const ascii=(a:number,b:number)=>String.fromCharCode(...data.slice(a,b));
 const mime=ascii(0,5)==='%PDF-'?'application/pdf':data[0]===137&&ascii(1,4)==='PNG'?'image/png':data[0]===255&&data[1]===216&&data[2]===255?'image/jpeg':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'?'image/webp':'';
 if(!mime||(file.type&&file.type!==mime)||(bucket==='resumes'&&mime!=='application/pdf')||(bucket==='project-images'&&mime==='application/pdf'))return json({error:'Unsupported file contents or mismatched MIME type.'},400,headers);
 const ext=({'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'} as Record<string,string>)[mime];
 const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
 const storage=createClient(url,key,{auth:{persistSession:false}});
 const {error}=await storage.storage.from(bucket).upload(path,data,{contentType:mime,upsert:false,cacheControl:'3600'});
 if(error){console.error('upload-file storage error',error.message);return json({error:'Storage could not save the file. Please retry.'},500,headers);}
 return json({path,mime_type:mime,file_name:file.name.slice(0,240)},200,headers);
});