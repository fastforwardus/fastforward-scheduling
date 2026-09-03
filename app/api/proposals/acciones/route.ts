export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { enviarPropuestaPorEmail } from "@/lib/proposal-email";
import { findOrCreateZohoBooksContact, createZohoBooksInvoice, markZohoBooksInvoiceSent } from "@/lib/zohobooks";
import { ProposalData } from "@/lib/proposal-pdf";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, servicios, discount, motivo } = body;
  let accion: string = body.accion;
  if (!id || !accion) return NextResponse.json({ error: "Faltan id o accion" }, { status: 400 });

  const filas = await db.execute(sql`
    select p.*, coalesce(a.client_name, p.client_name) cli_nombre,
           coalesce(a.client_email, p.client_email) cli_email,
           coalesce(a.client_company, '') cli_empresa,
           a.assigned_to
    from proposals p
    left join appointments a on a.id::text = p.appointment_id::text
    where p.id = ${id} limit 1
  `);
  const p = (Array.isArray(filas) ? filas[0] : null) as Record<string, unknown> | null;
  if (!p) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });

  const esDueno = String(p.sent_by_id ?? "") === session.id
    || String(p.assigned_to ?? "") === session.id
    || session.role === "admin" || session.role === "sales_manager";
  if (!esDueno) return NextResponse.json({ error: "No es tu propuesta" }, { status: 403 });

  if (p.payment_confirmed_at && accion !== "reenviar")
    return NextResponse.json({ error: "Ya esta pagada, no se puede modificar" }, { status: 409 });

  // ── REINTENTAR LA FACTURA ──
  // Si Zoho falla al aceptar, la propuesta queda aceptada y sin factura. Habia
  // USD 6.754 en ese estado, el mas viejo de hace cinco meses.
  if (accion === "generar_factura") {
    if (p.zoho_invoice_id) {
      return NextResponse.json({ error: "Ya tiene factura" }, { status: 409 });
    }
    try {
      const contacto = await findOrCreateZohoBooksContact({
        name: String(p.cli_nombre || p.client_name || "Cliente"),
        email: String(p.cli_email || p.client_email || ""),
        company: String(p.cli_empresa || ""),
      });
      const servicios = JSON.parse(String(p.services || "[]")) as
        { name: string; price: number; description?: string }[];
      const inv = await createZohoBooksInvoice({
        contactId: contacto.contact_id,
        invoiceNumber: String(p.proposal_num),
        lineItems: servicios.map((x) => ({
          name: x.name, rate: Number(x.price), quantity: 1,
        })),
      });
      await markZohoBooksInvoiceSent(inv.invoice_id);
      await db.execute(sql`
        update proposals
        set zoho_invoice_id = ${inv.invoice_id},
            zoho_contact_id = ${contacto.contact_id},
            zoho_payment_link = ${inv.invoice_url ?? null},
            zoho_invoice_missing_at = null
        where id = ${id}`);
      await db.execute(sql`
        insert into proposal_events (proposal_id, kind, channel, detail)
        values (${id}, 'accepted', 'panel',
                ${"Factura generada a mano por " + session.fullName + " — " + inv.invoice_id})`);
      return NextResponse.json({ ok: true, invoice: inv.invoice_id });
    } catch (e) {
      console.error("[propuestas] reintento de factura fallo:", e);
      return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
    }
  }

  // ── ACEPTAR A MANO ──
  // Muchos clientes cierran sin tocar el boton: pagan por transferencia, piden
  // la factura o confirman en la llamada. Sin esta accion la propuesta seguia
  // figurando pendiente, recibiendo recordatorios y sin contar en el revenue.
  if (accion === "aceptar_manual") {
    const MOTIVOS: Record<string, string> = {
      pago_directo: "Pagó directo",
      pidio_factura: "Pidió factura",
      cerro_llamada: "Cerró en la llamada",
      otro: "Otro",
    };
    const etiqueta = MOTIVOS[String(motivo || "")] || "Confirmado por el equipo";

    await db.execute(sql`
      update proposals
      set status = 'accepted',
          accepted_at = coalesce(accepted_at, now()),
          whatsapp_stage = 4
      where id = ${id}
    `);
    await db.execute(sql`
      insert into proposal_events (proposal_id, kind, channel, detail)
      values (${id}, 'accepted', 'panel',
              ${etiqueta + " — marcada por " + session.fullName})
    `);
    console.log("[propuestas] aceptada a mano:", p.proposal_num, "|", etiqueta, "|", session.fullName);
    return NextResponse.json({ ok: true, estado: "aceptada", motivo: etiqueta });
  }

  // ── ANULAR ──
  if (accion === "anular") {
    await db.execute(sql`
      update proposals set status = 'cancelled' where id = ${id}
    `);
    await db.execute(sql`
      insert into proposal_events (proposal_id, kind, channel, detail)
      values (${id}, 'cancelled', 'panel',
              ${(motivo ? "Anulada: " + motivo : "Anulada por " + session.fullName)})
    `);
    return NextResponse.json({
      ok: true,
      avisoFactura: !!p.zoho_invoice_id
        ? "Ojo: esta propuesta tiene factura en Zoho Books. Anularla aca no anula la factura alla."
        : null,
    });
  }

  // ── EDITAR ──
  if (accion === "editar") {
    if (!Array.isArray(servicios) || servicios.length === 0)
      return NextResponse.json({ error: "Faltan servicios" }, { status: 400 });

    const bruto = servicios.reduce(
      (acc: number, s: { price: number }) => acc + Number(s.price || 0), 0);
    const nuevoTotal = bruto - Number(discount || 0);

    await db.execute(sql`
      update proposals
      set services = ${JSON.stringify(servicios)}::jsonb,
          discount = ${Number(discount || 0)},
          total = ${nuevoTotal}
      where id = ${id}
    `);
    await db.execute(sql`
      insert into proposal_events (proposal_id, kind, channel, detail)
      values (${id}, 'revisada', 'panel',
              ${"Revisada por " + session.fullName + " — nuevo total USD " + nuevoTotal})
    `);

    // Al editar siempre se reenvia: el cliente tiene que ver la version nueva
    p.services = JSON.stringify(servicios);
    p.discount = Number(discount || 0);
    p.total = nuevoTotal;
    accion = "reenviar";
  }

  // ── REENVIAR ──
  if (accion === "reenviar") {
    const reps = await db.execute(sql`
      select full_name, email, slug from users
      where id = coalesce(${String(p.sent_by_id ?? "")}::uuid, ${session.id}::uuid) limit 1
    `);
    const rep = (Array.isArray(reps) ? reps[0] : null) as Record<string, string> | null;
    const repNombre = rep?.full_name || session.fullName;
    const repEmail = rep?.email || session.email;

    const servicios = typeof p.services === "string"
      ? JSON.parse(p.services as string)
      : (p.services as { name: string; price: number; description?: string }[]);

    const lang = ((p.lang as string) || "es") as "es" | "en" | "pt";
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://scheduling.fastfwdus.com";
    const vence = new Date(Date.now() + 15 * 86400000);
    const fmt = (d: Date) => d.toLocaleDateString("es-ES",
      { day: "2-digit", month: "short", year: "numeric", timeZone: "America/New_York" });

    const proposalData: ProposalData = {
      clientName: String(p.cli_empresa || p.cli_nombre || ""),
      contactName: String(p.cli_nombre || ""),
      contactEmail: String(p.cli_email || ""),
      contactPhone: "",
      contactAddress: (p.client_address as string) || undefined,
      repName: repNombre,
      repEmail,
      repSlug: rep?.slug || "book",
      proposalNum: String(p.proposal_num),
      dateStr: fmt(new Date()),
      validUntil: fmt(vence),
      lang,
      introText: "",
      services: servicios,
      discount: Number(p.discount || 0),
      total: Number(p.total),
    } as ProposalData;

    try {
      await enviarPropuestaPorEmail({
        proposalData,
        proposalNum: String(p.proposal_num),
        total: Number(p.total),
        lang,
        clienteNombre: String(p.cli_nombre || ""),
        clienteEmpresa: String(p.cli_empresa || ""),
        clienteEmail: String(p.cli_email || ""),
        repNombre, repEmail,
        confirmUrl: `${base}/proposal/confirm/${p.confirm_token}`,
        validUntilStr: fmt(vence),
        esReenvio: true,
      });
    } catch (err) {
      console.error("reenvio error:", err);
      return NextResponse.json({ error: "No se pudo reenviar", detalle: String(err) }, { status: 502 });
    }

    await db.execute(sql`
      insert into proposal_events (proposal_id, kind, channel, detail)
      values (${id}, 'reenviada', 'email',
              ${"Reenviada por " + session.fullName + " a " + String(p.cli_email || "")})
    `);
    return NextResponse.json({ ok: true, a: p.cli_email, total: Number(p.total) });
  }

  return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
}
