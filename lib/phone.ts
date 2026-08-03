/**
 * Normalizacion a E.164 sin "+", que es lo que espera la Cloud API de Meta.
 * Critico: un numero mal formateado se acepta en el request y el mensaje
 * nunca llega — Meta no devuelve error.
 */

export function normalizeWhatsAppPhone(raw: string | null | undefined): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";

  // Prefijo de salida internacional
  if (d.startsWith("00")) d = d.slice(2);

  // ── Argentina: los moviles necesitan un 9 despues del 54 ──
  if (d.startsWith("54")) {
    let rest = d.slice(2).replace(/^0+/, "");        // 011 -> 11
    const teniaNueve = rest.startsWith("9");
    if (teniaNueve) rest = rest.slice(1);            // normalizar una sola vez

    // 15 legacy despues del codigo de area: 11 15 12345678 -> 11 12345678
    // El numero nacional argentino siempre suma 10 digitos (area + local).
    if (rest.length === 12) {
      const m = rest.match(/^(\d{2,4})15(\d{6,8})$/);
      if (m && m[1].length + m[2].length === 10) rest = m[1] + m[2];
    }

    if (rest.length === 10 || teniaNueve) rest = "9" + rest;
    d = "54" + rest;
  }

  // ── Brasil: noveno digito en moviles ──
  // 55 + area(2) + local(8) donde el local arranca en 6-9 -> falta el 9
  else if (d.startsWith("55")) {
    const rest = d.slice(2);
    if (rest.length === 10 && /^[1-9]\d[6-9]/.test(rest)) {
      d = "55" + rest.slice(0, 2) + "9" + rest.slice(2);
    }
  }

  // ── Mexico: ya no lleva el 1 despues del 52 ──
  else if (d.startsWith("521") && d.length === 13) {
    d = "52" + d.slice(3);
  }

  return d;
}

/** Longitud plausible para un numero internacional. */
export function isPlausiblePhone(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Ultimos 8 digitos: clave laxa para comparar numeros guardados en formatos
 * distintos. Se usa en opt-out, donde un falso positivo (no enviar) es
 * mucho menos grave que un falso negativo (escribirle a quien pidio la baja).
 */
export function phoneTail(raw: string | null | undefined): string {
  const d = (raw || "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
}
