// Implementação compacta de MD5 para reproduzir o `tck` calculado pelo
// formulário oficial do Projudi. Não é usada para armazenar senhas.
function add32(a: number, b: number): number {
  return (a + b) & 0xffffffff;
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & c) | (~b & d), a, b, x, s, t);
}
function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & d) | (c & ~d), a, b, x, s, t);
}
function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}
function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(c ^ (b | ~d), a, b, x, s, t);
}

function md5cycle(state: number[], block: number[]): void {
  let [a, b, c, d] = state;
  const original = [a, b, c, d];
  const operations: Array<[typeof ff, number, number, number]> = [
    [ff, 0, 7, -680876936], [ff, 1, 12, -389564586], [ff, 2, 17, 606105819], [ff, 3, 22, -1044525330],
    [ff, 4, 7, -176418897], [ff, 5, 12, 1200080426], [ff, 6, 17, -1473231341], [ff, 7, 22, -45705983],
    [ff, 8, 7, 1770035416], [ff, 9, 12, -1958414417], [ff, 10, 17, -42063], [ff, 11, 22, -1990404162],
    [ff, 12, 7, 1804603682], [ff, 13, 12, -40341101], [ff, 14, 17, -1502002290], [ff, 15, 22, 1236535329],
    [gg, 1, 5, -165796510], [gg, 6, 9, -1069501632], [gg, 11, 14, 643717713], [gg, 0, 20, -373897302],
    [gg, 5, 5, -701558691], [gg, 10, 9, 38016083], [gg, 15, 14, -660478335], [gg, 4, 20, -405537848],
    [gg, 9, 5, 568446438], [gg, 14, 9, -1019803690], [gg, 3, 14, -187363961], [gg, 8, 20, 1163531501],
    [gg, 13, 5, -1444681467], [gg, 2, 9, -51403784], [gg, 7, 14, 1735328473], [gg, 12, 20, -1926607734],
    [hh, 5, 4, -378558], [hh, 8, 11, -2022574463], [hh, 11, 16, 1839030562], [hh, 14, 23, -35309556],
    [hh, 1, 4, -1530992060], [hh, 4, 11, 1272893353], [hh, 7, 16, -155497632], [hh, 10, 23, -1094730640],
    [hh, 13, 4, 681279174], [hh, 0, 11, -358537222], [hh, 3, 16, -722521979], [hh, 6, 23, 76029189],
    [hh, 9, 4, -640364487], [hh, 12, 11, -421815835], [hh, 15, 16, 530742520], [hh, 2, 23, -995338651],
    [ii, 0, 6, -198630844], [ii, 7, 10, 1126891415], [ii, 14, 15, -1416354905], [ii, 5, 21, -57434055],
    [ii, 12, 6, 1700485571], [ii, 3, 10, -1894986606], [ii, 10, 15, -1051523], [ii, 1, 21, -2054922799],
    [ii, 8, 6, 1873313359], [ii, 15, 10, -30611744], [ii, 6, 15, -1560198380], [ii, 13, 21, 1309151649],
    [ii, 4, 6, -145523070], [ii, 11, 10, -1120210379], [ii, 2, 15, 718787259], [ii, 9, 21, -343485551],
  ];
  for (let index = 0; index < operations.length; index += 1) {
    const [fn, word, shift, constant] = operations[index];
    const next = fn(a, b, c, d, block[word], shift, constant);
    [a, b, c, d] = [d, next, b, c];
  }
  state[0] = add32(a, original[0]);
  state[1] = add32(b, original[1]);
  state[2] = add32(c, original[2]);
  state[3] = add32(d, original[3]);
}

export function md5(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const paddedLength = (((bytes.length + 8) >>> 6) + 1) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bits = bytes.length * 8;
  for (let index = 0; index < 8; index += 1) {
    padded[paddedLength - 8 + index] = Math.floor(bits / 2 ** (8 * index)) & 0xff;
  }
  const state = [1732584193, -271733879, -1732584194, 271733878];
  for (let offset = 0; offset < padded.length; offset += 64) {
    const block = new Array<number>(16);
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      block[index] = padded[start] | (padded[start + 1] << 8) |
        (padded[start + 2] << 16) | (padded[start + 3] << 24);
    }
    md5cycle(state, block);
  }
  return state.map(word => [0, 8, 16, 24].map(shift =>
    ((word >>> shift) & 0xff).toString(16).padStart(2, "0")).join("")).join("");
}
