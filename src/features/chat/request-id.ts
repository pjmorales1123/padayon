export function consumeRequestId(
  supplied: string | undefined,
  create: () => string,
): string {
  const trimmed = supplied?.trim();
  return trimmed || create();
}
