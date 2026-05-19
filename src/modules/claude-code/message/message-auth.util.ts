export function extractAuthToken(
  xApiKey: string | undefined,
  authorization: string | undefined,
): string | undefined {
  if (xApiKey) return xApiKey;
  if (!authorization) return undefined;
  return authorization.replace(/^Bearer\s+/i, "");
}
