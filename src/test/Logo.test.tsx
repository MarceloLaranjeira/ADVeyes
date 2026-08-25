import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { brandMock } = vi.hoisted(() => ({ brandMock: vi.fn() }));

vi.mock("@/contexts/BrandContext", () => ({ useBrand: brandMock }));

import { LogoFull } from "@/components/common/Logo";

const brandWithLogo = (logoLightPath: string) => ({
  brand: {
    publicName: "Albertino Advocacia",
    logoLightPath,
    logoDarkPath: logoLightPath,
    iconPath: null,
  },
});

describe("LogoFull com logo do escritório", () => {
  beforeEach(() => {
    brandMock.mockReset();
  });

  it.each([
    ["horizontal", "/brand/logo-horizontal.png"],
    ["quadrada", "/brand/logo-quadrada.png"],
    ["vertical", "/brand/logo-vertical.png"],
  ])("exibe a logo %s inteira, sem recorte", (_proporcao, path) => {
    brandMock.mockReturnValue(brandWithLogo(path));

    render(<LogoFull size="md" />);
    const img = screen.getByAltText("Albertino Advocacia");

    // A logo precisa caber por inteiro: nunca deformar nem estourar o contêiner.
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("max-w-full");
    expect(img.className).toContain("max-h-full");

    // Altura rígida em pixels é o que corta logos altas ou de várias linhas.
    expect(img.getAttribute("style") ?? "").not.toMatch(/height:\s*\d+px/);
  });

  it("mantém a área de marca sem impor altura fixa à imagem", () => {
    brandMock.mockReturnValue(brandWithLogo("/brand/logo-vertical.png"));

    render(<LogoFull size="lg" className="max-h-12" />);
    const img = screen.getByAltText("Albertino Advocacia");

    expect(img.className).toContain("max-h-12");
    expect(img.getAttribute("style") ?? "").not.toMatch(/height:\s*\d+px/);
  });

  it("usa a marca vetorial quando o escritório não enviou logo", () => {
    brandMock.mockReturnValue({
      brand: {
        publicName: "ADVeyes",
        logoLightPath: null,
        logoDarkPath: null,
        iconPath: null,
      },
    });

    render(<LogoFull size="md" />);
    expect(screen.getByText("ADVeyes")).toBeInTheDocument();
  });
});
