import test from 'node:test';
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {readFile} from 'node:fs/promises';
import {emailValid,httpUrl,validateContact,validateFile} from '../src/lib/validation.mjs';
const source=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const file=(bytes,name,type)=>new File([Uint8Array.from(bytes)],name,{type});

test('contact validates required fields and boundaries',()=>{
 const v={name:'Amman',email:'amman@example.com',subject:'Question',message:'A sufficiently long message.'};
 assert.equal(validateContact(v),''); assert.match(validateContact({...v,email:'bad'}),/valid email/);
 assert.match(validateContact({...v,message:'short'}),/10–5,000/); assert.match(validateContact({...v,name:' '.repeat(101)}),/name/);
 assert.equal(emailValid('x@site.org'),true); assert.equal(emailValid('bad@'),false);
});
test('external URLs reject script schemes and embedded credentials',()=>{
 assert.equal(httpUrl('https://example.org/path'),'https://example.org/path');
 assert.equal(httpUrl('javascript:alert(1)'),''); assert.equal(httpUrl('https://user:secret@example.org'),'');
});
test('file signature validation enforces MIME and bucket constraints',async()=>{
 const pdf=file([...Buffer.from('%PDF-1.7\n')],'scan.pdf','application/pdf');
 const png=file([137,80,78,71,13,10,26,10],'image.png','image/png');
 assert.equal(await validateFile(pdf,'resumes'),'application/pdf'); assert.equal(await validateFile(png,'certificates'),'image/png');
 await assert.rejects(validateFile(png,'resumes'),/Unsupported file/);
 await assert.rejects(validateFile(file([...Buffer.from('<script>')],'fake.pdf','application/pdf'),'resumes'),/Unsupported file/);
 await assert.rejects(validateFile(file([...Buffer.from('%PDF-1.7')],'bad.pdf','image/png'),'certificates'),/do not match/);
});
test('file size is capped before upload',async()=>{
 const oversized=new File([Buffer.alloc(8*1024*1024+1)],'large.pdf',{type:'application/pdf'});
 await assert.rejects(validateFile(oversized,'certificates'),/smaller than 8 MB/);
});
test('private storage has no browser policies and file signing is fixed-TTL/published-only',async()=>{
 const sql=await source('supabase/migrations/202611040001_portfolio.sql');const edge=await source('supabase/functions/portfolio-file/index.ts');
 assert.doesNotMatch(sql,/create\s+policy[\s\S]{0,200}on\s+storage\.objects/i);
 assert.match(edge,/\.createSignedUrl\(path,600/); assert.match(edge,/\.eq\('published',true\)/);
 assert.match(edge,/action==='delete'[\s\S]{0,1600}is_admin/);
});
test('contact quota is keyed on HMAC-normalized email and matches its SQL argument',async()=>{
 const sql=await source('supabase/migrations/202611040001_portfolio.sql');const edge=await source('supabase/functions/contact/index.ts');
 assert.match(sql,/take_contact_slot\(email_hash text\)/); assert.match(edge,/take_contact_slot',\{email_hash:hash\}/);
 assert.match(edge,/email\.toLowerCase\(\)/); assert.doesNotMatch(edge,/x-forwarded-for|cf-connecting-ip/);
});
test('no service-role credential is referenced in browser code',async()=>{
 const browser=await source('src/lib/supabase.js');const env=await source('.env.example');
 assert.doesNotMatch(browser,/SERVICE_ROLE/i); assert.doesNotMatch(env,/SERVICE_ROLE/i);
});
