/**
 * Calendário forense e contagem de prazos processuais.
 *
 * Implementa as regras do CPC/2015 que decidem quando um prazo vence:
 *
 * - art. 219      — prazos processuais contam-se somente em dias úteis;
 * - art. 224      — exclui-se o dia do começo e inclui-se o do vencimento;
 * - art. 224, §1  — começo e vencimento que caiam em dia de expediente
 *                   reduzido são protraídos para o próximo dia útil;
 * - art. 224, §2  — publicação é o primeiro dia útil após a disponibilização
 *                   no Diário de Justiça eletrônico;
 * - art. 224, §3  — a contagem começa no primeiro dia útil após a publicação;
 * - art. 220      — o prazo fica suspenso de 20/12 a 20/01, inclusive;
 * - art. 216      — sábados, domingos e dias sem expediente são feriados.
 *
 * O módulo é puro de propósito: nenhuma importação, nenhum acesso a rede ou
 * banco. Isso permite testá-lo pelo vitest do frontend e mantém a regra legal
 * separada de qualquer detalhe de infraestrutura.
 *
 * Escopo deliberado: o cálculo automático cobre apenas o que é objetivo em
 * todo o território nacional — fins de semana, feriados civis nacionais,
 * feriados móveis derivados da Páscoa e a suspensão do art. 220. Feriados de
 * tribunal, estaduais e municipais entram por `extraHolidays`, vindos da
 * tabela `forensic_holidays`. Quando não há calendário do tribunal cadastrado,
 * quem chama recebe um aviso explícito em vez de uma data falsamente precisa.
 */

/** Data no formato ISO `YYYY-MM-DD`, sempre em UTC. */
export type IsoDate = string;

export interface CalendarDay {
  date: IsoDate;
  /** Motivo pelo qual o dia não conta. Ausente em dia útil. */
  reason?: string;
}

export interface HolidayInput {
  date: IsoDate;
  description: string;
  /**
   * Expediente reduzido (ex.: Quarta-feira de Cinzas, quando o fórum abre ao
   * meio-dia). O prazo continua correndo, mas começo e vencimento que caiam
   * nesse dia são protraídos — art. 224, §1.
   */
  partialExpedient?: boolean;
}

const MS_PER_DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/* Utilidades de data                                                  */
/* ------------------------------------------------------------------ */

/** Converte `YYYY-MM-DD` em Date UTC à meia-noite. Lança se for inválida. */
export function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`data inválida: ${value}`);
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error(`data inexistente: ${value}`);
  }
  return date;
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/* ------------------------------------------------------------------ */
/* Feriados nacionais                                                  */
/* ------------------------------------------------------------------ */

/**
 * Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário
 * gregoriano). É a âncora de todos os feriados móveis brasileiros.
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Feriados civis de data fixa, válidos em todo o território nacional. */
function fixedNationalHolidays(year: number): HolidayInput[] {
  const holidays: HolidayInput[] = [
    { date: `${year}-01-01`, description: "Confraternização Universal" },
    { date: `${year}-04-21`, description: "Tiradentes" },
    { date: `${year}-05-01`, description: "Dia do Trabalho" },
    { date: `${year}-09-07`, description: "Independência do Brasil" },
    { date: `${year}-10-12`, description: "Nossa Senhora Aparecida" },
    { date: `${year}-11-02`, description: "Finados" },
    { date: `${year}-11-15`, description: "Proclamação da República" },
    { date: `${year}-12-25`, description: "Natal" },
  ];

  // Consciência Negra virou feriado nacional pela Lei 14.759/2023, com
  // efeitos a partir de 2024. Antes disso era feriado apenas onde a lei
  // estadual ou municipal previa.
  if (year >= 2024) {
    holidays.push({
      date: `${year}-11-20`,
      description: "Dia Nacional de Zumbi e da Consciência Negra",
    });
  }

  return holidays;
}

/** Feriados móveis derivados da Páscoa. */
function movableNationalHolidays(year: number): HolidayInput[] {
  const easter = easterSunday(year);
  return [
    {
      date: toIsoDate(addDays(easter, -48)),
      description: "Carnaval (segunda-feira)",
    },
    {
      date: toIsoDate(addDays(easter, -47)),
      description: "Carnaval (terça-feira)",
    },
    {
      // O expediente forense costuma iniciar ao meio-dia. Pelo art. 224, §1,
      // isso protrai começo e vencimento, mas não interrompe a contagem.
      date: toIsoDate(addDays(easter, -46)),
      description: "Quarta-feira de Cinzas (expediente reduzido)",
      partialExpedient: true,
    },
    {
      date: toIsoDate(addDays(easter, -2)),
      description: "Sexta-feira Santa",
    },
    {
      date: toIsoDate(addDays(easter, 60)),
      description: "Corpus Christi",
    },
  ];
}

/** Todos os feriados nacionais de um ano, fixos e móveis. */
export function nationalHolidays(year: number): HolidayInput[] {
  return [...fixedNationalHolidays(year), ...movableNationalHolidays(year)];
}

/* ------------------------------------------------------------------ */
/* Suspensão do art. 220                                               */
/* ------------------------------------------------------------------ */

/**
 * Recesso forense do art. 220: o prazo fica suspenso nos dias entre 20 de
 * dezembro e 20 de janeiro, inclusive. É suspensão, não interrupção — o que
 * já correu permanece contado.
 */
export function isInRecess(date: Date): boolean {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  if (month === 12 && day >= 20) return true;
  if (month === 1 && day <= 20) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Calendário                                                          */
/* ------------------------------------------------------------------ */

export interface ForensicCalendar {
  /** Retorna o motivo de o dia não ser útil, ou `null` se for dia útil. */
  nonBusinessReason(date: Date): string | null;
  /** Dia de expediente reduzido (art. 224, §1). */
  isPartialExpedient(date: Date): boolean;
}

/**
 * Monta o calendário para o intervalo de anos necessário ao cálculo.
 *
 * `extraHolidays` recebe os feriados de tribunal, estaduais e municipais
 * vindos do banco. Eles têm precedência sobre os nacionais quando a mesma
 * data aparece nos dois, porque a fonte específica é a mais confiável.
 */
export function buildCalendar(
  years: number[],
  extraHolidays: HolidayInput[] = [],
): ForensicCalendar {
  const holidays = new Map<IsoDate, HolidayInput>();

  for (const year of new Set(years)) {
    for (const holiday of nationalHolidays(year)) {
      holidays.set(holiday.date, holiday);
    }
  }
  for (const holiday of extraHolidays) {
    holidays.set(holiday.date, holiday);
  }

  return {
    nonBusinessReason(date: Date): string | null {
      if (isWeekend(date)) {
        return date.getUTCDay() === 0 ? "domingo" : "sábado";
      }
      if (isInRecess(date)) {
        return "recesso forense (CPC, art. 220)";
      }
      const holiday = holidays.get(toIsoDate(date));
      if (holiday && !holiday.partialExpedient) {
        return holiday.description;
      }
      return null;
    },
    isPartialExpedient(date: Date): boolean {
      return holidays.get(toIsoDate(date))?.partialExpedient === true;
    },
  };
}

/** Primeiro dia útil em `date` ou depois dela. */
export function nextBusinessDay(
  date: Date,
  calendar: ForensicCalendar,
): Date {
  let cursor = date;
  // O limite evita laço infinito se um calendário mal formado marcar todos
  // os dias como não úteis.
  for (let guard = 0; guard < 400; guard += 1) {
    if (
      calendar.nonBusinessReason(cursor) === null &&
      !calendar.isPartialExpedient(cursor)
    ) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }
  throw new Error("nenhum dia útil encontrado em 400 dias");
}

/* ------------------------------------------------------------------ */
/* Contagem do prazo                                                   */
/* ------------------------------------------------------------------ */

export interface DeadlineComputation {
  /** Data em que o ato foi disponibilizado no diário. */
  disponibilizacao: IsoDate;
  /** Data de publicação — art. 224, §2. */
  publicacao: IsoDate;
  /** Primeiro dia contado — art. 224, §3. */
  termoInicial: IsoDate;
  /** Data fatal. */
  vencimento: IsoDate;
  /** Dias úteis efetivamente contados. */
  diasUteisContados: number;
  /** Dias pulados, com o motivo de cada um. */
  diasNaoUteis: CalendarDay[];
  /** Fundamentos legais aplicados, para a trilha de auditoria. */
  fundamentos: string[];
}

export interface ComputeDeadlineOptions {
  /** Data de disponibilização no diário, em `YYYY-MM-DD`. */
  disponibilizacao: string;
  /** Quantidade de dias do prazo. */
  dias: number;
  /**
   * Prazos em dias corridos existem (ex.: art. 231 em hipóteses específicas
   * e prazos de direito material). O padrão é dias úteis, art. 219.
   */
  diasCorridos?: boolean;
  /**
   * Quando o termo inicial não vem de publicação em diário (ex.: intimação
   * pessoal, juntada de AR), a regra do art. 224, §2 não se aplica.
   */
  intimacaoPessoal?: boolean;
  extraHolidays?: HolidayInput[];
}

/**
 * Calcula a data fatal de um prazo processual.
 *
 * A sequência segue o CPC na ordem em que ele decide cada coisa:
 * disponibilização → publicação → termo inicial → contagem → vencimento.
 */
export function computeDeadline(
  options: ComputeDeadlineOptions,
): DeadlineComputation {
  const { dias, diasCorridos = false, intimacaoPessoal = false } = options;

  if (!Number.isInteger(dias) || dias < 1) {
    throw new Error("prazo deve ser um número inteiro de dias maior que zero");
  }

  const disponibilizacao = parseIsoDate(options.disponibilizacao);

  // O prazo pode atravessar o recesso, então o calendário precisa cobrir o
  // ano seguinte também.
  const baseYear = disponibilizacao.getUTCFullYear();
  const calendar = buildCalendar(
    [baseYear - 1, baseYear, baseYear + 1, baseYear + 2],
    options.extraHolidays ?? [],
  );

  const fundamentos: string[] = [];

  // Art. 224, §2 — publicação é o primeiro dia útil após a disponibilização.
  // Intimação pessoal não passa pelo diário, então o próprio ato é o marco.
  let publicacao: Date;
  if (intimacaoPessoal) {
    publicacao = disponibilizacao;
    fundamentos.push(
      "Intimação pessoal: o termo inicial corre do próprio ato, sem a " +
        "protração do art. 224, §2.",
    );
  } else {
    publicacao = nextBusinessDay(addDays(disponibilizacao, 1), calendar);
    fundamentos.push(
      "CPC, art. 224, §2 — publicação considerada no primeiro dia útil " +
        "seguinte ao da disponibilização no diário eletrônico.",
    );
  }

  // Art. 224, §3 — a contagem começa no primeiro dia útil após a publicação.
  const termoInicial = nextBusinessDay(addDays(publicacao, 1), calendar);
  fundamentos.push(
    "CPC, art. 224, §3 — contagem iniciada no primeiro dia útil seguinte " +
      "ao da publicação.",
  );

  const diasNaoUteis: CalendarDay[] = [];
  let contados = 0;
  let cursor = termoInicial;
  let vencimento = termoInicial;

  if (diasCorridos) {
    fundamentos.push(
      "Prazo contado em dias corridos por disposição específica; a regra " +
        "geral do art. 219 não se aplica.",
    );
    vencimento = addDays(termoInicial, dias - 1);
    contados = dias;
  } else {
    fundamentos.push(
      "CPC, art. 219 — computados somente os dias úteis.",
    );
    // O termo inicial já é dia útil, então ele é o dia 1.
    for (let guard = 0; guard < 3000 && contados < dias; guard += 1) {
      const reason = calendar.nonBusinessReason(cursor);
      if (reason === null) {
        contados += 1;
        vencimento = cursor;
      } else {
        diasNaoUteis.push({ date: toIsoDate(cursor), reason });
      }
      cursor = addDays(cursor, 1);
    }
    if (contados < dias) {
      throw new Error("não foi possível fechar a contagem do prazo");
    }
  }

  // Art. 224, §1 — vencimento em dia de expediente reduzido é protraído.
  if (
    calendar.isPartialExpedient(vencimento) ||
    calendar.nonBusinessReason(vencimento) !== null
  ) {
    vencimento = nextBusinessDay(vencimento, calendar);
    fundamentos.push(
      "CPC, art. 224, §1 — vencimento protraído para o primeiro dia útil " +
        "seguinte por queda em dia sem expediente normal.",
    );
  }

  if (diasNaoUteis.some((d) => d.reason?.includes("art. 220"))) {
    fundamentos.push(
      "CPC, art. 220 — prazo suspenso entre 20 de dezembro e 20 de " +
        "janeiro, inclusive.",
    );
  }

  return {
    disponibilizacao: toIsoDate(disponibilizacao),
    publicacao: toIsoDate(publicacao),
    termoInicial: toIsoDate(termoInicial),
    vencimento: toIsoDate(vencimento),
    diasUteisContados: contados,
    diasNaoUteis,
    fundamentos,
  };
}
