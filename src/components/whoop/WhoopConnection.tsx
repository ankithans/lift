import { useAction, useMutation } from 'convex/react'
import { ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Sheet } from '#/components/Sheet'
import { toast } from '#/lib/toast'
import { clearWhoopCache, useWhoop } from './useWhoop'

export function WhoopConnectButton({ className = 'btn btn-secondary w-full', label = 'Connect WHOOP' }: { className?: string; label?: string }) {
  const connect = useAction(api.whoop.connect)
  const [busy, setBusy] = useState(false)
  return <button className={className} disabled={busy || !navigator.onLine} onClick={async () => {
    setBusy(true)
    try { location.assign(await connect({ returnTo: location.origin + '/' })) }
    catch (e) { toast(e instanceof Error && e.message.includes('not configured') ? 'WHOOP setup is still being completed. Try again shortly.' : 'Could not open WHOOP. Try again shortly.', { tone: 'error' }); setBusy(false) }
  }}>{busy ? 'Opening WHOOP…' : label}</button>
}
export function WhoopConnectRow() {
  const [open,setOpen] = useState(false)
  const [hidden,setHidden] = useState(() => { try { return localStorage.getItem('lift:whoop:dismiss-connect') === 'yes' } catch { return false } })
  if(hidden)return null
  return <div className="mt-5 flex items-center border-b border-line pb-1">
    <button className="flex min-h-11 flex-1 items-center justify-between gap-3 text-left text-[13px] text-muted" onClick={()=>setOpen(true)}>Connect WHOOP <ChevronRight aria-hidden className="size-4"/></button>
    <button className="icon-btn size-11" aria-label="Dismiss WHOOP connection suggestion" onClick={()=>{setHidden(true);try{localStorage.setItem('lift:whoop:dismiss-connect','yes')}catch{/* optional */}}}><X className="size-4"/></button>
    <WhoopConnectSheet open={open} onClose={()=>setOpen(false)}/>
  </div>
}
function WhoopConnectSheet({open,onClose}:{open:boolean;onClose:()=>void}) {
  return <Sheet open={open} onClose={onClose} title="Connect WHOOP">
    <p className="text-[15px] leading-6 text-muted">See recovery, sleep and strain beside your training week. Your last 60 days import after you connect.</p>
    <p className="mt-3 text-[13px] leading-5 text-muted">WHOOP asks you to allow read access to recovery, cycles, sleep, workouts, profile and body measurements. Tokens stay on Lift’s server. You can disconnect and remove imported readings in Settings.</p>
    <div className="mt-6"><WhoopConnectButton/></div>
    <a className="mt-3 flex min-h-11 items-center justify-center text-[13px] text-muted underline" href="/privacy">Privacy policy</a>
  </Sheet>
}
export function WhoopSettings() {
  const now=new Date();const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-6).getTime()
  const view=useWhoop(start,start+7*86400000)
  const [open,setOpen]=useState(false),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false)
  const disconnect=useMutation(api.whoop.disconnect),sync=useMutation(api.whoop.syncNow)
  const connected=view.data && view.data.status!=='disconnected'
  return <>
    <button onClick={()=>setOpen(true)} className="press flex min-h-14 w-full items-center gap-3 border-b border-line text-left"><span className="flex-1 text-[16px]">WHOOP</span><span className="text-[14px] text-muted">{connected ? view.data?.status==='reconnect'?'Reconnect':view.data?.status==='syncing'?'Syncing…':'Connected':'Connect'}</span><ChevronRight aria-hidden className="size-4 text-muted"/></button>
    {connected?<Sheet open={open} onClose={()=>{setOpen(false);setConfirm(false)}} title="WHOOP connection">
      <p className="text-[14px] text-muted">{view.data?.lastSyncedAt?`Last synced ${new Date(view.data.lastSyncedAt).toLocaleString()}`:'Your first sync is in progress.'}</p>
      {view.data?.error&&<p className="mt-3 text-[13px] text-warning">{view.data.error}</p>}
      {view.data?.status==='reconnect'?<div className="mt-5"><WhoopConnectButton label="Reconnect WHOOP"/></div>:<button disabled={busy||!view.online||view.data?.status==='syncing'} className="btn btn-secondary mt-5 w-full" onClick={async()=>{try{await sync({});toast('WHOOP sync requested.')}catch{toast('Could not sync WHOOP.',{tone:'error'})}}}>Sync now</button>}
      {confirm&&<p className="mt-6 text-[14px] text-muted">Disconnect and remove your imported WHOOP readings from Lift? Your Lift workouts stay saved.</p>}
      <button disabled={busy||!view.online} className="mt-4 min-h-12 w-full text-[14px] text-danger" onClick={async()=>{if(!confirm){setConfirm(true);return}setBusy(true);try{await disconnect({});clearWhoopCache();setOpen(false);toast('WHOOP disconnected.')}catch{toast('Could not disconnect WHOOP.',{tone:'error'})}finally{setBusy(false)}}}>{confirm?'Disconnect and remove readings':'Disconnect WHOOP'}</button>
    </Sheet>:<WhoopConnectSheet open={open} onClose={()=>setOpen(false)}/>}
  </>
}
