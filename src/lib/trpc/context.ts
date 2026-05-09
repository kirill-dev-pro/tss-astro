import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'

import { auth } from '../auth'

export async function createContext({
  req,
  resHeaders,
}: FetchCreateContextFnOptions) {
  const session = await auth.api.getSession({
    headers: req.headers,
  })
  return { req, resHeaders, session }
}

/** Context for `createCaller` / router-backed query proxy during prerender or SSR (no real HTTP request). */
export function createServerContext(): Promise<Context> {
  return createContext({
    req: new Request('http://localhost/'),
    resHeaders: new Headers(),
    info: {
      accept: 'application/jsonl',
      calls: [],
      connectionParams: {},
      isBatchCall: false,
      signal: new AbortSignal(),
      url: new URL('http://localhost/'),
      type: 'unknown',
    },
  })
}

export type Context = Awaited<ReturnType<typeof createContext>>
