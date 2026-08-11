/**
 * Importa el Excel de leads a la tabla campana_leads.
 *
 * Uso, desde la raiz del proyecto:
 *   node ff-importar.js ~/Downloads/leads-prioritarios-resuelto.xlsx
 *   node ff-importar.js ~/Downloads/leads-prioritarios-resuelto.xlsx --dry
 *
 * Solo carga las filas que tienen telefono_e164 resuelto. El resto se ignora.
 * Si un telefono ya existe en la tabla, no se duplica.
 */
const XLSX = require("xlsx");
const postgres = require("postgres");
const fs = require("fs");
require("dotenv").config({ path: ".env.production" });

const archivo = process.argv[2];
const simular = process.argv.includes("--dry");

if (!archivo || !fs.existsSync(archivo)) {
  console.error("Uso: node ff-importar.js <archivo.xlsx> [--dry]");
  process.exit(1);
}

// El idioma ya viene resuelto en el archivo, con el pais verificado.
// Solo se deduce si falta, y ahi se asume espanol por ser la mayoria.
function idiomaDe(fila) {
  const i = String(fila.idioma || "").trim().toLowerCase();
  if (["es", "en", "pt"].includes(i)) return i;
  return "es";
}

// Servicios en ingles del formulario EN, para que el mensaje no mezcle idiomas
function limpiarTema(s) {
  const t = String(s || "").trim();
  if (!t || t.length < 3) return null;
  if (/^(otro|other|n\/a|na|-)$/i.test(t)) return null;
  // Placeholders del propio formulario, no son un servicio real
  if (/^(servicio de inter[eé]s|interest service|select|seleccion)/i.test(t)) return null;
  return t.slice(0, 60);
}

(async () => {
  const wb = XLSX.readFile(archivo);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log("Filas en el archivo:", filas.length);

  const validas = filas.filter((f) => {
    const t = String(f.telefono_e164 || "").replace(/\D/g, "");
    return t.length >= 10 && t.length <= 15;
  });
  console.log("Con telefono resuelto:", validas.length);

  const porIdioma = {};
  for (const f of validas) {
    const i = idiomaDe(f);
    porIdioma[i] = (porIdioma[i] || 0) + 1;
  }
  console.log("Por idioma:", porIdioma);
  console.log();

  if (simular) {
    console.log("SIMULACION — no se inserta nada. Muestra de 10:");
    console.table(validas.slice(0, 10).map((f) => ({
      nombre: String(f.nombre || "").slice(0, 24),
      telefono: f.telefono_e164,
      idioma: idiomaDe(f),
      tema: limpiarTema(f.servicio) || "(generico)",
      meses: f.antiguedad_meses,
    })));
    return;
  }

  const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });
  let insertados = 0, repetidos = 0;

  for (const f of validas) {
    const tel = String(f.telefono_e164).replace(/\D/g, "");
    try {
      const r = await sql`
        insert into campana_leads
          (nombre, empresa, email, telefono_e164, servicio, idioma, fecha_lead, antiguedad_meses)
        values (
          ${String(f.nombre || "").slice(0, 80) || null},
          ${String(f.empresa || "").slice(0, 80) || null},
          ${String(f.email || "").toLowerCase() || null},
          ${tel},
          ${limpiarTema(f.servicio)},
          ${idiomaDe(f)},
          ${f.fecha ? new Date(f.fecha) : null},
          ${f.antiguedad_meses != null ? Number(f.antiguedad_meses) : null}
        )
        on conflict (telefono_e164) do nothing
        returning id`;
      if (r.length) insertados++; else repetidos++;
    } catch (e) {
      console.error("Error con", tel, String(e).slice(0, 80));
    }
  }

  const resumen = await sql`
    select estado, count(*)::int n from campana_leads group by estado order by n desc`;
  const edades = await sql`
    select case
      when antiguedad_meses <= 9 then '1. hasta 9 meses'
      when antiguedad_meses <= 12 then '2. 9 a 12 meses'
      else '3. mas de 12 meses' end tramo,
      count(*)::int n
    from campana_leads where estado = 'pendiente' group by 1 order by 1`;

  console.log("Insertados:", insertados, "| ya estaban:", repetidos);
  console.log();
  console.log("ESTADO DE LA CAMPANA:"); console.table(resumen);
  console.log("PENDIENTES POR ANTIGUEDAD:"); console.table(edades);

  await sql.end();
})();
