import type { UserWithRole } from 'better-auth/plugins'

// import { trpcMiddleware as sentryTrpcMiddleware } from '@sentry/node'
// import { getCookie } from '@tanstack/react-start/server'
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'

import { auth } from '@/lib/auth'

// import type { Language } from '../intl/i18n'

export const createTRPCContext = async (opts: {
  headers: Headers
  req: Request
}) => {
  // const locale = (getCookie('i18next') as Language) || 'en'
  const session = await auth.api.getSession({
    headers: opts.headers,
  })

  return {
    session,
    // locale,
  }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  // TODO: add transformer that can use formData split :)
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
  sse: {
    maxDurationMs: 5 * 60 * 1000, // 5 minutes
    ping: {
      enabled: true,
      intervalMs: 3000,
    },
    client: {
      reconnectAfterInactivityMs: 5000,
    },
  },
})

export const createTRPCRouter = t.router

export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      cause: 'No session',
    })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const { role } = ctx.session.user
  if (role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    })
  }
  return next({ ctx })
})

/**
 * Create a router
 * @see https://trpc.io/docs/v11/router
 */
export const router = t.router

/**
 * @see https://trpc.io/docs/v11/merging-routers
 */
// export const mergeRouters = t.mergeRouters
// export const createCallerFactory = t.createCallerFactory
