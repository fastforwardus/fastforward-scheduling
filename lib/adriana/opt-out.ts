/**
 * Deteccion de pedidos de baja en mensajes entrantes de WhatsApp.
 * Se evalua ANTES del engine: si el cliente pidio la baja, Adriana no responde nada mas.
 */

// Palabras exactas, no subcadenas: "parar" no debe matchear dentro de otra palabra,
// y un mensaje largo que menciona "baja" al pasar no es un opt-out.
const OPT_OUT_WORDS = [
  "baja", "stop", "cancelar", "unsubscribe", "sair", "parar",
  "desuscribir", "desuscribirme", "remover", "quitar",
  "no molestar", "dejen de escribir", "no escribir",
];

export function isOptOutMessage(text: string): boolean {
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // sin acentos
    .replace(/[^\w\s]/g, " ")           // sin puntuacion
    .replace(/\s+/g, " ")
    .trim();

  if (!norm) return false;

  // Solo consideramos opt-out mensajes cortos: evita falsos positivos
  // en consultas largas donde aparece "cancelar" en otro contexto.
  if (norm.split(" ").length > 4) return false;

  return OPT_OUT_WORDS.some((w) => norm === w || norm.startsWith(w + " ") || norm.endsWith(" " + w));
}

export const OPT_OUT_REPLY: Record<"es" | "en" | "pt", string> = {
  es: "Listo, no vas a recibir mas mensajes nuestros por WhatsApp. Si en algun momento queres retomar, escribinos cuando quieras.",
  en: "Done, you will not receive any more WhatsApp messages from us. If you ever want to get back in touch, just write to us.",
  pt: "Pronto, voce nao vai receber mais mensagens nossas pelo WhatsApp. Se quiser retomar em algum momento, e so escrever.",
};
