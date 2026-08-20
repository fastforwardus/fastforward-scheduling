/**
 * Postgres devuelve timestamps como "2026-08-19 23:42:08.526+00": espacio en vez
 * de T, y offset sin minutos. new Date() rechaza las dos cosas y devuelve
 * Invalid Date, que despues se propaga como NaN y termina en datos vacios o
 * comparaciones al azar. Este parseo normaliza ambos casos.
 */
export function parseFecha(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v === null || v === undefined) return new Date(NaN);
  let t = String(v).trim().replace(" ", "T");
  if (/([+-])\d{2}$/.test(t)) t += ":00";
  return new Date(t);
}

/** Igual que parseFecha pero nunca devuelve invalida: cae a epoch. */
export function parseFechaSegura(v: unknown): Date {
  const d = parseFecha(v);
  return isNaN(d.getTime()) ? new Date(0) : d;
}
