import { describe, expect, it } from "vitest";
import {
  buildTenantAppUrl,
  resolveTenantHost,
  shouldNavigateTenantInPlace,
} from "@/lib/tenant-host";

describe("tenant-host", () => {
  it("reconhece o host central", () => {
    expect(resolveTenantHost("adveyes.automatikus.com.br")).toMatchObject({
      mode: "central",
      local: false,
    });
  });

  it("trata localhost como host central de desenvolvimento", () => {
    expect(resolveTenantHost("LOCALHOST:5173")).toMatchObject({
      mode: "central",
      local: true,
    });
  });

  it("extrai um slug válido do subdomínio", () => {
    expect(
      resolveTenantHost("albertino.adveyes.automatikus.com.br"),
    ).toMatchObject({ mode: "tenant", slug: "albertino" });
  });

  it("rejeita hosts externos e subdomínios aninhados", () => {
    expect(resolveTenantHost("evil.example.com").mode).toBe("invalid");
    expect(
      resolveTenantHost("a.b.adveyes.automatikus.com.br").mode,
    ).toBe("invalid");
  });

  it("gera navegação sem colocar tenant UUID na URL", () => {
    expect(
      buildTenantAppUrl({
        slug: "albertino",
        pathname: "/agenda",
        search: "?dia=1",
      }),
    ).toBe(
      "https://albertino.adveyes.automatikus.com.br/agenda?dia=1",
    );
  });

  it("mantém a navegação no domínio central e no ambiente local", () => {
    expect(
      shouldNavigateTenantInPlace(
        resolveTenantHost("adveyes.automatikus.com.br"),
      ),
    ).toBe(true);
    expect(
      shouldNavigateTenantInPlace(resolveTenantHost("localhost")),
    ).toBe(true);
    expect(
      shouldNavigateTenantInPlace(
        resolveTenantHost("albertino.adveyes.automatikus.com.br"),
      ),
    ).toBe(false);
  });
});
