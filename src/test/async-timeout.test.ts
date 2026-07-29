import { describe, expect, it, vi } from "vitest";
import { RequestTimeoutError, withTimeout } from "@/lib/async-timeout";

describe("withTimeout", () => {
  it("retorna o resultado quando a operação conclui", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 20)).resolves.toBe("ok");
  });

  it("encerra uma operação que não responde", async () => {
    vi.useFakeTimers();
    const operation = withTimeout(new Promise(() => {}), 100);
    const expectation = expect(operation).rejects.toBeInstanceOf(
      RequestTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(100);
    await expectation;
    vi.useRealTimers();
  });
});
