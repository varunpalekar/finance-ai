export function createMockFetch(routes = {}) {
  const calls = [];

  const mockFetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });

    // Check direct match or find matching route prefix/function
    let matchedKey = Object.keys(routes).find((key) => {
      if (key === url) return true;
      try {
        const routeUrl = new URL(key, 'https://www.tijorifinance.com');
        const reqUrl = new URL(url, 'https://www.tijorifinance.com');
        return routeUrl.pathname === reqUrl.pathname;
      } catch {
        return false;
      }
    });

    const route = matchedKey ? routes[matchedKey] : null;

    if (!route) {
      const notFoundRes = new Response(`Not Found: ${url}`, {
        status: 404,
        headers: { 'content-type': 'text/plain' },
      });
      Object.defineProperty(notFoundRes, 'url', { value: url, writable: false });
      return notFoundRes;
    }

    if (route instanceof Error) {
      throw route;
    }

    if (typeof route === 'function') {
      const dynamicRes = await route(url, init);
      if (!dynamicRes.url) {
        Object.defineProperty(dynamicRes, 'url', { value: url, writable: false });
      }
      return dynamicRes;
    }

    const status = route.status ?? 200;
    const headers = new Headers(route.headers || {});
    let body = route.body ?? '';

    if (typeof body === 'object' && !(body instanceof Uint8Array) && !(body instanceof Blob)) {
      body = JSON.stringify(body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }

    const response = new Response(body, {
      status,
      headers,
    });

    const finalUrl = route.url ?? url;
    Object.defineProperty(response, 'url', { value: finalUrl, writable: false });

    return response;
  };

  mockFetch.calls = calls;
  return mockFetch;
}
