import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,ArrowUpRight,FileText,Download,ExternalLink} from 'lucide-react';
import {signedFile} from './lib/supabase';
import {httpUrl} from './lib/validation.mjs';
const ToastContext=createContext(()=>{});
export const useToast=()=>useContext(ToastContext);
export function ToastProvider({children}) {
  const [toasts,setToasts]=useState([]);const timers=useRef([]);
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
  function notify(message,kind='success'){const id=crypto.randomUUID();setToasts(t=>[...t.slice(-3),{id,message,kind}]);timers.current.push(setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),6500));}
  return <ToastContext.Provider value={notify}>{children}<div className="toasts" aria-live="polite">{toasts.map(t=><div className={`toast ${t.kind}`} key={t.id}><span>{t.message}</span><button aria-label="Dismiss notification" onClick={()=>setToasts(a=>a.filter(x=>x.id!==t.id))}><X size={16}/></button></div>)}</div></ToastContext.Provider>;
}
export function External({href,children,className='',...rest}){const safe=httpUrl(href);return safe?<a href={safe} className={className} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>:null;}
export function Modal({title,children,onClose,wide=false}){
  const ref=useRef();useEffect(()=>{const prior=document.activeElement;const old=document.body.style.overflow;document.body.style.overflow='hidden';ref.current.showModal();return()=>{document.body.style.overflow=old;prior?.focus();};},[]);
  return createPortal(<dialog className={`modal ${wide?'wide':''}`} ref={ref} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}><header className="modal-head"><h2>{title}</h2><button aria-label="Close dialog" className="icon-btn" onClick={onClose}><X/></button></header>{children}</dialog>,document.body);
}
export function FilePreview({item,bucket,onClose}){
  const [url,setUrl]=useState(item.is_local?item.file_path:'');const [error,setError]=useState('');
  useEffect(()=>{if(item.is_local)return;let alive=true;signedFile(bucket,item.file_path).then(v=>{if(alive)setUrl(v);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[bucket,item.file_path,item.is_local]);
  async function download(){if(item.is_local){const a=document.createElement('a');a.href=item.file_path;a.download='Amman_Kumar_Resume.pdf';a.click();return;}try{const link=await signedFile(bucket,item.file_path,true);window.open(link,'_blank','noopener,noreferrer');}catch(e){setError(e.message);}}
  return <Modal wide title={item.title||'Resume'} onClose={onClose}><div className="preview-body">{error?<p className="error" role="alert">{error}</p>:!url?<div className="loading" role="status"><span className="spinner"/>Preparing secure preview…</div>:item.mime_type==='application/pdf'?<iframe title={`${item.title||'Resume'} PDF preview`} src={url} className="pdf-preview"/>:<img className="image-preview" src={url} alt={item.title||'Certificate'}/>}</div><div className="modal-actions"><p className="muted">PDF not visible? Open the original in a new tab.</p>{url&&<><a className="btn secondary" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Open original</a><button className="btn" onClick={download}><Download size={16}/>Download file</button></>}</div></Modal>;
}
export function SectionHeading({index,eyebrow,title,description,children}){return <div className="section-heading"><div><p className="eyebrow"><span>{index}</span> / {eyebrow}</p><h2>{title}</h2>{description&&<p className="section-description">{description}</p>}</div>{children}</div>;}
export function Empty({icon:Icon=FileText,title,text}){return <div className="empty"><Icon size={28}/><h3>{title}</h3><p>{text}</p></div>;}
export function ArrowLink({href,children}){return <External href={href} className="text-link">{children}<ArrowUpRight size={17}/></External>;}