import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchDocument } from '../src/client/TijoriDocumentFetcher.js';

test('TijoriDocumentFetcher rejects non-HTTPS or non-Tijori hostnames', async () => {
  const mockContext = { cacheEnabled: false };
  await assert.rejects(
    () => fetchDocument(mockContext, 'http://files.tijorifinance.com/doc.pdf'),
    /Only HTTPS URLs are supported/
  );
  await assert.rejects(
    () => fetchDocument(mockContext, 'https://evil.com/doc.pdf'),
    /Only files\.tijorifinance\.com URLs are supported/
  );
});
