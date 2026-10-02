import { test, expect } from '@playwright/test';

test('public MCP path proxies authenticated protocol requests through web', async ({
  page,
  baseURL,
}, info) => {
  const request = page.request;
  const origin = baseURL!;
  const credentials = { email: 'browser@example.test', password: 'studio-browser-test-password' };
  const setup = (await (await request.get('/api/auth/status')).json()).setup;
  const login = await request.post(setup ? '/api/auth/bootstrap' : '/api/auth/login', {
    headers: { Origin: origin },
    data: setup
      ? { ...credentials, name: 'Studio tester', token: 'test-browser-bootstrap' }
      : credentials,
  });
  expect(login.status()).toBe(200);
  const product = (await (await request.get('/api/products')).json())[0].id;
  const created = await request.post('/api/agent-tokens', {
    headers: { Origin: origin },
    data: { name: 'MCP ' + info.project.name, product_id: product },
  });
  expect(created.status()).toBe(201);
  const key = await created.json();
  expect(key.endpoint).toBe(origin + '/mcp');
  const headers = {
    Authorization: 'Bearer ' + key.token,
    Accept: 'application/json, text/event-stream',
  };
  try {
    const noKey = await request.post('/mcp', {
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(noKey.status()).toBe(401); // a human session is not an agent key
    expect(noKey.headers()['www-authenticate']).toContain('Bearer');
    const initialized = await request.post('/mcp', {
      headers,
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'proxy-test', version: '1' },
        },
      },
    });
    expect(initialized.status()).toBe(200);
    expect(initialized.headers()['content-type']).toContain('application/json');
    expect((await initialized.json()).result.protocolVersion).toBe('2025-11-25');
    const ready = await request.post('/mcp', {
      headers,
      data: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });
    expect(ready.status()).toBe(202);
    expect(await ready.text()).toBe('');
    const tools = await request.post('/mcp', {
      headers: { ...headers, 'MCP-Protocol-Version': '2025-11-25' },
      data: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    expect(tools.status()).toBe(200);
    const toolList = (await tools.json()).result.tools;
    expect(toolList.some((tool: { name: string }) => tool.name === 'studio_context')).toBe(true);
    expect(
      toolList.every((tool: { inputSchema: { required: unknown } }) =>
        Array.isArray(tool.inputSchema.required),
      ),
    ).toBe(true);
    const badVersion = await request.post('/mcp', {
      headers: { ...headers, 'MCP-Protocol-Version': 'unsupported' },
      data: { jsonrpc: '2.0', id: 3, method: 'ping' },
    });
    expect(badVersion.status()).toBe(400);
    const foreign = await request.post('/mcp', {
      headers: { ...headers, Origin: 'https://foreign.example' },
      data: { jsonrpc: '2.0', id: 3, method: 'ping' },
    });
    expect(foreign.status()).toBe(403);
    const get = await request.get('/mcp', { headers });
    expect(get.status()).toBe(405);
    expect(get.headers()['allow']).toBe('POST');
    const removedSession = await request.delete('/mcp', { headers });
    expect(removedSession.status()).toBe(405);
    const opened = await page.goto('/');
    expect(opened?.status()).toBe(200);
    await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
    await expect(page.locator('.endpoint')).toHaveText(origin + '/mcp');
  } finally {
    const revoked = await request.delete('/api/agent-tokens/' + key.id, {
      headers: { Origin: origin },
    });
    expect(revoked.status()).toBe(200);
  }
  const denied = await request.post('/mcp', {
    headers,
    data: { jsonrpc: '2.0', id: 4, method: 'tools/list' },
  });
  expect(denied.status()).toBe(401);
});
