import { startTransition, useEffect, useState } from 'react'
import type { RouteState } from '../types'
import { readRoute } from '../utils/routing'

export function useRouteState() {
  const [route, setRoute] = useState<RouteState>(() => readRoute())

  useEffect(() => {
    const onHashChange = () => {
      startTransition(() => {
        setRoute(readRoute())
      })
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return route
}
