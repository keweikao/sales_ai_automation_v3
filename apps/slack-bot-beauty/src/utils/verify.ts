/**
 * Slack 請求驗證工具
 */

/**
 * 驗證 Slack 請求簽名
 * 確保請求確實來自 Slack
 */
export async function verifySlackRequest(
  rawBody: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): Promise<boolean> {
  // Check timestamp to prevent replay attacks (5 minutes tolerance)
  const now = Math.floor(Date.now() / 1000);
  const requestTimestamp = Number.parseInt(timestamp, 10);

  if (Math.abs(now - requestTimestamp) > 60 * 5) {
    console.warn("Request timestamp too old");
    return false;
  }

  // Create the signature base string
  const sigBaseString = `v0:${timestamp}:${rawBody}`;

  // Compute HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(sigBaseString)
  );

  // Convert to hex string
  const computedSignature = `v0=${Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  // Compare signatures using timing-safe comparison
  return timingSafeEqual(computedSignature, signature);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
