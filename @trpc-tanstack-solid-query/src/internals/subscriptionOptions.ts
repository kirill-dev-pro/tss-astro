import type { SkipToken } from '@tanstack/solid-query';
import { hashKey, skipToken } from '@tanstack/solid-query';
import type { TRPCClientErrorLike, TRPCUntypedClient } from '@trpc/client';
import type { TRPCConnectionState } from '@trpc/client/unstable-internals';
import type { Unsubscribable } from '@trpc/server/observable';
import type { inferAsyncIterableYield } from '@trpc/server/unstable-core-do-not-import';
import type { Accessor } from 'solid-js';
import { createEffect, onCleanup, untrack } from 'solid-js';
import { createStore } from 'solid-js/store';
import type {
  DefaultFeatureFlags,
  FeatureFlags,
  ResolverDef,
  TRPCQueryKey,
  TRPCQueryOptionsResult,
} from './types';
import { createTRPCOptionsResult, readQueryKey } from './utils';

interface BaseTRPCSubscriptionOptionsIn<TOutput, TError> {
  enabled?: boolean;
  onStarted?: () => void;
  onData?: (data: inferAsyncIterableYield<TOutput>) => void;
  onError?: (err: TError) => void;
  onConnectionStateChange?: (state: TRPCConnectionState<TError>) => void;
}

interface UnusedSkipTokenTRPCSubscriptionOptionsIn<TOutput, TError> {
  onStarted?: () => void;
  onData?: (data: inferAsyncIterableYield<TOutput>) => void;
  onError?: (err: TError) => void;
  onConnectionStateChange?: (state: TRPCConnectionState<TError>) => void;
}

interface TRPCSubscriptionOptionsOut<
  TOutput,
  TError,
  TFeatureFlags extends FeatureFlags,
> extends UnusedSkipTokenTRPCSubscriptionOptionsIn<TOutput, TError>,
    TRPCQueryOptionsResult {
  enabled: boolean;
  queryKey: TRPCQueryKey<TFeatureFlags['keyPrefix']>;
  subscribe: (
    innerOpts: UnusedSkipTokenTRPCSubscriptionOptionsIn<TOutput, TError>,
  ) => Unsubscribable;
}

export interface TRPCSubscriptionOptions<
  TDef extends ResolverDef,
  TFeatureFlags extends FeatureFlags = DefaultFeatureFlags,
> {
  (
    input: TDef['input'],
    opts?: UnusedSkipTokenTRPCSubscriptionOptionsIn<
      inferAsyncIterableYield<TDef['output']>,
      TRPCClientErrorLike<TDef>
    >,
  ): TRPCSubscriptionOptionsOut<
    inferAsyncIterableYield<TDef['output']>,
    TRPCClientErrorLike<TDef>,
    TFeatureFlags
  >;
  (
    input: TDef['input'] | SkipToken,
    opts?: BaseTRPCSubscriptionOptionsIn<
      inferAsyncIterableYield<TDef['output']>,
      TRPCClientErrorLike<TDef>
    >,
  ): TRPCSubscriptionOptionsOut<
    inferAsyncIterableYield<TDef['output']>,
    TRPCClientErrorLike<TDef>,
    TFeatureFlags
  >;
}
export type TRPCSubscriptionStatus =
  | 'idle'
  | 'connecting'
  | 'pending'
  | 'error';

export interface TRPCSubscriptionBaseResult<TOutput, TError> {
  status: TRPCSubscriptionStatus;
  data: undefined | TOutput;
  error: null | TError;
  /**
   * Reset the subscription
   */
  reset: () => void;
}

export interface TRPCSubscriptionIdleResult<TOutput>
  extends TRPCSubscriptionBaseResult<TOutput, null> {
  status: 'idle';
  data: undefined;
  error: null;
}

export interface TRPCSubscriptionConnectingResult<TOutput, TError>
  extends TRPCSubscriptionBaseResult<TOutput, TError> {
  status: 'connecting';
  data: undefined | TOutput;
  error: TError | null;
}

export interface TRPCSubscriptionPendingResult<TOutput>
  extends TRPCSubscriptionBaseResult<TOutput, undefined> {
  status: 'pending';
  data: TOutput | undefined;
  error: null;
}

export interface TRPCSubscriptionErrorResult<TOutput, TError>
  extends TRPCSubscriptionBaseResult<TOutput, TError> {
  status: 'error';
  data: TOutput | undefined;
  error: TError;
}

export type TRPCSubscriptionResult<TOutput, TError> =
  | TRPCSubscriptionIdleResult<TOutput>
  | TRPCSubscriptionConnectingResult<TOutput, TError>
  | TRPCSubscriptionErrorResult<TOutput, TError>
  | TRPCSubscriptionPendingResult<TOutput>;

type AnyTRPCSubscriptionOptionsIn =
  | BaseTRPCSubscriptionOptionsIn<unknown, unknown>
  | UnusedSkipTokenTRPCSubscriptionOptionsIn<unknown, unknown>;

type AnyTRPCSubscriptionOptionsOut<TFeatureFlags extends FeatureFlags> =
  TRPCSubscriptionOptionsOut<unknown, unknown, TFeatureFlags>;

/**
 * @internal
 */
export const trpcSubscriptionOptions = <
  TFeatureFlags extends FeatureFlags,
>(args: {
  subscribe: typeof TRPCUntypedClient.prototype.subscription;
  path: string[];
  queryKey: TRPCQueryKey<TFeatureFlags['keyPrefix']>;
  opts?: AnyTRPCSubscriptionOptionsIn;
}): AnyTRPCSubscriptionOptionsOut<TFeatureFlags> => {
  const { subscribe, path, queryKey, opts = {} } = args;
  const input = readQueryKey(queryKey)?.args?.input;
  const enabled = 'enabled' in opts ? !!opts.enabled : input !== skipToken;

  const _subscribe: ReturnType<
    TRPCSubscriptionOptions<any, TFeatureFlags>
  >['subscribe'] = (innerOpts) => {
    return subscribe(path.join('.'), input ?? undefined, innerOpts);
  };

  return {
    ...opts,
    enabled,
    subscribe: _subscribe,
    queryKey,
    trpc: createTRPCOptionsResult({ path }),
  };
};

export type MaybeAccessor<T> = T | Accessor<T>;

function toAccessor<T>(value: MaybeAccessor<T>): Accessor<T> {
  return typeof value === 'function' ? (value as Accessor<T>) : () => value;
}

export function useSubscription<TOutput, TError>(
  opts: MaybeAccessor<TRPCSubscriptionOptionsOut<TOutput, TError, any>>,
): TRPCSubscriptionResult<TOutput, TError> {
  const getOpts = toAccessor(opts);

  let currentUnsub: (() => void) | undefined;

  const o0 = untrack(() => getOpts());
  const [store, setStore] = createStore<{
    status: TRPCSubscriptionStatus;
    data: TOutput | undefined;
    error: TError | null;
  }>({
    status: o0.enabled ? 'connecting' : 'idle',
    data: undefined,
    error: null,
  });

  const restart = () => {
    currentUnsub?.();
    currentUnsub = undefined;

    const o = getOpts();
    if (!o.enabled) {
      setStore({
        status: 'idle',
        data: undefined,
        error: null,
      });
      return;
    }

    setStore({
      status: 'connecting',
      data: undefined,
      error: null,
    });

    const subscription = o.subscribe({
      onStarted: () => {
        getOpts().onStarted?.();
        setStore('status', 'pending');
        setStore('error', null as TError | null);
      },
      onData: (data) => {
        getOpts().onData?.(data);
        setStore({
          status: 'pending',
          data: data as TOutput | undefined,
          error: null,
        });
      },
      onError: (error) => {
        getOpts().onError?.(error);
        setStore({
          status: 'error',
          error,
        });
      },
      onConnectionStateChange: (result) => {
        getOpts().onConnectionStateChange?.(result);
        switch (result.state) {
          case 'connecting':
            setStore('status', 'connecting');
            setStore('error', result.error as TError | null);
            break;
          case 'pending':
            break;
          case 'idle':
            setStore({
              status: 'idle',
              data: undefined,
              error: null,
            });
            break;
        }
      },
    });

    currentUnsub = () => subscription.unsubscribe();
  };

  const reset = () => {
    restart();
  };

  createEffect(() => {
    const o = getOpts();
    void hashKey(o.queryKey);
    void o.enabled;
    restart();
    onCleanup(() => {
      currentUnsub?.();
      currentUnsub = undefined;
    });
  });

  return {
    get status() {
      return store.status;
    },
    get data() {
      return store.data;
    },
    get error() {
      return store.error;
    },
    get reset() {
      return reset;
    },
  } as TRPCSubscriptionResult<TOutput, TError>;
}
