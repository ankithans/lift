import type { SensorRecord } from './model';
export const API = 'https://api.prod.whoop.com/developer/v2';
export const TOKEN = 'https://api.prod.whoop.com/oauth/oauth2/token';
export class WhoopError extends Error {
  constructor(public status: number, public retryMs = 0) { super(`WHOOP request failed (${status}).`); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('WHOOP returned an invalid response.');
  return value as Record<string, unknown>;
}
const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const str = (value: unknown) => typeof value === 'string' ? value : undefined;
const timestamp = (value: unknown) => { const n = Date.parse(String(value)); if (!Number.isFinite(n)) throw new Error('WHOOP returned an invalid date.'); return n; };
export async function request(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, ...(init.body instanceof URLSearchParams ? { body: init.body.toString(), headers: { ...init.headers, 'Content-Type': 'application/x-www-form-urlencoded' } } : {}), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    const retryMs = retry ? Math.max(Number(retry) * 1000 || Date.parse(retry) - Date.now(), 1000) : 60_000;
    throw new WhoopError(response.status, retryMs);
  }
  return response.status === 204 ? null : await response.json() as unknown;
}
export function parseTokens(value: unknown) {
  const r=object(value);
  if(typeof r.access_token!=='string'||typeof r.refresh_token!=='string'||typeof r.expires_in!=='number'||r.expires_in<=0)throw new Error('WHOOP did not return rotating tokens.');
  return {accessToken:r.access_token,refreshToken:r.refresh_token,expiresAt:Date.now()+r.expires_in*1000,scope:str(r.scope)??''};
}
export function parseRecord(kind: SensorRecord['kind'], value: unknown): SensorRecord {
  const r=object(value),s=r.score?object(r.score):{};
  const externalId=kind==='recovery'?r.cycle_id:r.id;
  if(typeof externalId!=='string'&&typeof externalId!=='number')throw new Error('WHOOP record is missing an ID.');
  if(!['SCORED','PENDING_SCORE','UNSCORABLE'].includes(String(r.score_state)))throw new Error('Unknown WHOOP score state.');
  const metrics: SensorRecord['metrics']={};
  const fields:Record<string,keyof SensorRecord['metrics']>={recovery_score:'recovery',hrv_rmssd_milli:'hrv',resting_heart_rate:'rhr',spo2_percentage:'spo2',skin_temp_celsius:'skinTemp',strain:'strain',kilojoule:'kilojoule',sleep_performance_percentage:'sleepPerformance',respiratory_rate:'respiratoryRate',average_heart_rate:'avgHr',max_heart_rate:'maxHr'};
  if(r.score_state==='SCORED'){
    for(const [source,target] of Object.entries(fields)){const n=num(s[source]);if(n!==undefined)Object.assign(metrics,{[target]:n});}
    if(typeof s.user_calibrating==='boolean')metrics.calibrating=s.user_calibrating;
    if(s.stage_summary){const stages=object(s.stage_summary);
      metrics.lightMs=num(stages.total_light_sleep_time_milli);metrics.deepMs=num(stages.total_slow_wave_sleep_time_milli);metrics.remMs=num(stages.total_rem_sleep_time_milli);metrics.awakeMs=num(stages.total_awake_time_milli);
      if(metrics.lightMs!==undefined&&metrics.deepMs!==undefined&&metrics.remMs!==undefined)metrics.sleepMs=metrics.lightMs+metrics.deepMs+metrics.remMs;
    }
    if(s.zone_durations){const z=object(s.zone_durations);metrics.zones=['zero','one','two','three','four','five'].map(n=>num(z[`zone_${n}_milli`])??0);}
  }
  // Recovery has no start: resolve its cycle in the sync worker before persisting.
  return {kind,externalId:String(externalId),cycleId:r.cycle_id!==undefined?String(r.cycle_id):kind==='cycle'?String(r.id):undefined,
    sleepId:str(r.sleep_id),startAt:kind==='recovery'?timestamp(r.created_at):timestamp(r.start),
    endAt:r.end?timestamp(r.end):undefined,updatedAt:timestamp(r.updated_at),scoreState:r.score_state as SensorRecord['scoreState'],
    nap:typeof r.nap==='boolean'?r.nap:undefined,sport:str(r.sport_name),metrics};
}
