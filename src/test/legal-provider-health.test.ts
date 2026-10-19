import { describe, expect, it } from "vitest";
import {
  type ProviderHealthRow,
  summarizeProviderHealth,
} from "@/lib/legal-provider-health";

function row(overrides: Partial<ProviderHealthRow>): ProviderHealthRow {
  return {
    provider: "djen",
    healthy_count: 0,
    failing_count: 0,
    top_failure_code: null,
    ...overrides,
  };
}

describe("summarizeProviderHealth", () => {
  it("returns null when no provider has failing sources", () => {
    expect(summarizeProviderHealth([
      row({ provider: "djen", healthy_count: 3 }),
      row({ provider: "escavador", healthy_count: 2 }),
    ])).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(summarizeProviderHealth([])).toBeNull();
  });

  it("lists failing providers by failure count and the fully working ones", () => {
    const alert = summarizeProviderHealth([
      row({ provider: "djen", healthy_count: 4 }),
      row({ provider: "datajud", healthy_count: 10, failing_count: 2 }),
      row({
        provider: "escavador",
        failing_count: 8,
        top_failure_code: "escavador_insufficient_balance",
      }),
    ]);

    expect(alert?.failing.map((item) => item.provider))
      .toEqual(["escavador", "datajud"]);
    expect(alert?.working).toEqual(["djen"]);
  });

  it("does not count a partially failing provider as working", () => {
    const alert = summarizeProviderHealth([
      row({ provider: "escavador", healthy_count: 5, failing_count: 1 }),
    ]);

    expect(alert?.working).toEqual([]);
  });

  it("ignores providers with no active healthy sources in the working list", () => {
    const alert = summarizeProviderHealth([
      row({ provider: "djen" }),
      row({ provider: "escavador", failing_count: 1 }),
    ]);

    expect(alert?.working).toEqual([]);
  });
});
