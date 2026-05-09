import type {
  InfiniteQueryOptions,
  QueryFunction,
  QueryKey,
  QueryOptions,
  SkipToken,
} from '@tanstack/solid-query';
import type { DistributiveOmit } from '@trpc/server/unstable-core-do-not-import';

/** Unwrapped option shapes (Solid's exported *Options types are `Accessor<...>` for hooks). */
export type SolidUndefinedInitialDataOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
> = QueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
  initialData?: undefined;
};

export type SolidDefinedInitialDataOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
> = QueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
  initialData: TData | (() => TData);
};

export type SolidUnusedSkipTokenOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
> = DistributiveOmit<
  QueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  'queryFn'
> & {
  queryFn?: QueryFunction<TQueryFnData, TQueryKey> | SkipToken;
};

export type SolidUndefinedInitialDataInfiniteOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
  TPageParam,
> = InfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam> & {
  initialData?: undefined;
};

export type SolidDefinedInitialDataInfiniteOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
  TPageParam,
> = InfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam> & {
  initialData: TData | (() => TData);
};

export type SolidUnusedSkipTokenInfiniteOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
  TPageParam,
> = DistributiveOmit<
  InfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>,
  'queryFn'
> & {
  queryFn?:
    | QueryFunction<TQueryFnData, TQueryKey, TPageParam>
    | SkipToken;
};
