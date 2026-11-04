import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {cors,json,limitedBody} from '../_shared/http.ts';
const BUCKETS=['certificates','resumes','project-images'];
Deno.serve(async(req:Request)=>{
 const headers=cors(req);if(!headers)return json({error:'Origin not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'Method not allowed.'},405,headers);
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'Expected JSON.'},415,headers);
 let body:Record<string,unknown>;try{body=JSON.parse(new TextDecoder().decode(await limitedBody(req,4096)));if(!body||Array.isArray(body)||typeof body!=='object')throw new Error();}catch{return json({error:'Invalid request.'},400,headers);}
 const action=typeof body.action==='string'?body.action:'';const bucket=typeof body.bucket==='string'?body.bucket:'';const path=typeof body.path==='string'?body.path:'';
 if(!BUCKETS.includes(bucket)||!path||path.length>256)return json({error:'Invalid bucket or file path.'},400,headers);
 const url=Deno.env.get('SUPABASE_URL')!;const anon=Deno.env.get('SUPABASE_ANON_KEY')!;const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 if(!url||!anon||!service)return json({error:'File service is not configured.'},503,headers);
 const storage=createClient(url,service,{auth:{persistSession:false}});
 if(action==='sign'){
  // Only a current, published metadata row can mint a new, 10-minute bearer URL.
  let query;
  if(bucket==='certificates')query=storage.from('certificates').select('file_path').eq('file_path',path).eq('published',true).maybeSingle();
  else if(bucket==='project-images')query=storage.from('projects').select('thumbnail_path').eq('thumbnail_path',path).eq('published',true).maybeSingle();
  else query=storage.from('resumes').select('file_path').eq('file_path',path).eq('id',true).maybeSingle();
  const {data,error}=await query;if(error){console.error('portfolio-file metadata lookup failed',error.message);return json({error:'Could not confirm that this file is published.'},503,headers);}
  if(!data)return json({error:'This file is not publicly available.'},404,headers);
  const {data:signed,error:signError}=await storage.storage.from(bucket).createSignedUrl(path,600,body.download===true?{download:true}:{});
  if(signError||!signed?.signedUrl){console.error('portfolio-file signing failed',signError?.message);return json({error:'Could not prepare the file preview. Please retry.'},503,headers);}
  return json({url:signed.signedUrl,expires_in:600},200,headers);
 }
 if(action==='delete'){
  const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return json({error:'Administrator sign-in required.'},401,headers);
  const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await client.auth.getUser(authorization.slice(7));if(authError||!user)return json({error:'Session expired. Sign in again.'},401,headers);
  const {data:admin,error:roleError}=await client.rpc('is_admin');if(roleError||admin!==true)return json({error:'Administrator access required.'},403,headers);
  const prefix=`${user.id}/`;const filename=path.startsWith(prefix)?path.slice(prefix.length):'';
  if(!/^[0-9a-f-]{36}\.(?:pdf|png|jpg|webp)$/i.test(filename))return json({error:'You may remove only files uploaded by this account.'},403,headers);
  const {error:removeError}=await storage.storage.from(bucket).remove([path]);if(removeError){console.error('portfolio-file deletion failed',removeError.message);return json({error:'The record was saved, but the stored file could not be removed.'},503,headers);}
  return json({deleted:true},200,headers);
 }
 return json({error:'Unsupported file operation.'},400,headers);
});
