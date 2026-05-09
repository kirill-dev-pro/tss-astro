import { useMutation, useQuery } from '@tanstack/solid-query'
import { getUntypedClient } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-solid-query'
import { createSignal, For, Match, Switch } from 'solid-js'

import type { AppRouter } from '@/lib/trpc/routes'

import { trpcClient, queryClient } from '@/lib/trpc/client'

const trpc = createTRPCOptionsProxy<AppRouter>({
  client: getUntypedClient(trpcClient),
  queryClient,
})

export default function TrpcQueryDemo() {
  const usersQuery = useQuery(
    () => trpc.userList.queryOptions(),
    () => queryClient,
  )

  const [name, setName] = createSignal('Server')
  const helloQuery = useQuery(
    () =>
      trpc.hello.queryOptions(name(), {
        networkMode: 'offlineFirst',
      }),
    () => queryClient,
  )

  const [createUserName, setCreateUserName] = createSignal('New object')
  const createUserMutation = useMutation(
    trpc.createUser.mutationOptions,
    () => queryClient,
  )

  return (
    <div class="flex flex-col gap-4 container mx-auto py-10">
      <div class="card">
        <header>
          <h3>Query with input</h3>
          <p class="text-light">
            Returns a greeting for the given name after a 1 second delay.
          </p>
        </header>
        <input
          class="border border-gray-300 rounded-md p-2"
          type="text"
          value={name()}
          onInput={(e) => setName(e.target.value)}
        />
        <p>
          Result:&nbsp;
          <span aria-busy={helloQuery.isLoading} data-spinner="small">
            {helloQuery.data}
          </span>
        </p>
      </div>

      <div class="card">
        <header>
          <h3>Query without input</h3>
          <p class="text-light">
            Returns a list of users after a 1 second delay.
          </p>
        </header>
        <p>
          {usersQuery.status}: {usersQuery.fetchStatus}
        </p>
        <Switch>
          <Match when={usersQuery.isLoading}>
            <p>Loading...</p>
          </Match>
          <Match when={usersQuery.isError}>
            <p>Error: {usersQuery.error!.message}</p>
          </Match>
          <Match when={usersQuery.isSuccess}>
            <For each={usersQuery.data}>
              {(user) => <span>{user.name} </span>}
            </For>
          </Match>
        </Switch>
        <footer>
          <button type="button" onClick={() => void usersQuery.refetch()}>
            Refetch
          </button>
        </footer>
      </div>

      <div class="card flex flex-col gap-2">
        <header>
          <h3>Mutation</h3>
          <p class="text-light">
            Returns a new user object with complex object
          </p>
        </header>
        <Switch>
          <Match when={createUserMutation.status === 'pending'}>
            <p>Loading...</p>
          </Match>
          <Match when={createUserMutation.isError}>
            <p>Error: {createUserMutation.error!.message}</p>
          </Match>
          <Match when={createUserMutation.isSuccess}>
            <p>Object name: {createUserMutation.data!.name}</p>
            <p>Today day: {createUserMutation.data?.today.getDay()}</p>
            <pre>{JSON.stringify(createUserMutation.data, null, 2)}</pre>
          </Match>
        </Switch>
        <input
          type="text"
          class="border border-gray-300 rounded-md p-2"
          value={createUserName()}
          onInput={(e) => setCreateUserName(e.target.value)}
        />
        <footer>
          <button
            type="button"
            onClick={() =>
              createUserMutation.mutate({ name: createUserName() })
            }
          >
            Create User
          </button>
        </footer>
      </div>
    </div>
  )
}
