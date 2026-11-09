import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { client, pplxClient, server } from '../src/index.js';
import { initDb } from '../src/cache.js';

initDb(':memory:');

test('MCP protocol lists tools, forwards arguments, validates inputs, wraps errors, and returns auth status', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const protocolClient = new Client({ name: 'protocol-contract-test', version: '1.0.0' });
  const originalMethods = {
    getFinancials: client.getFinancials,
    getUserInfo: client.getUserInfo,
    getCompanyStrategicProfile: pplxClient.getCompanyStrategicProfile
  };
  let forwarded;

  client.getFinancials = async (slug, type, options) => {
    forwarded = { slug, type, basis: options.basis };
    return forwarded;
  };
  client.getUserInfo = async () => ({ is_authenticated: false, plan_tier: 'anonymous' });
  pplxClient.getCompanyStrategicProfile = async () => {
    const error = new Error('Controlled provider failure');
    error.code = 'PROVIDER_FAILURE';
    throw error;
  };

  try {
    await server.connect(serverTransport);
    await protocolClient.connect(clientTransport);

    const { tools } = await protocolClient.listTools();
    assert.equal(tools.length, 33);
    assert.equal(new Set(tools.map(tool => tool.name)).size, tools.length);
    assert.deepEqual(tools.find(tool => tool.name === 'get_financials').inputSchema.properties.basis.enum, [
      'consolidated',
      'standalone'
    ]);

    const financialResult = await protocolClient.callTool({
      name: 'get_financials',
      arguments: { slug: 'nested-balance-sheet', type: 'bs', basis: 'standalone' }
    });
    assert.deepEqual(JSON.parse(financialResult.content[0].text), {
      slug: 'nested-balance-sheet',
      type: 'bs',
      basis: 'standalone'
    });
    assert.deepEqual(forwarded, {
      slug: 'nested-balance-sheet',
      type: 'bs',
      basis: 'standalone'
    });

    let invalidBasisRejected = false;
    try {
      const invalid = await protocolClient.callTool({
        name: 'get_financials',
        arguments: { slug: 'nested-balance-sheet', type: 'bs', basis: 'invalid' }
      });
      invalidBasisRejected = invalid.isError === true;
    } catch (error) {
      invalidBasisRejected = error.code === -32602;
    }
    assert.equal(invalidBasisRejected, true);

    const authResult = await protocolClient.callTool({ name: 'get_user_info', arguments: {} });
    assert.deepEqual(JSON.parse(authResult.content[0].text), {
      is_authenticated: false,
      plan_tier: 'anonymous'
    });

    const failedResult = await protocolClient.callTool({
      name: 'get_company_strategic_profile',
      arguments: { ticker: 'CRM' }
    });
    assert.equal(failedResult.isError, true);
    assert.deepEqual(JSON.parse(failedResult.content[0].text), {
      error: 'PROVIDER_FAILURE',
      message: 'Controlled provider failure'
    });
  } finally {
    client.getFinancials = originalMethods.getFinancials;
    client.getUserInfo = originalMethods.getUserInfo;
    pplxClient.getCompanyStrategicProfile = originalMethods.getCompanyStrategicProfile;
    await protocolClient.close();
    await server.close();
  }
});
