/**
 * Cliente para Meta WhatsApp Cloud API.
 * Solo soporta envío de texto plano por ahora (suficiente para Adriana).
 */

const META_API_BASE = "https://graph.facebook.com/v22.0";

export interface SendMessageResult {
  ok: boolean;
  metaMessageId?: string;
  error?: string;
}

export async function sendWhatsAppText(
  toPhone: string,
  text: string
): Promise<SendMessageResult> {
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    console.error("[whatsapp-sender] Missing META env vars");
    return { ok: false, error: "Missing META env vars" };
  }

  // WhatsApp espera el número solo con dígitos, con código de país, sin +
  const cleanTo = toPhone.replace(/\D/g, "");

  // WhatsApp Cloud API rechaza mensajes >4096 chars
  const safeText = text.slice(0, 4090);

  const url = `${META_API_BASE}/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanTo,
    type: "text",
    text: { preview_url: false, body: safeText },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[whatsapp-sender] Meta API error:", res.status, data);
      const errMsg = (data as { error?: { message?: string } })?.error?.message
        ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }

    const msgId = (data as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id;
    return { ok: true, metaMessageId: msgId };
  } catch (err) {
    console.error("[whatsapp-sender] fetch error:", err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Envia una plantilla aprobada por Meta. Necesario fuera de la ventana
 * de 24h, donde el texto libre es rechazado (error 131047).
 * bodyParams -> {{1}}, {{2}}... del cuerpo. urlParam -> sufijo del boton URL dinamico.
 */
export async function sendWhatsAppTemplate(params: {
  toPhone: string;
  templateName: string;
  languageCode: string;
  bodyParams: string[];
  urlParam?: string;
}): Promise<SendMessageResult> {
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    console.error("[whatsapp-sender] Missing META env vars");
    return { ok: false, error: "Missing META env vars" };
  }

  const cleanTo = params.toPhone.replace(/\D/g, "");
  if (cleanTo.length < 8) {
    return { ok: false, error: `Numero invalido: ${params.toPhone}` };
  }

  const components: Array<Record<string, unknown>> = [
    {
      type: "body",
      parameters: params.bodyParams.map((t) => ({ type: "text", text: t })),
    },
  ];

  if (params.urlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: params.urlParam }],
    });
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanTo,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      components,
    },
  };

  try {
    const res = await fetch(`${META_API_BASE}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[whatsapp-sender] template error:", res.status, JSON.stringify(data));
      const errMsg = (data as { error?: { message?: string } })?.error?.message
        ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }

    const msgId = (data as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id;
    return { ok: true, metaMessageId: msgId };
  } catch (err) {
    console.error("[whatsapp-sender] template fetch error:", err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Marca un mensaje entrante como leído (los dos checks azules en la conversación).
 * Es opcional pero mejora la UX percibida — el usuario ve que "lo leyó".
 */
export async function markAsRead(metaMessageId: string): Promise<void> {
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) return;

  try {
    await fetch(`${META_API_BASE}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: metaMessageId,
      }),
    });
  } catch (err) {
    // No es crítico, lo logueamos y seguimos
    console.error("[whatsapp-sender] markAsRead error:", err);
  }
}
