import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ActivityDetails } from './WhoopDetails'
export function WhoopWorkout({workoutId}:{workoutId:Id<'workouts'>}) {
  const linked=useQuery(api.whoop.forWorkout,{workoutId})
  if(!linked?.length)return null
  return <section className="whoop mt-6" aria-label="WHOOP readings for this Lift session"><h2 className="text-[13px] text-muted">WHOOP · matched to this session</h2>{linked.map(a=><ActivityDetails key={a.externalId} activity={a}/>)}</section>
}
