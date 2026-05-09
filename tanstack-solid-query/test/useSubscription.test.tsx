import { EventEmitter, on } from 'node:events';
import { fireEvent } from '@solidjs/testing-library';
import { httpSubscriptionLink, wsLink } from '@trpc/client';
import { initTRPC } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { makeResource } from '@trpc/server/unstable-core-do-not-import';
import { createSignal } from 'solid-js';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { z } from 'zod';
import type { TRPCSubscriptionResult } from '../src';
import { useSubscription } from '../src';
import { testSolidResource } from './__helpers';

/* eslint-disable no-console */
export const suppressLogs = () => {
  const log = console.log;
  const error = console.error;
  const noop = () => {
    // ignore
  };
  console.log = noop;
  console.error = noop;

  function cleanup() {
    console.log = log;
    console.error = error;
  }

  return makeResource(cleanup, cleanup);
};

/**
 * Pause logging until the promise resolves or throws
 */
export const suppressLogsUntil = async (fn: () => Promise<void>) => {
  using _ = suppressLogs();

  await fn();
};

/**
 * a function that displays the diff over time in a list of values
 */
function diff(list: any[]) {
  return list.map((item, index) => {
    if (index === 0) return item;

    const prev = list[index - 1]!;
    const diff = {} as any;
    for (const key in item) {
      if (item[key] !== prev[key]) {
        diff[key] = item[key];
      }
    }
    return diff;
  });
}

const getCtx = (protocol: 'http' | 'ws') => {
  const abortState: Record<number, 'aborted'> = {};

  const ee = new EventEmitter();
  const t = initTRPC.create({
    errorFormatter({ shape }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          foo: 'bar' as const,
        },
      };
    },
  });
  const appRouter = t.router({
    onEventIterable: t.procedure
      .input(z.number())
      .subscription(async function* (opts) {
        try {
          for await (const event of on(ee, 'data', {
            signal: opts.signal,
          })) {
            const data = event[0] as number;
            yield data + opts.input;
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            abortState[opts.input] = 'aborted';
          }
          throw err;
        }
      }),
    /**
     * @deprecated delete in v12
     */
    onEventObservable: t.procedure
      .input(z.number())
      .subscription(({ input }) => {
        return observable<number>((emit) => {
          const onData = (data: number) => {
            emit.next(data + input);
          };
          ee.on('data', onData);
          return () => {
            ee.off('data', onData);
          };
        });
      }),
  });

  const ctx = testSolidResource(appRouter, {
    client(opts) {
      return {
        links: [
          protocol === 'http'
            ? httpSubscriptionLink({
                url: opts.httpUrl,
              })
            : wsLink({
                client: opts.wsClient,
              }),
        ],
      };
    },
  });

  return {
    ...ctx,
    ee,
    abortState,
  };
};

describe.each([
  //
  'http',
  'ws',
] as const)('useSubscription - %s', (protocol) => {
  test('iterable', async () => {
    await using ctx = getCtx(protocol);
    const onDataMock = vi.fn();
    const onErrorMock = vi.fn();

    const { useTRPC } = ctx;

    function MyComponent() {
      const [enabled, setEnabled] = createSignal(true);

      const trpc = useTRPC();
      const result = useSubscription(() =>
        trpc.onEventIterable.subscriptionOptions(10, {
          enabled: enabled(),
          onData: (data) => {
            expectTypeOf(data).toMatchTypeOf<number>();
            onDataMock(data);
          },
          onError: onErrorMock,
        }),
      );

      return (
        <>
          <button
            onClick={() => {
              setEnabled(!enabled());
            }}
            data-testid="toggle-enabled"
          >
            toggle enabled
          </button>
          <div>status:{result.status}</div>
          <div>error:{result.error?.message}</div>
          <div>data:{result.data ?? 'NO_DATA'}</div>
        </>
      );
    }

    const utils = ctx.renderApp(() => <MyComponent />);

    await vi.waitFor(() => {
      const t = utils.container.textContent ?? '';
      expect(t.includes('status:connecting') || t.includes('status:pending')).toBe(
        true,
      );
    });
    expect(onDataMock).toHaveBeenCalledTimes(0);
    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`status:pending`);
    });
    ctx.ee.emit('data', 20);

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`data:30`);
    });

    await vi.waitFor(() => {
      expect(onDataMock).toHaveBeenCalledTimes(1);
    });
    expect(onDataMock.mock.calls[0]?.[0]).toEqual(30);
    expect(onDataMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock).toHaveBeenCalledTimes(0);

    fireEvent.click(utils.getByTestId('toggle-enabled'));

    await vi.waitFor(() => {
      if (protocol === 'http') {
        expect(ctx.onReqAborted).toHaveBeenCalledTimes(1);
      } else {
        ctx.wsClient.close();
        expect(ctx.wss.clients.size).toBe(0);
      }
    });

    // we need to emit data to trigger unsubscribe
    ctx.ee.emit('data', 40);

    await vi.waitFor(() => {
      // no event listeners
      expect(ctx.ee.listenerCount('data')).toBe(0);
    });
  });

  test('observable()', async () => {
    await using ctx = getCtx(protocol);

    const onDataMock = vi.fn();
    const onErrorMock = vi.fn();

    const { useTRPC } = ctx;

    function MyComponent() {
      const [data, setData] = createSignal<number>();
      const [enabled, setEnabled] = createSignal(true);

      const trpc = useTRPC();
      const result = useSubscription(() =>
        trpc.onEventObservable.subscriptionOptions(10, {
          enabled: enabled(),
          onData: (d) => {
            expectTypeOf(d).toMatchTypeOf<number>();
            onDataMock(d);
            setData(d);
          },
          onError: onErrorMock,
        }),
      );

      return (
        <>
          <button
            onClick={() => {
              setEnabled(!enabled());
            }}
            data-testid="toggle-enabled"
          >
            toggle enabled
          </button>
          <div>status:{result.status}</div>
          <div>data:{data() ?? 'NO_DATA'}</div>
        </>
      );
    }

    const utils = ctx.renderApp(() => <MyComponent />);

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`status:pending`);
    });
    ctx.ee.emit('data', 20);
    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`data:30`);
    });
    expect(onDataMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock).toHaveBeenCalledTimes(0);

    fireEvent.click(utils.getByTestId('toggle-enabled'));

    await vi.waitFor(() => {
      // no event listeners
      expect(ctx.ee.listenerCount('data')).toBe(0);
    });
  });
});

describe.skip('connection state - http', () => {
  test('iterable', async () => {
    await using ctx = getCtx('http');

    const onConnectionStateChangeMock = vi.fn();

    const { useTRPC } = ctx;

    const queryResult: unknown[] = [];

    function MyComponent() {
      const trpc = useTRPC();
      const result = useSubscription(
        trpc.onEventIterable.subscriptionOptions(10, {
          onData: () => {
            // noop
          },
          onConnectionStateChange: onConnectionStateChangeMock,
        }),
      );

      queryResult.push({
        status: result.status,
        data: result.data,
        error: result.error,
        reset: result.reset,
      });

      return (
        <>
          <>status:{result.status}</>
          <>data:{result.data}</>
        </>
      );
    }

    const utils = ctx.renderApp(() => <MyComponent />);

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`status:pending`);
    });
    // emit
    ctx.ee.emit('data', 20);

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`data:30`);
    });

    const d1 = diff(queryResult);
    expect(d1[0]).toMatchObject({
      data: undefined,
      error: null,
      status: 'connecting',
    });
    const pendingStep = d1.find((x) => x && (x as any).status === 'pending');
    expect(pendingStep).toBeDefined();
    expect(d1.some((x) => (x as any)?.data === 30)).toBe(true);
    queryResult.length = 0;

    await suppressLogsUntil(async () => {
      ctx.destroyConnections();

      expect(onConnectionStateChangeMock).toHaveBeenCalled();

      await vi.waitFor(() => {
        expect(utils.container).toHaveTextContent('status:connecting');
      });
    });

    await vi.waitFor(
      () => {
        expect(utils.container).toHaveTextContent('status:pending');
      },
      {
        timeout: 5_000,
      },
    );

    const d2 = diff(queryResult);
    expect(d2[0]).toMatchObject({
      data: 30,
      status: 'connecting',
    });
    expect(d2[0]?.error).toBeInstanceOf(Error);
    expect(d2[1]).toMatchObject({
      error: null,
      status: 'pending',
    });

    queryResult.length = 0;
    // emit
    ctx.ee.emit('data', 40);

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent('data:50');
    });
    const d3 = diff(queryResult);
    expect(d3[0]).toMatchObject({
      data: 50,
      error: null,
      status: 'pending',
    });

    utils.unmount();
  });
});

describe('http', () => {
  test('aborts on useSubscription restarts', async () => {
    await using ctx = getCtx('http');

    const { useTRPC } = ctx;

    function MyComponent(props: { input: number }) {
      const trpc = useTRPC();
      const result = useSubscription(() =>
        trpc.onEventIterable.subscriptionOptions(props.input, {
          onData: (data) => {
            expectTypeOf(data).toMatchTypeOf<number>();
          },
        }),
      );

      return (
        <>
          <div>status:{result.status}</div>
          <div>error:{result.error?.message}</div>
          <div>data:{result.data ?? 'NO_DATA'}</div>
        </>
      );
    }

    let utils = ctx.renderApp(() => <MyComponent input={1} />);
    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`status:pending`);
    });
    // emit
    ctx.ee.emit('data', 10);

    await vi.waitFor(
      () => {
        expect(utils.container).toHaveTextContent('data:11');
      },
      {
        timeout: 5_000,
      },
    );

    utils = ctx.rerenderApp(utils, () => <MyComponent input={2} />);
    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`status:pending`);
    });
    // emit
    ctx.ee.emit('data', 10);

    await vi.waitFor(
      () => {
        expect(utils.container).toHaveTextContent('data:12');
      },
      {
        timeout: 5_000,
      },
    );

    await vi.waitFor(() => {
      expect(ctx.abortState).toEqual({
        1: 'aborted',
      });
    });

    utils.unmount();

    await vi.waitFor(() => {
      expect(ctx.abortState).toEqual({
        1: 'aborted',
        2: 'aborted',
      });
    });
  });

  test.skip('rset - iterable', async () => {
    await using ctx = getCtx('http');
    const { useTRPC } = ctx;

    const queryResult: TRPCSubscriptionResult<number, unknown>[] = [];

    function MyComponent() {
      const trpc = useTRPC();
      const result = useSubscription(
        trpc.onEventIterable.subscriptionOptions(10, {
          onData: () => {
            // noop
          },
        }),
      );

      queryResult.push({
        status: result.status,
        data: result.data,
        error: result.error,
        reset: result.reset,
      });

      return (
        <>
          <>status:{result.status}</>
          <>data:{result.data}</>
          {/* reset button */}
          <button
            onClick={() => {
              result.reset();
            }}
            data-testid="reset"
          >
            reset
          </button>
        </>
      );
    }

    const utils = ctx.renderApp(() => <MyComponent />);

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`status:pending`);
    });
    // emit
    ctx.ee.emit('data', 20);

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`data:30`);
    });

    queryResult.length = 0;

    // click reset
    fireEvent.click(utils.getByTestId('reset'));
    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent('status:connecting');
    });

    expect(queryResult[0]?.data).toBeUndefined();

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent('status:pending');
    });

    const dr = diff(queryResult);
    const connecting = dr.find(
      (x) => x && (x as any).status === 'connecting',
    );
    expect(connecting).toMatchObject({
      data: undefined,
      error: null,
      status: 'connecting',
    });
    expect(dr.some((x) => (x as any)?.status === 'pending')).toBe(true);

    utils.unmount();
  });

  test('sub - tracked key', async () => {
    await using ctx = getCtx('http');
    const { useTRPC } = ctx;

    function MyComponent() {
      const trpc = useTRPC();
      const result1 = useSubscription(
        trpc.onEventIterable.subscriptionOptions(10),
      );
      const result2 = useSubscription(
        trpc.onEventIterable.subscriptionOptions(10),
      );

      return (
        <>
          <>status1:{result1.status}</>
          <>status2:{result2.status}</>
          {/* Delay access to result2.data until status1 is resolved */}
          <>data:{result1.data ? result2.data : null}</>
        </>
      );
    }

    const utils = ctx.renderApp(() => <MyComponent />);

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`status1:pending`);
      expect(utils.container).toHaveTextContent(`status2:pending`);
      expect(utils.container).toHaveTextContent(`data:`);
    });
    // emit
    ctx.ee.emit('data', 20);

    await vi.waitFor(() => {
      expect(utils.container).toHaveTextContent(`data:30`);
    });

    utils.unmount();
  });
});
