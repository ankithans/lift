import { httpAction, env } from './_generated/server';
import { internal } from './_generated/api';
import { sha256Hex } from './tokens';
import { verifySignature } from './whoop/signature';
import { API, TOKEN, object, parseTokens, request, WhoopError } from './whoop/api';

export const callback = httpAction(async(ctx,req)=>{
  const url=new URL(req.url);
  const rawState=url.searchParams.get('state');
  if(!rawState||rawState.length>256)return new Response('Invalid WHOOP state.',{status:400});
  const state=await ctx.runMutation(internal.whoopStore.consumeState,{stateHash:await sha256Hex(rawState)});
  if(!state)return new Response('This connection link expired or was already used. Return to Lift and connect again.',{status:400});
  const destination=new URL(state.returnTo);
  let outcome='error';
  let stage='authorize';
  try{
    const code=url.searchParams.get('code');
    if(url.searchParams.has('error'))outcome='cancelled';
    else if(code&&env.WHOOP_CLIENT_ID&&env.WHOOP_CLIENT_SECRET){
      stage='token';
      const tokens=parseTokens(await request(TOKEN,{method:'POST',body:new URLSearchParams({grant_type:'authorization_code',code,client_id:env.WHOOP_CLIENT_ID,client_secret:env.WHOOP_CLIENT_SECRET,redirect_uri:env.WHOOP_REDIRECT_URI??`${env.CONVEX_SITE_URL}/whoop/callback`})}));
      stage='profile';
      const profile=object(await request(`${API}/user/profile/basic`,{headers:{Authorization:`Bearer ${tokens.accessToken}`}}));
      if(typeof profile.user_id!=='number')throw new Error('Missing WHOOP user ID.');
      stage='store';
      await ctx.runMutation(internal.whoopStore.install,{userId:state.userId,whoopUserId:profile.user_id,...tokens});
      outcome='connected';
    }
  }catch(e){
    // Only a fixed stage and status code leave the server, never provider bodies or credentials.
    destination.searchParams.set('whoop_reason', `${stage}_${e instanceof WhoopError?e.status:'invalid_response'}`);
  }
  destination.searchParams.set('whoop',outcome);
  return new Response(null,{status:303,headers:{Location:destination.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
});

export const webhook = httpAction(async(ctx,req)=>{
  const secret=env.WHOOP_WEBHOOK_SECRET??env.WHOOP_CLIENT_SECRET;
  if(!secret)return new Response('Not configured',{status:503});
  const body=await req.text();
  if(body.length>65536)return new Response('Too large',{status:413});
  if(!await verifySignature(body,req.headers.get('X-WHOOP-Signature-Timestamp'),req.headers.get('X-WHOOP-Signature'),secret,Date.now()))return new Response('Invalid signature',{status:401});
  let r:Record<string,unknown>;
  try{r=object(JSON.parse(body));}catch{return new Response('Invalid body',{status:400});}
  if(typeof r.user_id!=='number'||typeof r.id!=='string'||typeof r.trace_id!=='string'||r.trace_id.length>256||typeof r.type!=='string')return new Response('Invalid event',{status:400});
  const match=/^(workout|sleep|recovery)\.(updated|deleted)$/.exec(r.type);
  if(!match)return new Response(null,{status:204});
  await ctx.runMutation(internal.whoopStore.webhook,{whoopUserId:r.user_id,traceId:r.trace_id,kind:match[1] as 'workout'|'sleep'|'recovery',externalId:r.id,deleted:match[2]==='deleted'});
  return new Response(null,{status:204});
});
