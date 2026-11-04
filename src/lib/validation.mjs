export const CERT_CATEGORIES = ['Artificial Intelligence','Machine Learning','Cloud Computing','AWS','Data Science','Programming','Web Development','Database','Other'];
export const ACHIEVEMENT_CATEGORIES = ['Hackathons','Coding competitions','Academic achievements','Technical events','Workshops','Internships'];
export function httpUrl(value) { if (!value) return ''; try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
export function emailValid(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || ''); }
export function validateContact(v) {
  if (!v.name?.trim() || v.name.trim().length > 100) return 'Please enter your name (up to 100 characters).';
  if (!emailValid(v.email) || v.email.length > 254) return 'Please enter a valid email address.';
  if (!v.subject?.trim() || v.subject.trim().length > 160) return 'Please enter a subject (up to 160 characters).';
  if (!v.message?.trim() || v.message.trim().length < 10 || v.message.length > 5000) return 'Your message must contain 10–5,000 characters.';
  return '';
}
export async function validateFile(file, kind) {
  if (!file) throw new Error('Please choose a file.');
  const max = kind === 'project-images' ? 5 : 8;
  if (file.size === 0 || file.size > max * 1024 * 1024) throw new Error(`Choose a non-empty file smaller than ${max} MB.`);
  const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
  const ascii = (a,b) => String.fromCharCode(...bytes.slice(a,b));
  const mime = ascii(0,5) === '%PDF-' ? 'application/pdf' : bytes[0] === 137 && ascii(1,4) === 'PNG' ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP' ? 'image/webp' : '';
  if (!mime || (kind === 'resumes' && mime !== 'application/pdf') || (kind === 'project-images' && mime === 'application/pdf')) throw new Error('Unsupported file. Use PNG, JPG, WebP, or PDF; resumes must be PDF.');
  if (file.type && file.type !== mime) throw new Error('File contents do not match its reported type.');
  return mime;
}