import { describe, expect, it } from "vitest";
import {
  describeLogoMargins,
  measureTransparentMargins,
} from "@/lib/logo-margins";

/** Desenha um retângulo opaco dentro de uma tela transparente. */
function imageWithContent(
  width: number,
  height: number,
  box: { x: number; y: number; w: number; h: number },
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) {
      data[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("margens transparentes da logo", () => {
  it("não acusa margem quando a marca ocupa o arquivo inteiro", () => {
    const image = imageWithContent(20, 10, { x: 0, y: 0, w: 20, h: 10 });

    const margins = measureTransparentMargins(image);

    expect(margins).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(describeLogoMargins(margins)).toBeNull();
  });

  it("mede a sobra de cada lado como fração do arquivo", () => {
    // 20% vazio em cima e embaixo, 25% à esquerda e à direita.
    const image = imageWithContent(20, 10, { x: 5, y: 2, w: 10, h: 6 });

    expect(measureTransparentMargins(image)).toEqual({
      top: 0.2,
      bottom: 0.2,
      left: 0.25,
      right: 0.25,
    });
  });

  it("ignora resíduo quase transparente deixado pela exportação", () => {
    const image = imageWithContent(10, 10, { x: 3, y: 3, w: 4, h: 4 });
    image.data[3] = 5; // canto superior esquerdo com alfa desprezível

    expect(measureTransparentMargins(image).top).toBe(0.3);
  });

  it("trata um arquivo totalmente transparente sem inventar margem", () => {
    const image = imageWithContent(8, 8, { x: 0, y: 0, w: 0, h: 0 });

    expect(measureTransparentMargins(image)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("avisa apenas os lados com sobra perceptível", () => {
    const message = describeLogoMargins({
      top: 0.3,
      bottom: 0.02,
      left: 0.02,
      right: 0.02,
    });

    expect(message).toContain("30%");
    expect(message).toContain("em cima");
    expect(message).not.toContain("embaixo");
    expect(message).toContain("não pode ser removida");
  });

  it("lista todos os lados quando a marca está centralizada com folga", () => {
    const message = describeLogoMargins({
      top: 0.2,
      bottom: 0.2,
      left: 0.25,
      right: 0.25,
    });

    expect(message).toContain("em cima, embaixo, à esquerda e à direita");
  });
});
