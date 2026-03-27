import { describe, it, expect } from 'vitest';
import { buildSearchQueries, buildFederalSearchQueries, webSearch } from '../../src/research/web-search.js';

describe('buildSearchQueries', () => {
  it('returns queries for a province and NOC code', () => {
    const queries = buildSearchQueries('Ontario', '21301');
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.some(q => q.includes('Ontario'))).toBe(true);
    expect(queries.some(q => q.includes('21301'))).toBe(true);
  });

  it('includes PNP and immigration terms', () => {
    const queries = buildSearchQueries('Alberta', '00012');
    expect(queries.some(q => q.includes('PNP') || q.includes('Provincial Nominee'))).toBe(true);
  });
});

describe('buildFederalSearchQueries', () => {
  it('returns queries with current year', () => {
    const queries = buildFederalSearchQueries();
    const year = String(new Date().getFullYear());
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every(q => q.includes(year))).toBe(true);
  });

  it('includes Express Entry and federal programs', () => {
    const queries = buildFederalSearchQueries();
    expect(queries.some(q => q.includes('Express Entry'))).toBe(true);
    expect(queries.some(q => q.includes('Atlantic'))).toBe(true);
  });
});

describe('webSearch', () => {
  it('returns empty array when no API configured', async () => {
    const result = await webSearch('test query', {} as any);
    expect(result).toEqual([]);
  });

  it('returns empty array for unknown provider', async () => {
    const result = await webSearch('test', { search_api: { provider: 'unknown', api_key: 'key' } } as any);
    expect(result).toEqual([]);
  });
});
