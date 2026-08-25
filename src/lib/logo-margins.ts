/**
 * Medição das margens transparentes internas de uma logo.
 *
 * Margens vazias dentro do arquivo não são removíveis por CSS: `object-contain`
 * ajusta a caixa da imagem, não o conteúdo dela. Uma logo com 20% de vazio em
 * volta aparece pequena no cabeçalho por mais que a área da marca cresça. Medir
 * e avisar é o que permite ao escritório corrigir o arquivo na origem.
 */

export interface LogoPixels {
  width: number;
  height: number;
  /** RGBA linear, como `ImageData.data`. */
  data: Uint8ClampedArray | number[];
}

export interface LogoMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Abaixo disto o pixel conta como vazio; PNGs exportados deixam resíduo. */
const ALPHA_THRESHOLD = 12;

/** Fração de cada lado ocupada apenas por pixels transparentes. */
export function measureTransparentMargins(
  image: LogoPixels,
  alphaThreshold: number = ALPHA_THRESHOLD,
): LogoMargins {
  const { width, height, data } = image;
  const empty: LogoMargins = { top: 0, right: 0, bottom: 0, left: 0 };
  if (width <= 0 || height <= 0) return empty;

  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3] ?? 0;

  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) <= alphaThreshold) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  // Imagem inteiramente transparente: não há conteúdo para enquadrar.
  if (bottom < 0 || right < 0) return empty;

  return {
    top: top / height,
    bottom: (height - 1 - bottom) / height,
    left: left / width,
    right: (width - 1 - right) / width,
  };
}

/** Acima disto a sobra já encolhe a logo de forma perceptível no cabeçalho. */
const NOTICEABLE_MARGIN = 0.08;

const SIDE_LABELS: Array<[keyof LogoMargins, string]> = [
  ["top", "em cima"],
  ["bottom", "embaixo"],
  ["left", "à esquerda"],
  ["right", "à direita"],
];

/**
 * Aviso pronto para a interface, ou `null` quando o arquivo está bem
 * enquadrado.
 */
export function describeLogoMargins(
  margins: LogoMargins,
  tolerance: number = NOTICEABLE_MARGIN,
): string | null {
  const wide = SIDE_LABELS.filter(([side]) => margins[side] > tolerance);
  if (wide.length === 0) return null;

  const worst = Math.max(...wide.map(([side]) => margins[side]));
  const sides = wide.map(([, label]) => label);
  const list = sides.length === 1
    ? sides[0]
    : `${sides.slice(0, -1).join(", ")} e ${sides[sides.length - 1]}`;

  return `Este arquivo tem cerca de ${Math.round(worst * 100)}% de espaço ` +
    `transparente ${list}. Essa sobra pertence à imagem e não pode ser ` +
    `removida pelo sistema: recorte o arquivo rente à marca para ela aparecer ` +
    `maior no cabeçalho.`;
}
