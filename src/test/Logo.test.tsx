import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { brandMock } = vi.hoisted(() => ({ brandMock: vi.fn() }));

vi.mock("@/contexts/BrandContext", () => ({ useBrand: brandMock }));

import { LogoFull } from "@/components/common/Logo";

const brandWithLogo = (logoLightPath: string) => ({
  brand: {
    publicName: "Albertino Advocacia",
    shortName: "Albertino",
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
        shortName: "ADVeyes",
        logoLightPath: null,
        logoDarkPath: null,
        iconPath: null,
      },
    });

    render(<LogoFull size="md" />);
    expect(screen.getByText("ADVeyes")).toBeInTheDocument();
  });

  it("usa o nome curto no cabeçalho compacto", () => {
    brandMock.mockReturnValue({
      brand: {
        publicName: "Almeida, Barros e Companhia Advogados Associados",
        shortName: "Almeida & Barros",
        logoLightPath: null,
        logoDarkPath: null,
        iconPath: null,
      },
    });

    render(<LogoFull size="sm" />);
    expect(screen.getByText("Almeida & Barros")).toBeInTheDocument();
    expect(screen.queryByText("Almeida, Barros e Companhia Advogados Associados")).not.toBeInTheDocument();
  });

  it("limita nomes longos a três linhas sem estourar a área da marca", () => {
    brandMock.mockReturnValue({
      brand: {
        publicName: "Almeida, Barros, Carvalho, Souza e Pereira Advogados Associados",
        shortName: "Almeida & Barros",
        logoLightPath: null,
        logoDarkPath: null,
        iconPath: null,
      },
    });

    render(<LogoFull size="lg" />);
    const name = screen.getByText("Almeida, Barros, Carvalho, Souza e Pereira Advogados Associados");
    expect(name.className).toContain("brand-name-clamp");
    expect(name.className).toContain("text-[10px]");
    expect(screen.getByRole("img", { name: /Logo Almeida/ })).toHaveAttribute("width", "40");
  });

  it("permite que a prévia use a identidade ainda não salva", () => {
    brandMock.mockReturnValue(brandWithLogo("/brand/logo-salva.png"));

    render(<LogoFull branding={{
      publicName: "Nova Marca",
      shortName: "Nova",
      logoLightPath: null,
      logoDarkPath: null,
      iconPath: null,
    }} />);
    expect(screen.getByText("Nova Marca")).toBeInTheDocument();
  });
});
