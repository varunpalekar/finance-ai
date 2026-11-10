import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TijoriScreener } from '../src/client/TijoriScreener.js';

test('TijoriScreener enforces query parameter on searchScreenerFields', async () => {
  const screener = new TijoriScreener({ _fetch: async () => {}, cacheEnabled: false });
  await assert.rejects(
    () => screener.searchScreenerFields({ query: '' }),
    /query is required/
  );
});

test('TijoriScreener handles null filters in screenCompanies without crashing', async () => {
  const screener = new TijoriScreener({
    _fetch: async () => ({
      isCached: false,
      response: {
        json: async () => ({ total_results: 0, data: [] }),
      },
    }),
    cacheEnabled: false,
  });

  const res = await screener.screenCompanies({
    filters: null,
    alternate: 'market share > 10',
  });
  assert.equal(res.total_results, 0);
  assert.equal(res.alternate_query, 'market share > 10');
});
