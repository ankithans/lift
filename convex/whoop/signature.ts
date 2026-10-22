/** WHOOP signs base64(HMAC-SHA256(timestamp + rawBody, client_secret)). */
export async function verifySignature(body: string, timestamp: string | null, signature: string | null, secret: string, now: number) {
  if(!timestamp||!signature||!/^\d{13}$/.test(timestamp)||Math.abs(now-Number(timestamp))>300_000)return false;
  try{
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    const bytes=Uint8Array.from(atob(signature),c=>c.charCodeAt(0));
    return await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(timestamp+body));
  }catch{return false;}
}
