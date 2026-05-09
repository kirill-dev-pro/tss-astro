import z from 'zod'

import { publicProcedure, router } from '../init'

const NAME_LIST = [
  'Katt',
  'Mia',
  'Luna',
  'Bella',
  'Lucy',
  'Max',
  'Charlie',
  'Buddy',
  'Rocky',
  'Bear',
]

export const appRouter = router({
  hello: publicProcedure.input(z.string()).query(async ({ input }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return `Hello, ${input}!`
  }),

  userList: publicProcedure.query(async () => {
    const randomDelay = Math.floor(Math.random() * 1000)
    await new Promise((resolve) => setTimeout(resolve, randomDelay))
    const randomLength = Math.floor(Math.random() * 10) + 1
    const users = Array.from({ length: randomLength }, (_, index) => ({
      id: index.toString(),
      name: NAME_LIST[Math.floor(Math.random() * NAME_LIST.length)],
    }))

    return users
  }),

  createUser: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return {
        id: '1',
        name: input.name,
        today: new Date(),
        map: { path: { val: { key: true } } },
      }
    }),
})

export type AppRouter = typeof appRouter
