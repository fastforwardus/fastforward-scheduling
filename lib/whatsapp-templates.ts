/**
 * Copia local del texto de las plantillas aprobadas en Meta.
 * Sirve para dejar en el panel de Adriana exactamente lo que ve el cliente,
 * en vez de un marcador interno.
 *
 * IMPORTANTE: si se edita una plantilla en WhatsApp Manager, hay que
 * actualizarla aca tambien o el historial va a mentir.
 */

type Lang = "es" | "en" | "pt_BR";

interface Tpl {
  body: string;
  btn: string;
}

const TEMPLATES: Record<string, Record<Lang, Tpl>> = {
  propuesta_recordatorio_1: {
    es: { body: "Hola {{1}}, soy Adriana de FastForward. Te enviamos la propuesta {{2}} y queria saber si pudiste revisarla. Si tenes alguna duda respondeme por aca.", btn: "Ver propuesta" },
    en: { body: "Hi {{1}}, this is Adriana from FastForward. We sent you proposal {{2}} and wanted to check if you had a chance to review it. If you have any questions just reply here.", btn: "View proposal" },
    pt_BR: { body: "Ola {{1}}, sou Adriana da FastForward. Enviamos a proposta {{2}} e queria saber se voce conseguiu revisar. Se tiver alguma duvida responda por aqui.", btn: "Ver proposta" },
  },
  propuesta_recordatorio_2: {
    es: { body: "Hola {{1}}, te escribo de nuevo por la propuesta {{2}}. Sigue disponible y el plazo se acerca. Si queres avanzar o resolver alguna duda, respondeme por aca.", btn: "Ver propuesta" },
    en: { body: "Hi {{1}}, following up on proposal {{2}}. It is still available and the deadline is approaching. If you want to move ahead or have questions, just reply here.", btn: "View proposal" },
    pt_BR: { body: "Ola {{1}}, escrevo de novo sobre a proposta {{2}}. Continua disponivel e o prazo esta chegando. Se quiser avancar ou tirar duvidas, responda por aqui.", btn: "Ver proposta" },
  },
  propuesta_vencimiento: {
    es: { body: "Hola {{1}}, ultimo aviso: la propuesta {{2}} vence pronto. Si queres asegurar las condiciones actuales, es el momento de confirmarla.", btn: "Confirmar ahora" },
    en: { body: "Hi {{1}}, final notice: proposal {{2}} expires soon. To lock in the current terms, now is the time to confirm it.", btn: "Confirm now" },
    pt_BR: { body: "Ola {{1}}, ultimo aviso: a proposta {{2}} expira em breve. Para garantir as condicoes atuais, e hora de confirma-la.", btn: "Confirmar agora" },
  },
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";

/** Devuelve el mensaje tal como le llega al cliente, con el boton al pie. */
export function renderTemplate(
  name: string,
  langCode: string,
  params: string[],
  urlParam?: string,
): string {
  const tpl = TEMPLATES[name]?.[langCode as Lang] ?? TEMPLATES[name]?.es;
  if (!tpl) return `[${name}] ${params.join(" · ")}`;

  let texto = tpl.body;
  params.forEach((v, i) => {
    texto = texto.split(`{{${i + 1}}}`).join(v);
  });

  const link = urlParam ? `${APP_URL}/proposal/confirm/${urlParam}` : "";
  return link ? `${texto}\n\n▸ ${tpl.btn}: ${link}` : texto;
}
