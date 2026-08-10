/**
 * Validacion de telefonos contra Twilio Lookups.
 * Cuesta ~$0.005 por consulta y evita que entren numeros inexistentes,
 * que despues hacen fallar las llamadas de recupero con error 13224.
 *
 * Politica ante fallo del servicio: dejar pasar. Perder una reserva real
 * por una caida de Twilio es peor que guardar un numero dudoso.
 */

export interface LookupResult {
  valido: boolean;
  e164: string | null;
  motivo?: string;
  verificado: boolean; // false si no se pudo consultar
}

export async function validarTelefono(raw: string): Promise<LookupResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const key = process.env.TWILIO_API_KEY;
  const secret = process.env.TWILIO_API_SECRET;

  const digitos = (raw || "").replace(/\D/g, "");
  if (digitos.length < 8) {
    return { valido: false, e164: null, motivo: "muy corto", verificado: true };
  }

  if (!sid || !key || !secret) {
    return { valido: true, e164: null, verificado: false };
  }

  try {
    const auth = Buffer.from(`${key}:${secret}`).toString("base64");
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);

    const res = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent("+" + digitos)}`,
      { headers: { Authorization: `Basic ${auth}` }, signal: ctrl.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      // 404 de Lookups significa numero inexistente, no error del servicio
      if (res.status === 404) {
        return { valido: false, e164: null, motivo: "no existe", verificado: true };
      }
      console.warn("[lookup] respuesta", res.status, "— se deja pasar");
      return { valido: true, e164: null, verificado: false };
    }

    const d = await res.json() as {
      valid?: boolean;
      phone_number?: string;
      validation_errors?: string[];
    };

    if (d.valid === true) {
      // Lookups devuelve el E.164 canonico: mejor que nuestra heuristica
      return { valido: true, e164: (d.phone_number || "").replace(/\D/g, ""), verificado: true };
    }
    return {
      valido: false, e164: null, verificado: true,
      motivo: (d.validation_errors || []).join(", ") || "invalido",
    };
  } catch (err) {
    console.warn("[lookup] error o timeout — se deja pasar:", String(err).slice(0, 80));
    return { valido: true, e164: null, verificado: false };
  }
}
