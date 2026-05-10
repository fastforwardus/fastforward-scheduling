/**
 * Devuelve la URL base del proyecto para self-fetch interno.
 * Prefiere NEXT_PUBLIC_SITE_URL (nuestra var dedicada).
 * Fallback a VERCEL_URL si está en Vercel sin la var seteada.
 * Último fallback: dominio prod hardcoded.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://scheduling.fastfwdus.com";
}
