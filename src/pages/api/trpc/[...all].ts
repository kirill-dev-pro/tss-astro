import type { APIRoute } from 'astro'

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
/** Dynamic catch-all; must not be prerendered (no `getStaticPaths`). */
export const prerender = false

import { createContext } from '@/lib/trpc/context'
import { appRouter } from '@/lib/trpc/routes'

export const ALL: APIRoute = (opts) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: opts.request,
    router: appRouter,
    createContext,
  })
}
