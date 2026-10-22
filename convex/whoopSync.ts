import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, env } from './_generated/server';
import { API, TOKEN, WhoopError, object, parseRecord, parseTokens, request } from './whoop/api';
import type { SensorRecord } from './whoop/model';

const resources=['cycle','recovery','activity/sleep','activity/workout'];
const kinds=['cycle','recovery','sleep','workout'] as const;
class Defer extends Error { constructor(public delay:number){super('Rate limit reached');} }
export const page=internalAction({
  args:{connectionId:v.id('whoopConnections')},returns:v.null(),
  handler:async(ctx,{connectionId}):Promise<null>=>{
    const lease=crypto.randomUUID();
    const c=await ctx.runMutation(internal.whoopStore.claim,{connectionId,lease});
    if(!c?.job)return null;
    const claim={connectionId,lease};
    const budget=async()=>{const delay:number=await ctx.runMutation(internal.whoopStore.budget,{});if(delay>0)throw new Defer(delay);};
    let token=c.accessToken;
    const refresh=async()=>{
      if(!env.WHOOP_CLIENT_ID||!env.WHOOP_CLIENT_SECRET)throw new Error('WHOOP credentials are not configured.');
      await budget();
      if(!await ctx.runMutation(internal.whoopStore.beginRefresh,claim))throw new Error('WHOOP sync was superseded.');
      const t=parseTokens(await request(TOKEN,{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',refresh_token:c.refreshToken,client_id:env.WHOOP_CLIENT_ID,client_secret:env.WHOOP_CLIENT_SECRET,scope:'offline'})}));
      if(!await ctx.runMutation(internal.whoopStore.tokens,{...claim,accessToken:t.accessToken,refreshToken:t.refreshToken,expiresAt:t.expiresAt}))throw new Error('WHOOP connection changed during refresh.');
      token=t.accessToken;
    };
    const get=async(url:string)=>{await budget();return await request(url,{headers:{Authorization:`Bearer ${token}`}});};
    try{
      // Refresh in its own step so both API calls have independent rate reservations.
      if(c.expiresAt<Date.now()+120_000){await refresh();await ctx.runMutation(internal.whoopStore.defer,{...claim,delay:1100});return null;}
      const task=c.job;
      if(task.target){
        const t=task.target;
        const done={...claim,eventDoneId:t.eventId};
        if(t.deleted){await ctx.runMutation(internal.whoopStore.finishPage,{...done,records:[],remove:{kind:t.kind,externalId:t.externalId}});return null;}
        if(t.kind==='recovery'){
          // v2 recovery IDs are sleep UUIDs, never cycle IDs.
          const path=t.phase===0?`activity/sleep/${encodeURIComponent(t.externalId)}`:t.phase===1?`cycle/${encodeURIComponent(t.cycleId??'')}`:`cycle/${encodeURIComponent(t.cycleId??'')}/recovery`;
          const result=parseRecord(t.phase===0?'sleep':t.phase===1?'cycle':'recovery',await get(`${API}/${path}`));
          if(t.phase===0&&!result.cycleId)throw new Error('WHOOP sleep has no cycle.');
          const next=t.phase<2?{...task,target:{...t,phase:t.phase+1,cycleId:t.cycleId??result.cycleId}}:undefined;
          await ctx.runMutation(internal.whoopStore.finishPage,{...claim,records:[result],nextJob:next,...(!next?{eventDoneId:t.eventId}:{})});
        }else{
          const result=parseRecord(t.kind,await get(`${API}/activity/${t.kind}/${encodeURIComponent(t.externalId)}`));
          await ctx.runMutation(internal.whoopStore.finishPage,{...done,records:[result]});
        }
        return null;
      }
      const url=new URL(`${API}/${resources[task.resource]}`);
      url.search=new URLSearchParams({limit:'25',start:new Date(task.start).toISOString(),end:new Date(task.end).toISOString(),...(task.nextToken?{nextToken:task.nextToken}:{})}).toString();
      const payload=object(await get(url.toString()));
      if(!Array.isArray(payload.records)||payload.records.length>25)throw new Error('WHOOP returned an invalid page.');
      const records:SensorRecord[]=payload.records.map(r=>parseRecord(kinds[task.resource],r));
      const nextToken=typeof payload.next_token==='string'&&payload.next_token?payload.next_token:undefined;
      if(nextToken&&nextToken===task.nextToken)throw new Error('WHOOP repeated a pagination cursor.');
      const nextJob=nextToken?{...task,nextToken}:task.resource<3?{start:task.start,end:task.end,resource:task.resource+1}:undefined;
      await ctx.runMutation(internal.whoopStore.finishPage,{...claim,records,nextJob});
    }catch(e){
      if(e instanceof WhoopError&&e.status===404&&c.job.target){await ctx.runMutation(internal.whoopStore.finishPage,{...claim,records:[],eventDoneId:c.job.target.eventId,remove:{kind:c.job.target.kind,externalId:c.job.target.externalId}});return null;}
      if(e instanceof Defer){await ctx.runMutation(internal.whoopStore.defer,{...claim,delay:e.delay});return null;}
      const revoked=e instanceof WhoopError&&(e.status===401||e.status===400||e.status===403);
      await ctx.runMutation(internal.whoopStore.failed,{...claim,revoked,message:revoked?'WHOOP access expired. Reconnect to continue.':'WHOOP could not sync. Your last readings are saved.',retryMs:e instanceof WhoopError?e.retryMs:undefined});
    }
    return null;
  },
});
export const revoke=internalAction({
  args:{connectionId:v.id('whoopConnections')},returns:v.null(),
  handler:async(ctx,{connectionId}):Promise<null>=>{
    const c=await ctx.runMutation(internal.whoopStore.readConnection,{connectionId});
    if(!c||c.status!=='disconnecting')return null;
    try{await request(`${API}/user/access`,{method:'DELETE',headers:{Authorization:`Bearer ${c.accessToken}`}});}catch{
      // Local erasure must succeed even when the provider is offline or has already revoked the token.
    }
    await ctx.runMutation(internal.whoopStore.erase,{connectionId});return null;
  },
});

export const forceRefresh=internalAction({
  args:{connectionId:v.id('whoopConnections')},returns:v.boolean(),
  handler:async(ctx,{connectionId}):Promise<boolean>=>await ctx.runMutation(internal.whoopStore.expireForRefresh,{connectionId}),
});
