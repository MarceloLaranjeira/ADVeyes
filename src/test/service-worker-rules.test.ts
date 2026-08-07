import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * O service worker roda fora do bundle, então não dá para importá-lo. As duas
 * regras que decidem o que ele intercepta são extraídas do arquivo e testadas
 * aqui, porque errar qualquer uma delas serve JavaScript velho ao usuário —
 * foi o que aconteceu com a versão anterior do regex de bundle.
 */
const source = readFileSync(
  resolve(__dirname, "../../public/sw.js"),
  "utf8",
);

function extrairRegex(nome: string): RegExp {
  const match = new RegExp(`${nome}[\\s\\S]*?(/\\^.*?/)\\.test`).exec(source);
  if (!match) throw new Error(`regex de ${nome} não encontrada em sw.js`);
  const corpo = match[1];
  return new RegExp(corpo.slice(1, corpo.lastIndexOf("/")));
}

describe("sw.js — bundles com hash", () => {
  const isHashedBundle = extrairRegex("isHashedBundle");

  // Nomes reais produzidos pelo `npm run build` deste projeto.
  it.each([
    "/assets/index-DJQgUvrI.js",
    "/assets/index-B1Pe1HTp.css",
    "/assets/pdf.worker.min-B_fnEKel.mjs",
    "/assets/purify.es-KBy9Vb4R.js",
    "/assets/html2canvas.esm-CBrSDip1.js",
  ])("reconhece %s", (caminho) => {
    expect(isHashedBundle.test(caminho)).toBe(true);
  });

  it.each([
    "/logo.svg",
    "/manifest.json",
    "/favicon.ico",
    "/assets/logo.svg",
    "/node_modules/.vite/deps/chunk-VJA5E53X.js",
  ])("não confunde %s com bundle", (caminho) => {
    expect(isHashedBundle.test(caminho)).toBe(false);
  });
});

describe("sw.js — caminhos do servidor de desenvolvimento", () => {
  // Extrai os prefixos declarados em isDevAsset.
  const prefixos = [
    ...source
      .slice(
        source.indexOf("const isDevAsset"),
        source.indexOf("const isHashedBundle"),
      )
      .matchAll(/startsWith\("([^"]+)"\)/g),
  ].map((m) => m[1]);

  it("cobre os caminhos que o Vite usa em dev", () => {
    expect(prefixos).toEqual(
      expect.arrayContaining([
        "/node_modules/",
        "/@vite/",
        "/src/",
      ]),
    );
  });

  it("não deixa passar caminho de produção", () => {
    // Nenhum prefixo de dev pode capturar um bundle real do build.
    const bundle = "/assets/index-DJQgUvrI.js";
    expect(prefixos.some((p) => bundle.startsWith(p))).toBe(false);
  });
});
