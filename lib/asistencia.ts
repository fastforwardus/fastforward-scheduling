export const NY = "America/New_York";

export function ymdNY(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NY, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Rango [inicio, fin) en UTC del dia calendario de Miami indicado (YYYY-MM-DD). */
export function rangoDiaNY(ymd: string): [Date, Date] {
  for (const off of ["-04:00", "-05:00"]) {
    const s = new Date(`${ymd}T00:00:00${off}`);
    if (ymdNY(s) === ymd && ymdNY(new Date(s.getTime() - 1000)) !== ymd) return [s, new Date(s.getTime() + 86400000)];
  }
  const s = new Date(`${ymd}T00:00:00-04:00`);
  return [s, new Date(s.getTime() + 86400000)];
}

export function hoyNY(): string { return ymdNY(new Date()); }

export interface EntradaRaw { userId: string; fullName: string; punchedAt: Date; source: string; kind: string; }

export interface FilaDia {
  userId: string; fullName: string; fecha: string;
  entrada: string; salida: string | null; horas: number | null; marcas: number; origenes: string[];
}

export function agruparPorDia(entries: EntradaRaw[]): FilaDia[] {
  const m = new Map<string, EntradaRaw[]>();
  for (const e of entries) {
    const k = `${e.userId}|${ymdNY(e.punchedAt)}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(e);
  }
  const out: FilaDia[] = [];
  for (const [k, list] of m) {
    list.sort((a, b) => a.punchedAt.getTime() - b.punchedAt.getTime());
    const first = list[0], last = list[list.length - 1];
    out.push({
      userId: first.userId, fullName: first.fullName, fecha: k.split("|")[1],
      entrada: first.punchedAt.toISOString(),
      salida: list.length >= 2 ? last.punchedAt.toISOString() : null,
      horas: list.length >= 2 ? Math.round(((last.punchedAt.getTime() - first.punchedAt.getTime()) / 3.6e6) * 100) / 100 : null,
      marcas: list.length,
      origenes: Array.from(new Set(list.map((e) => e.source))),
    });
  }
  return out.sort((a, b) => (a.fecha === b.fecha ? a.fullName.localeCompare(b.fullName) : b.fecha.localeCompare(a.fecha)));
}
