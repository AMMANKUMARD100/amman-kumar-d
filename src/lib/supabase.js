import { createClient } from '@supabase/supabase-js';
export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const supabase = configured ? createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY) : null;
export function requireBackend() { if (!supabase) throw new Error('Connect Supabase using the environment variables in .env.example.'); return supabase; }
export async function list(table,admin=false) {
  let q = requireBackend().from(table).select('*');
  if (!admin && ['projects','certificates','achievements'].includes(table)) q=q.eq('published',true);
  if (table==='projects') q=q.order('featured',{ascending:false}).order('sort_order');
  else if (table==='certificates') q=q.order('issue_date',{ascending:false});
  else if (table==='achievements') q=q.order('date',{ascending:false});
  else if (table==='certificate_categories') q=q.order('name');
  else if (table==='messages') q=q.order('created_at',{ascending:false}).limit(100);
  const {data,error}=await q; if(error) throw error; return data;
}
export async function signedFile(bucket,path,download=false) {
  if(!path) return null;
  const {data,error}=await requireBackend().functions.invoke('portfolio-file',{body:{action:'sign',bucket,path,download:download===true}});
  if(error){let detail;try{detail=await error.context?.json();}catch{}throw new Error(detail?.error||error.message);}
  if(!data?.url)throw new Error(data?.error||'The file service did not return a preview URL.');return data.url;
}
export async function uploadFile(bucket,file) {
  const {validateFile}=await import('./validation.mjs'); await validateFile(file,bucket);
  const body=new FormData(); body.append('bucket',bucket); body.append('file',file);
  const {data,error}=await requireBackend().functions.invoke('upload-file',{body});
  if(error) { let detail; try {detail=await error.context?.json();} catch { /* SDK error is displayed below */ } throw new Error(detail?.error||error.message); }
  if(!data?.path) throw new Error(data?.error||'Upload was not confirmed.'); return data;
}
export async function removeFile(bucket,path) {
  if(!path)return;
  const {data,error}=await requireBackend().functions.invoke('portfolio-file',{body:{action:'delete',bucket,path}});
  if(error){let detail;try{detail=await error.context?.json();}catch{}throw new Error(detail?.error||error.message);}
  if(data?.deleted!==true)throw new Error(data?.error||'File deletion was not confirmed.');
}
export async function saveRow(table,value,id) {
  const q=id!==undefined?requireBackend().from(table).update(value).eq('id',id):requireBackend().from(table).insert(value);
  const {data,error}=await q.select().single(); if(error)throw error; return data;
}
export async function deleteRow(table,id) { const {data,error}=await requireBackend().from(table).delete().eq('id',id).select('id').single(); if(error)throw error; return data; }
export async function isAdmin() { const {data,error}=await requireBackend().rpc('is_admin'); if(error)throw error; return data===true; }
export function subscribeContent(onChange) {
  if(!supabase)return ()=>{};
  let channel=supabase.channel(`portfolio-${crypto.randomUUID()}`);
  for(const table of ['profile','projects','certificates','achievements','resumes','certificate_categories'])channel=channel.on('postgres_changes',{event:'*',schema:'public',table},onChange);
  channel.subscribe(); return ()=>{supabase.removeChannel(channel);};
}