import { createContext, useContext, type ReactNode } from 'react'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../convex/_generated/api'
import type { Unit } from './format'

export type Me = NonNullable<FunctionReturnType<typeof api.profile.me>>

const MeContext = createContext<Me | null>(null)

export function MeProvider({ value, children }: { value: Me; children: ReactNode }) {
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>
}

export function useMe() {
  const me = useContext(MeContext)
  if (!me) throw new Error('useMe outside MeProvider')
  return me
}

export function useUnit(): Unit {
  return useMe().profile?.unit ?? 'kg'
}
