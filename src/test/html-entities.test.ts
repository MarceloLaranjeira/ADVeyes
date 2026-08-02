import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "@/lib/html-entities";

describe("decodeHtmlEntities", () => {
  it("decodifica acentos e entidades numéricas das publicações", () => {
    expect(
      decodeHtmlEntities(
        "PODER JUDICI&Aacute;RIO &mdash; Intima&ccedil;&atilde;o n.&ordm; &#49;",
      ),
    ).toBe("PODER JUDICIÁRIO — Intimação n.º 1");
  });
});
