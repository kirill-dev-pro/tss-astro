import { createTRPCContext } from '@trpc/tanstack-solid-query'

import type { AppRouter } from '@/lib/trpc/routes'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
