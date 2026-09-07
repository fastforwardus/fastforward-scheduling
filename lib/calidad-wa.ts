/**
 * Estado de calidad del numero de WhatsApp.
 *
 * Todo lo que inicia conversaciones corre por el mismo numero: la campaña,
 * los recordatorios de propuesta y el recupero de no-show. Si el numero se
 * degrada, seguir mandando lo empuja a rojo y ahi Meta puede limitarlo.
 *
 * No cubre las respuestas de Adriana: esas van a gente que ya escribio.
 */
export async function calidadWhatsApp(): Promise<{ ok: boolean; rating: string }> {
  const id = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!id || !token) return { ok: false, rating: "sin credenciales" };
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/${id}?fields=quality_rating,messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const d = await r.json();
    const rating = String(d?.quality_rating || "desconocido");
    // UNKNOWN es ausencia de dato, no una señal mala: la API viene desfasada
    // respecto del panel de Meta.
    const malo = rating === "YELLOW" || rating === "RED" || rating === "FLAGGED";
    return { ok: !malo, rating };
  } catch {
    return { ok: false, rating: "error al consultar" };
  }
}
