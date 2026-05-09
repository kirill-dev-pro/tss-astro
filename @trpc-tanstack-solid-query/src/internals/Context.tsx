import type { QueryClient } from '@tanstack/solid-query';
import type { TRPCClient } from '@trpc/client';
import type { AnyTRPCRouter } from '@trpc/server';
import type { Component, ParentProps } from 'solid-js';
import { createContext, createMemo, useContext } from 'solid-js';

import type { TRPCOptionsProxy } from './createOptionsProxy';
import { createTRPCOptionsProxy } from './createOptionsProxy';
import type {
  DefaultFeatureFlags,
  FeatureFlags,
  KeyPrefixOptions,
} from './types';

type TRPCProviderProps<
  TRouter extends AnyTRPCRouter,
  TFeatureFlags extends FeatureFlags,
> = ParentProps &
  KeyPrefixOptions<TFeatureFlags> & {
    queryClient: QueryClient;
    trpcClient: TRPCClient<TRouter>;
  };

export interface CreateTRPCContextResult<
  TRouter extends AnyTRPCRouter,
  TFeatureFlags extends FeatureFlags = DefaultFeatureFlags,
> {
  TRPCProvider: Component<TRPCProviderProps<TRouter, TFeatureFlags>>;
  useTRPC: () => TRPCOptionsProxy<TRouter, TFeatureFlags>;
  useTRPCClient: () => TRPCClient<TRouter>;
}

/**
 * Create a set of type-safe provider-consumers
 *
 * @see https://trpc.io/docs/client/tanstack-react-query/setup#3a-setup-the-trpc-context-provider
 */
export function createTRPCContext<
  TRouter extends AnyTRPCRouter,
  TFeatureFlags extends FeatureFlags = DefaultFeatureFlags,
>(): CreateTRPCContextResult<TRouter, TFeatureFlags> {
  const TRPCClientContext = createContext<TRPCClient<TRouter> | null>(null);
  const TRPCContext = createContext<TRPCOptionsProxy<
    TRouter,
    TFeatureFlags
  > | null>(null);

  const TRPCProvider: Component<TRPCProviderProps<TRouter, TFeatureFlags>> = (
    props,
  ) => {
    const value = createMemo(() =>
      createTRPCOptionsProxy<TRouter, TFeatureFlags>({
        client: props.trpcClient,
        queryClient: props.queryClient,
        keyPrefix: props.keyPrefix as any,
      }),
    );
    return (
      <TRPCClientContext.Provider value={props.trpcClient}>
        <TRPCContext.Provider value={value()}>
          {props.children}
        </TRPCContext.Provider>
      </TRPCClientContext.Provider>
    );
  };

  function useTRPC() {
    const utils = useContext(TRPCContext);
    if (utils == null) {
      throw new Error('useTRPC() can only be used inside of a <TRPCProvider>');
    }
    return utils;
  }

  function useTRPCClient() {
    const client = useContext(TRPCClientContext);
    if (client == null) {
      throw new Error(
        'useTRPCClient() can only be used inside of a <TRPCProvider>',
      );
    }
    return client;
  }

  return { TRPCProvider, useTRPC, useTRPCClient } as CreateTRPCContextResult<
    TRouter,
    TFeatureFlags
  >;
}
