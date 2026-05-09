import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import type { TestServerAndClientResourceOpts } from './fixtures/testClientResource';
import { testServerAndClientResource } from './fixtures/testClientResource';
import { getUntypedClient } from '@trpc/client';
import type { AnyTRPCRouter } from '@trpc/server';
import type { JSX } from 'solid-js';
import { render } from '@solidjs/testing-library';
import type { ofFeatureFlags } from '../src';
import { createTRPCContext, createTRPCOptionsProxy } from '../src';

export function testSolidResource<
  TRouter extends AnyTRPCRouter,
  TExtras extends {
    keyPrefix?: string;
  },
>(
  appRouter: TRouter,
  opts?: TestServerAndClientResourceOpts<TRouter> & TExtras,
) {
  const ctx = testServerAndClientResource(appRouter, opts);

  const queryClient = new QueryClient();

  type $Flags = undefined extends TExtras['keyPrefix']
    ? ofFeatureFlags<{ keyPrefix: false }>
    : ofFeatureFlags<{ keyPrefix: true }>;

  const keyPrefix = opts?.keyPrefix as any;

  const optionsProxyClient = createTRPCOptionsProxy<TRouter, $Flags>({
    client: getUntypedClient(ctx.client),
    queryClient,
    keyPrefix,
  });

  const optionsProxyServer = createTRPCOptionsProxy<TRouter, $Flags>({
    router: appRouter,
    ctx: {},
    queryClient,
    keyPrefix,
  });

  const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<
    TRouter,
    $Flags
  >();

  function renderApp(ui: () => JSX.Element) {
    return render(() => (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider
          trpcClient={ctx.client}
          queryClient={queryClient}
          keyPrefix={keyPrefix}
        >
          {ui()}
        </TRPCProvider>
      </QueryClientProvider>
    ));
  }

  function rerenderApp(
    prev: ReturnType<typeof renderApp>,
    ui: () => JSX.Element,
  ) {
    prev.unmount();
    return renderApp(ui);
  }

  return {
    ...ctx,
    opts: ctx,
    queryClient,
    renderApp,
    rerenderApp,
    useTRPC,
    useTRPCClient,
    optionsProxyClient,
    optionsProxyServer,
    /** @deprecated use resource manager instead */
    close: ctx.close,
  };
}
