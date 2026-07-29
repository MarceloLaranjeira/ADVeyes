export class RequestTimeoutError extends Error {
  constructor(message = "A operação demorou mais que o esperado") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export const withTimeout = async <T>(
  operation: PromiseLike<T>,
  timeoutMs = 10_000,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new RequestTimeoutError()),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
