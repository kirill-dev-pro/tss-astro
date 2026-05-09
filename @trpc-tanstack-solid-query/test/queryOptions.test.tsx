import { createQuery, skipToken, useQueryClient } from '@tanstack/solid-query';
import type { TRPCClientErrorLike } from '@trpc/client';
import type { inferRouterError } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import { createDeferred } from '@trpc/server/unstable-core-do-not-import';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { z } from 'zod';
import { testSolidResource } from './__helpers';

type Post = {
  id: string;
  title: string;
};

const testContext = (keyPrefix?: string) => {
  let iterableDeferred = createDeferred<void>();
  const nextIterable = () => {
    iterableDeferred.resolve();
    iterableDeferred = createDeferred();
  };
  const t = initTRPC.create({});

  const posts: Post[] = [{ id: '1', title: 'Hello world' }];

  const appRouter = t.router({
    post: t.router({
      byId: t.procedure
        .input(
          z.object({
            id: z.string(),
          }),
        )
        .query(() => '__result' as const),
      byIdWithSerializable: t.procedure
        .input(
          z.object({
            id: z.string(),
          }),
        )
        .query(() => ({
          id: 1,
          date: new Date(),
        })),
      iterable: t.procedure.query(async function* () {
        for (let i = 0; i < 3; i++) {
          await iterableDeferred.promise;
          yield i + 1;
        }
      }),
      list: t.procedure.query(() => posts),
    }),
  });

  return {
    ...testSolidResource(appRouter, {
      keyPrefix,
    }),
    nextIterable,
  };
};

describe.each(['user-123', undefined])(
  'queryOptions with keyPrefix: %s',
  (keyPrefix) => {
    test('basic', async () => {
      await using ctx = testContext(keyPrefix);

      const { useTRPC } = ctx;
      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const qo = trpc.post.byId.queryOptions({ id: '1' });
        expect(qo.trpc.path).toBe('post.byId');
        const query1 = createQuery(
          () => trpc.post.byId.queryOptions({ id: '1' }),
          () => queryClient,
        );

        const query2 = createQuery(
          () => trpc.post.byId.queryOptions({ id: '1' }),
          () => queryClient,
        );
        expectTypeOf(query1).toMatchTypeOf(query2);

        if (query1.data) {
          expectTypeOf(query1.data).toMatchTypeOf<'__result'>();
          expectTypeOf(query1.error).toMatchTypeOf<TRPCClientErrorLike<{
            transformer: false;
            errorShape: inferRouterError<typeof ctx.router>;
          }> | null>();
        }

        return (
          <pre>
            {query1.status}:{query1.fetchStatus}:
            {JSON.stringify(query1.data ?? null, null, 0)}
          </pre>
        );
      }

      const utils = ctx.renderApp(() => <MyComponent />);
      await vi.waitFor(() => {
        expect(utils.container.textContent).toContain('__result');
      });
    });

    test('select', async () => {
      await using ctx = testContext(keyPrefix);

      const { useTRPC } = ctx;
      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const qo = trpc.post.byId.queryOptions(
          { id: '1' },
          {
            select: (data) => `mutated${data}` as const,
          },
        );
        expect(qo.trpc.path).toBe('post.byId');
        const query1 = createQuery(
          () =>
            trpc.post.byId.queryOptions(
              { id: '1' },
              {
                select: (data) => `mutated${data}` as const,
              },
            ),
          () => queryClient,
        );

        if (query1.data) {
          expectTypeOf(query1.data).toMatchTypeOf<'mutated__result'>();
        }

        return (
          <pre>
            {query1.status}:{query1.fetchStatus}:
            {JSON.stringify(query1.data ?? null, null, 0)}
          </pre>
        );
      }

      const utils = ctx.renderApp(() => <MyComponent />);
      await vi.waitFor(() => {
        expect(utils.container.textContent).toContain('mutated__result');
      });
    });

    test('initialData', async () => {
      await using ctx = testContext(keyPrefix);

      const { useTRPC } = ctx;
      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const qo = trpc.post.byId.queryOptions(
          { id: '1' },
          { initialData: '__result' },
        );
        expect(qo.trpc.path).toBe('post.byId');
        const query1 = createQuery(
          () =>
            trpc.post.byId.queryOptions(
              { id: '1' },
              { initialData: '__result' },
            ),
          () => queryClient,
        );

        expectTypeOf(query1.data).toEqualTypeOf<'__result'>();

        return (
          <pre>
            {query1.status}:{query1.fetchStatus}:
            {JSON.stringify(query1.data ?? 'n/a', null, 4)}
          </pre>
        );
      }

      const utils = ctx.renderApp(() => <MyComponent />);
      await vi.waitFor(() => {
        expect(utils.container).toHaveTextContent(`__result`);
      });
    });

    test('disabling query with skipToken', async () => {
      await using ctx = testContext(keyPrefix);

      const { useTRPC } = ctx;
      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const options = trpc.post.byId.queryOptions(skipToken);
        const query1 = createQuery(() => options, () => queryClient);

        const query2 = createQuery(
          () => trpc.post.byId.queryOptions(skipToken),
          () => queryClient,
        );

        expectTypeOf(query1.data).toMatchTypeOf<'__result' | undefined>();
        expectTypeOf(query2.data).toMatchTypeOf<'__result' | undefined>();

        return <pre>{query1.status}</pre>;
      }

      const utils = ctx.renderApp(() => <MyComponent />);
      await vi.waitFor(() => {
        expect(utils.container).toHaveTextContent(`pending`);
      });
    });

    test('regression #6701: disabling query with skipToken', async () => {
      await using ctx = testContext(keyPrefix);

      const { useTRPC } = ctx;
      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();

        const skipQueryOptions = trpc.post.byId.queryOptions(skipToken);
        createQuery(() => skipQueryOptions, () => queryClient);
        createQuery(
          () => ({
            queryKey: [],
            queryFn: skipToken,
          }),
          () => queryClient,
        );
      }

      expect(MyComponent).toBeDefined();
    });

    test('with extra `trpc` context', async () => {
      await using ctx = testContext(keyPrefix);

      const context = {
        __TEST__: true,
      };

      const { useTRPC } = ctx;
      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const qo = trpc.post.byId.queryOptions(
          { id: '1' },
          { trpc: { context } },
        );
        expect(qo.trpc.path).toBe('post.byId');
        const query1 = createQuery(
          () =>
            trpc.post.byId.queryOptions(
              { id: '1' },
              { trpc: { context } },
            ),
          () => queryClient,
        );

        if (query1.data) {
          expectTypeOf(query1.data).toMatchTypeOf<'__result'>();
        }

        return (
          <pre>
            {query1.status}:{query1.fetchStatus}:
            {JSON.stringify(query1.data ?? null, null, 0)}
          </pre>
        );
      }

      const utils = ctx.renderApp(() => <MyComponent />);
      await vi.waitFor(() => {
        expect(utils.container.textContent).toContain('__result');
      });

      expect(ctx.linkSpy.up.mock.calls[0]![0].context).toMatchObject(context);
    });

    test(
      'iterable',
      async () => {
      await using ctx = testContext(keyPrefix);

      const { useTRPC } = ctx;
      const states: {
        status: string;
        data: unknown;
        fetchStatus: string;
      }[] = [];
      const selects: number[][] = [];

      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const query1 = createQuery(
          () =>
            trpc.post.iterable.queryOptions(undefined, {
              select(data) {
                expectTypeOf<number[]>(data);
                selects.push([...data]);
                return data;
              },
              trpc: {
                context: {
                  stream: 1,
                },
              },
            }),
          () => queryClient,
        );
        states.push({
          status: query1.status,
          data: query1.data,
          fetchStatus: query1.fetchStatus,
        });

        expectTypeOf(query1.data).toEqualTypeOf<undefined | number[]>();

        return (
          <pre>
            {query1.status}:{query1.fetchStatus}:
            {JSON.stringify(query1.data ?? null)}
          </pre>
        );
      }

      const utils = ctx.renderApp(() => <MyComponent />);
      for (let i = 0; i < 10; i++) {
        ctx.nextIterable();
        await new Promise((r) => setTimeout(r, 5));
      }
      await vi.waitFor(
        () => {
          expect(selects.at(-1)).toEqual([1, 2, 3]);
        },
        { timeout: 15_000 },
      );
      expect(selects[0]).toEqual([]);

      const t = utils.container.textContent ?? '';
      expect(t.startsWith('success:')).toBe(true);
      expect(states).toMatchSnapshot();
    },
    15_000);

    test('createQuery resolves post.byId', async () => {
      await using ctx = testContext(keyPrefix);

      const { useTRPC } = ctx;
      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const q = createQuery(
          () => trpc.post.byId.queryOptions({ id: '1' }),
          () => queryClient,
        );

        if (q.data) {
          expectTypeOf(q.data).toMatchTypeOf<'__result'>();
        }

        return (
          <pre>
            {q.status}:{q.fetchStatus}:{JSON.stringify(q.data ?? null, null, 0)}
          </pre>
        );
      }

      const utils = ctx.renderApp(() => <MyComponent />);
      await vi.waitFor(() => {
        expect(utils.container.textContent).toContain('__result');
      });
    });

    test('does not fetch if called from router directly', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      await using ctx = testContext(keyPrefix);

      fetchSpy.mockClear();
      const post = await ctx.queryClient.fetchQuery(
        ctx.optionsProxyServer.post.byId.queryOptions({ id: '1' }),
      );

      expect(post).toEqual('__result');

      expect(fetchSpy).toHaveBeenCalledTimes(0);
    });

    test('initialData inference', async () => {
      await using ctx = testContext(keyPrefix);

      const { useTRPC } = ctx;
      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const qo = trpc.post.list.queryOptions(undefined, {
          initialData: [],
        });
        expect(qo.trpc.path).toBe('post.list');
        const query1 = createQuery(
          () =>
            trpc.post.list.queryOptions(undefined, {
              initialData: [],
            }),
          () => queryClient,
        );

        expectTypeOf(query1.data).toEqualTypeOf<Post[]>();

        return (
          <pre>
            {query1.status}
            {query1.fetchStatus}
            {JSON.stringify(query1.data ?? 'n/a', null, 4)}
          </pre>
        );
      }

      const utils = ctx.renderApp(() => <MyComponent />);
      await vi.waitFor(() => {
        expect(utils.container).toHaveTextContent('Hello world');
      });
    });

    test('initialData inference + select', async () => {
      await using ctx = testContext(keyPrefix);
      const noPostSymbol = Symbol('noPost');

      const { useTRPC } = ctx;
      function MyComponent() {
        const trpc = useTRPC();
        const queryClient = useQueryClient();
        const qo = trpc.post.list.queryOptions(undefined, {
          initialData: [],
          select: (data) => data[0] ?? noPostSymbol,
        });
        expect(qo.trpc.path).toBe('post.list');
        const query1 = createQuery(
          () =>
            trpc.post.list.queryOptions(undefined, {
              initialData: [],
              select: (data) => data[0] ?? noPostSymbol,
            }),
          () => queryClient,
        );

        expectTypeOf(query1.data).toEqualTypeOf<Post | typeof noPostSymbol>();

        return (
          <pre>
            {query1.status}
            {query1.fetchStatus}
            {JSON.stringify(query1.data ?? 'n/a', null, 4)}
          </pre>
        );
      }

      const utils = ctx.renderApp(() => <MyComponent />);
      await vi.waitFor(() => {
        expect(utils.container).toHaveTextContent('Hello world');
      });
    });
  },
);
