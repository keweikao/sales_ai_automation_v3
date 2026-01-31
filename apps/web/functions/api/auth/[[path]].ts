/**
 * Proxy all /api/auth/* requests to the server
 * This allows OAuth to work by keeping cookies on the same domain
 */

const SERVER_URL = "https://sales-ai-server.salesaiautomationv3.workers.dev";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const frontendOrigin = url.origin;
  const targetUrl = `${SERVER_URL}${url.pathname}${url.search}`;

  console.log(`[Auth Proxy] ${context.request.method} ${url.pathname}`);
  console.log(
    `[Auth Proxy] Cookies: ${context.request.headers.get("cookie") || "none"}`
  );

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
    redirect: "manual", // Don't follow redirects, let the browser handle them
  });

  console.log(`[Auth Proxy] Response: ${response.status}`);
  console.log(
    `[Auth Proxy] Location: ${response.headers.get("location") || "none"}`
  );

  // Clone the response and forward all headers including Set-Cookie
  const responseHeaders = new Headers(response.headers);

  // Rewrite Location header to use frontend domain instead of server domain
  const location = response.headers.get("location");
  if (location) {
    const rewrittenLocation = location.replace(SERVER_URL, frontendOrigin);
    responseHeaders.set("location", rewrittenLocation);
    console.log(`[Auth Proxy] Rewritten Location: ${rewrittenLocation}`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
