import { describe, expect, it } from 'vitest';
import { escapeSearchTerm, resolveListParams, toPage } from './pagination';

const SORTS = ['name', 'created_at'] as const;

describe('resolveListParams', () => {
  it('applies sensible defaults for an empty query string', () => {
    const result = resolveListParams({}, SORTS, 'name');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.sort).toBe('name');
    expect(result.ascending).toBe(true);
    expect(result.search).toBeUndefined();
  });

  it('computes the database range from the page number', () => {
    const result = resolveListParams({ page: '3', pageSize: '10' }, SORTS, 'name');
    expect(result.from).toBe(20);
    expect(result.to).toBe(29);
  });

  it('falls back to the default sort for an unknown column', () => {
    // A column name straight from a query string must never reach the query
    // builder, however harmless it looks.
    const result = resolveListParams({ sort: 'password_hash' }, SORTS, 'name');
    expect(result.sort).toBe('name');
  });

  it('falls back to the default sort for an injection attempt', () => {
    const result = resolveListParams({ sort: 'name; drop table clients' }, SORTS, 'name');
    expect(result.sort).toBe('name');
  });

  it('caps the page size so one request cannot pull the whole table', () => {
    const result = resolveListParams({ pageSize: '100000' }, SORTS, 'name');
    expect(result.pageSize).toBe(25);
  });

  it('recovers from nonsense instead of throwing', () => {
    // A stale bookmark with garbage parameters should render page one, not a
    // 500. `.catch()` on each field is what makes that true.
    const result = resolveListParams(
      { page: 'abc', pageSize: '-4', dir: 'sideways' },
      SORTS,
      'name',
    );
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.ascending).toBe(true);
  });

  it('reads the descending direction', () => {
    const result = resolveListParams({ dir: 'desc', sort: 'created_at' }, SORTS, 'name');
    expect(result.ascending).toBe(false);
    expect(result.sort).toBe('created_at');
  });

  it('treats a blank search as no search', () => {
    expect(resolveListParams({ q: '   ' }, SORTS, 'name').search).toBeUndefined();
  });
});

describe('escapeSearchTerm', () => {
  it('escapes wildcards so a literal search stays literal', () => {
    // Searching for "50%" must not behave like "match anything".
    expect(escapeSearchTerm('50%')).toBe('50\\%');
    expect(escapeSearchTerm('a_b')).toBe('a\\_b');
  });

  it('escapes characters that would break out of the filter expression', () => {
    expect(escapeSearchTerm('a,b')).toBe('a\\,b');
    expect(escapeSearchTerm('(x)')).toBe('\\(x\\)');
  });

  it('leaves ordinary names untouched', () => {
    expect(escapeSearchTerm('Jansen')).toBe('Jansen');
    expect(escapeSearchTerm("O'Brien")).toBe("O'Brien");
  });
});

describe('toPage', () => {
  it('computes the page count', () => {
    expect(toPage([], 51, { page: 1, pageSize: 25 }).pageCount).toBe(3);
  });

  it('reports one page when there is nothing to show', () => {
    // Zero pages would render "page 1 of 0", which reads like a bug.
    expect(toPage([], 0, { page: 1, pageSize: 25 }).pageCount).toBe(1);
  });
});
