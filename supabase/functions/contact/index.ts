import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {cors,json,limitedBody} from '../_shared/http.ts';
Deno.serve(async(req:Request)=>{
 const headers=cors(req);if(!headers)return json({error:'Origin not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'Method not allowed.'},405,headers);
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'Expected JSON.'},415,headers);
 const secret=Deno.env.get('TURNSTILE_SECRET_KEY');const rateSecret=Deno.env.get('RATE_LIMIT_SECRET');
 if(!secret||!rateSecret)return json({error:'Contact service is not configured yet.'},503,headers);
 let input:Record<string,unknown>;try{input=JSON.parse(new TextDecoder().decode(await limitedBody(req,16384)));if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();}catch{return json({error:'Invalid or oversized request.'},400,headers);}
 const str=(key:string)=>typeof input[key]==='string'?(input[key] as string).trim():'';
 const name=str('name'),email=str('email'),subject=str('subject'),message=str('message'),token=str('token');
 if(str('website'))return json({error:'Submission rejected.'},400,headers);
 if(!name||name.length>100||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!subject||subject.length>160||message.length<10||message.length>5000||!token||token.length>2048)return json({error:'Please check your details and complete spam protection.'},400,headers);
 try{
  const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:token}),signal:AbortSignal.timeout(10000)});
  if(!verify.ok)throw new Error('Spam protection service is unavailable.');
  const result=await verify.json();
  const host=new URL(req.headers.get('origin')!).hostname;
  if(result.success!==true||result.action!=='contact'||result.hostname!==host)return json({error:'Spam verification failed. Please try again.'},400,headers);
  // HMAC the verified form email, never a client-supplied or unverified proxy IP.
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(rateSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(email.toLowerCase())));
  const hash=Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:allowed,error:limitError}=await db.rpc('take_contact_slot',{email_hash:hash});
  if(limitError)throw limitError;if(!allowed)return json({error:'Too many messages for this email address. Please try again in 15 minutes.'},429,headers);
  const {data:saved,error}=await db.from('messages').insert({name,email,subject,message}).select('id').single();
  if(error||!saved)throw error||new Error('Insert not acknowledged.');
  return json({saved:true},201,headers);
 }catch(e){console.error('contact backend failure',e instanceof Error?e.message:String(e));return json({error:'Your message could not be confirmed. Please retry later or contact me through a profile link.'},503,headers);}
});