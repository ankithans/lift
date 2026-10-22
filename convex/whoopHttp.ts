import { httpAction, env } from './_generated/server';
import { internal } from './_generated/api';
import { sha256Hex } from './tokens';
import { API, TOKEN, object, parseTokens, request } from './whoop/api';

export const callback = httpAction(async(ctx,req)=>{
  const url=new URL(req.url);
  const rawState=url.searchParams.get('state');
  if(!rawState||rawState.length>256)return new Response('Invalid WHOOP state.',{status:400});
  const state=await ctx.runMutation(internal.whoopStore.consumeState,{stateHash:await sha256Hex(rawState)});
  if(!state)return new Response('This connection link expired or was already used. Return to Lift and connect again.',{status:400});
  const destination=new URL(state.returnTo);
  let outcome='error';
  try{
    const code=url.searchParams.get('code');
    if(url.searchParams.has('error'))outcome='cancelled';
    else if(code&&env.WHOOP_CLIENT_ID&&env.WHOOP_CLIENT_SECRET){
      const tokens=parseTokens(await request(TOKEN,{method:'POST',body:new URLSearchParams({grant_type:'authorization_code',code,client_id:env.WHOOP_CLIENT_ID,client_secret:env.WHOOP_CLIENT_SECRET,redirect_uri:env.WHOOP_REDIRECT_URI??`${env.CONVEX_SITE_URL}/whoop/callback`})}));
      const profile=object(await request(`${API}/user/profile/basic`,{headers:{Authorization:`Bearer ${tokens.accessToken}`}}));
      if(typeof profile.user_id!=='number')throw new Error('Missing WHOOP user ID.');
      await ctx.runMutation(internal.whoopStore.install,{userId:state.userId,whoopUserId:profile.user_id,...tokens});
      outcome='connected';
    }
  }catch{ /* Never put provider responses, codes, or credentials in redirects or logs. */ }
  destination.searchParams.set('whoop',outcome);
  return new Response(null,{status:303,headers:{Location:destination.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
});
