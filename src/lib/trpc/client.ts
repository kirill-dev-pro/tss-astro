import { createTRPCClient, httpBatchLink } from '@trpc/client'

import type { AppRouter } from './routes'

import { env } from '../env'
import { createQueryClient, transformer } from './rootProvider'

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: env.VITE_DEV ? env.VITE_SERVER_URL + '/api/trpc' : '/api/trpc',
      transformer: transformer,
    }),
  ],
})

const queryClient = createQueryClient()

export { trpcClient, queryClient }
