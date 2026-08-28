import { z } from 'zod';

/**
 * Server-side list parameters (masterprompt §49).
 *
 * Pagination, filtering and sorting happen in the database from day one. The
 * alternative — fetching every row and filtering in React — works fine with the
 * five demo clients and falls over at the first customer with two thousand.
 *
 * `sort` is validated against an allow-list per feature rather than passed
 * through: a column name straight from a query string is an injection vector,
 * even through a query builder.
 */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const listParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(120).optional().catch(undefined),
  sort: z.string().max(60).optional().catch(undefined),
  dir: z.enum(['asc', 'desc']).catch('asc'),
});

export type ListParams = z.infer<typeof listParamsSchema>;

export interface ResolvedListParams<TSort extends string> {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string | undefined;
  readonly sort: TSort;
  readonly ascending: boolean;
  readonly from: number;
  readonly to: number;
}

export function resolveListParams<TSort extends string>(
  raw: Record<string, string | string[] | undefined>,
  allowedSorts: readonly TSort[],
  defaultSort: TSort,
): ResolvedListParams<TSort> {
  const parsed = listParamsSchema.parse({
    page: raw['page'],
    pageSize: raw['pageSize'],
    q: raw['q'],
    sort: raw['sort'],
    dir: raw['dir'],
  });

  const sort = allowedSorts.includes(parsed.sort as TSort)
    ? (parsed.sort as TSort)
    : defaultSort;

  const from = (parsed.page - 1) * parsed.pageSize;

  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.q && parsed.q.length > 0 ? parsed.q : undefined,
    sort,
    ascending: parsed.dir === 'asc',
    from,
    to: from + parsed.pageSize - 1,
  };
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}

export function toPage<T>(
  items: readonly T[],
  total: number,
  params: { page: number; pageSize: number },
): Page<T> {
  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/**
 * Escapes a user's search term for PostgREST's `ilike` filter.
 *
 * `%` and `_` are wildcards; a customer searching for "50%" should not match
 * everything. Commas and parentheses would break out of the filter expression.
 */
export function escapeSearchTerm(term: string): string {
  return term.replace(/[%_,()\\]/g, (match) => `\\${match}`);
}
