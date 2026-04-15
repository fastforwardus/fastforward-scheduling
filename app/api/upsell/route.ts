import { NextRequest, NextResponse } from "next/server";
import { getQBCustomersWithServices } from "@/lib/quickbooks";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Servicios relacionados para upsell
const UPSELL_MAP: Record<string, { name: string; price: number; desc: string }[]> = {
  "fda": [
    { name: "Revision de etiquetas", price: 595, desc: "Asegura que tus etiquetas cumplan 100% con los requisitos FDA" },
    { name: "FSVP", price: 395, desc: "Foreign Supplier Verification Program — requerido para importadores" },
    { name: "Registro de Marca USPTO", price: 2000, desc: "Proteja su marca en el mercado americano" },
    { name: "Registro de Empresa LLC en Miami", price: 1100, desc: "Opere legalmente en EE.UU. con su propia LLC" },
  ],
  "etiqueta": [
    { name: "Registro Establecimiento FDA", price: 595, desc: "Registre su establecimiento ante la FDA" },
    { name: "FSVP", price: 395, desc: "Cumple con las regulaciones de importacion" },
  ],
  "llc": [
    { name: "Registro de Marca USPTO", price: 2000, desc: "Proteja su marca — la LLC es requisito previo" },
    { name: "Operating Agreement", price: 450, desc: "Documente la estructura y operación de su LLC" },
    { name: "Registro Establecimiento FDA", price: 595, desc: "Exporta productos regulados a EE.UU." },
  ],
  "marca": [
    { name: "Registro Establecimiento FDA", price: 595, desc: "Exporta productos regulados a EE.UU." },
    { name: "Registro de Empresa LLC en Miami", price: 1100, desc: "Opera legalmente en EE.UU." },
  ],
  "alcohol": [
    { name: "Registro de Marca USPTO", price: 2000, desc: "Proteja su marca de bebidas en EE.UU." },
    { name: "Registro de Empresa LLC en Miami", price: 1100, desc: "Opera legalmente en EE.UU." },
  ],
};

function getUpsellServices(services: string[]): { name: string; price: number; desc: string }[] {
  const servicesLower = services.map(s => s.toLowerCase()).join(" ");
  const suggestions: { name: string; price: number; desc: string }[] = [];
  const seen = new Set<string>();

  const addSuggestions = (key: string) => {
    if (UPSELL_MAP[key]) {
      for (const svc of UPSELL_MAP[key]) {
        // Skip if customer already has this service
        const alreadyHas = services.some(s => s.toLowerCase().includes(svc.name.toLowerCase().split(" ")[0]));
        if (!alreadyHas && !seen.has(svc.name)) {
          seen.add(svc.name);
          suggestions.push(svc);
        }
      }
    }
  };

  if (servicesLower.includes("fda") || servicesLower.includes("establecimiento")) addSuggestions("fda");
  if (servicesLower.includes("etiqueta") || servicesLower.includes("label")) addSuggestions("etiqueta");
  if (servicesLower.includes("llc") || servicesLower.includes("empresa")) addSuggestions("llc");
  if (servicesLower.includes("marca") || servicesLower.includes("uspto")) addSuggestions("marca");
  if (servicesLower.includes("alcohol") || servicesLower.includes("licencia")) addSuggestions("alcohol");

  return suggestions.slice(0, 3); // Max 3 sugerencias
}

async function generateUpsellEmail(params: {
  customerName: string;
  services: string[];
  suggestions: { name: string; price: number; desc: string }[];
}): Promise<string> {
  const firstName = params.customerName.split(" ")[0];
  const servicesStr = params.services.slice(0, 3).join(", ");
  const suggestionsStr = params.suggestions.map(s => `- ${s.name} (USD ${s.price}): ${s.desc}`).join("\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20251001",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `Eres el asistente de FastForward LLC, consultora de Miami especializada en FDA compliance y entrada al mercado de EE.UU.
Escribe un email de upsell en español profesional y cálido para ${firstName} de ${params.customerName}.
Ya contrató: ${servicesStr}.
Sugiere estos servicios complementarios:
${suggestionsStr}

El email debe:
- Ser breve (max 80 palabras)
- Mencionar que ya trabajaron juntos y fue exitoso
- Presentar 1-2 servicios como oportunidad natural para crecer
- Tener un CTA claro para agendar una consulta gratuita en https://scheduling.fastfwdus.com/book
- Sin emojis. Sin asunto. Solo el cuerpo en HTML simple (p, strong, a tags). 
- Firma: Carlos Bisio | FastForward FDA Experts`
    }],
  });

  return message.content[0].type === "text" ? message.content[0].text.trim() : "";
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
  const results = { processed: 0, sent: 0, skipped: 0, errors: 0 };

  try {
    const customers = await getQBCustomersWithServices();
    console.log(`QB customers con servicios: ${customers.length}`);

    for (const customer of customers) {
      if (!customer.email) { results.skipped++; continue; }
      if (customer.hasPendingBalance) { results.skipped++; continue; } // No upsell a clientes con saldo pendiente

      const suggestions = getUpsellServices(customer.services);
      if (suggestions.length === 0) { results.skipped++; continue; }

      try {
        const emailBody = await generateUpsellEmail({
          customerName: customer.name,
          services: customer.services,
          suggestions,
        });

        const suggestionsHtml = suggestions.map(s => `
          <div style="background:#F8F9FB;border-radius:10px;padding:14px;margin-bottom:10px;border:1px solid #E5E7EB;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong style="color:#27295C;font-size:14px;">${s.name}</strong>
              <span style="color:#C9A84C;font-weight:700;font-size:14px;">USD ${s.price.toLocaleString()}</span>
            </div>
            <p style="color:#6B7280;font-size:13px;margin:0;">${s.desc}</p>
          </div>
        `).join("");

        await resend.emails.send({
          from: "Carlos Bisio — FastForward <info@fastfwdus.com>",
          replyTo: "info@fastfwdus.com",
          to: customer.email,
          subject: `${customer.name.split(" ")[0]}, una oportunidad para seguir creciendo en EE.UU.`,
          html: `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <div style="background:#27295C;border-radius:16px 16px 0 0;padding:28px;text-align:center;">
    <img src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png" height="32" alt="FastForward">
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;border:1px solid #E5E7EB;border-top:none;">
    ${emailBody}
    <div style="margin:24px 0;">
      <p style="font-size:13px;font-weight:700;color:#27295C;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Servicios complementarios</p>
      ${suggestionsHtml}
    </div>
    <a href="${appUrl}/book"
       style="display:block;text-align:center;background:#C9A84C;color:#1A1C3E;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;margin-bottom:16px;">
      Agendar consulta gratuita →
    </a>
    <div style="border-top:1px solid #F0F0F0;padding-top:20px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">FastForward Trading Company LLC · Miami, FL</p>
      <a href="https://fastfwdus.com" style="font-size:12px;color:#C9A84C;">fastfwdus.com</a>
    </div>
  </div>
</div>`,
        });

        results.sent++;
        console.log(`✅ Upsell enviado a: ${customer.name} (${customer.email})`);

        // Rate limit — esperar entre emails
        await new Promise(r => setTimeout(r, 2000));

      } catch (err) {
        console.error(`❌ Error con ${customer.name}:`, err);
        results.errors++;
      }

      results.processed++;
    }
  } catch (err) {
    console.error("QB error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...results });
}
