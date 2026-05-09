import { QueryClient } from '@tanstack/solid-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'

import type { AppRouter } from './routes'
//     👆 **type-only** imports are stripped at build time

import { env } from '../env'
import { createMemo } from 'solid-js';

 const queryClient = createMemo(() => new QueryClient())

// Pass AppRouter as a type parameter. 👇 This lets `trpc` know
// what procedures are available on the server and their input/output types.
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: env.VITE_SERVER_URL + '/api/trpc',
    }),
  ],
})

export { trpcClient, queryClient }
