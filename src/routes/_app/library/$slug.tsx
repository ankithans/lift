import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { ExerciseBody } from '#/components/ExerciseDetail'
import { PageHeader } from '#/components/PageHeader'
import { BlockSkeleton } from '#/components/Skeletons'

export const Route = createFileRoute('/_app/library/$slug')({ component: ExercisePage })

function ExercisePage() {
  const { slug } = Route.useParams()
  const data = useQuery(api.library.get, { slug })
  if (data === undefined) {
    return (
      <main className="page space-y-4 pt-24">
        <BlockSkeleton h={40} />
        <BlockSkeleton h={220} />
      </main>
    )
  }
  if (data === null) return null
  return (
    <main className="page">
      <PageHeader back eyebrow={[data.primaryGroups.join(' · '), data.equipment[0]].filter(Boolean).join(' — ')} title={data.name} />
      <ExerciseBody data={data} />
    </main>
  )
}
