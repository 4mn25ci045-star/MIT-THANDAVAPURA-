import { genSaltSync, hash } from 'bcryptjs';
export async function passwordHash(password: string, salt: string) { return hash(password, salt); }
export function newSalt() { return genSaltSync(12); }
export function secureCompare(a:string,b:string) { let diff=a.length^b.length; for(let i=0;i<Math.max(a.length,b.length);i++) diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return diff===0; }
