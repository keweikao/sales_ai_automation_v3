/**
 * Proxy all /rpc/* requests to the server
 * This allows API calls to include the session cookie set on the frontend domain
 */

const SERVER_URL = "https://sales-ai-server.salesaiautomationv3.workers.dev";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const targetUrl = `${SERVER_URL}${url.pathname}${url.search}`;

  // Clone the request with the new URL
  const headers = new Headers(context.request.headers);

  // Forward the request to the server
  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body:
      context.request.method !== "GET" && context.request.method !== "HEAD"
        ? context.request.body
        : undefined,
  });

  // Clone the response and forward all headers
  const responseHeaders = new Headers(response.headers);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
