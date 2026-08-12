/**
 * Importa leads de feria a campana_leads.
 * Marca origen='expo' y guarda el vendedor, que es lo que hace personal
 * el mensaje ("hablaste con Francisco de nuestro equipo").
 *
 *   node ff-importar-expo.js archivo.xlsx --dry
 */
const XLSX = require("xlsx");
const postgres = require("postgres");
const fs = require("fs");
require("dotenv").config({ path: ".env.production" });

const archivo = process.argv[2];
const simular = process.argv.includes("--dry");
if (!archivo || !fs.existsSync(archivo)) {
  console.error("Uso: node ff-importar-expo.js <archivo.xlsx> [--dry]");
  process.exit(1);
}

const idiomaDe = (f) => {
  const i = String(f.idioma || "").trim().toLowerCase();
  return ["es", "en", "pt"].includes(i) ? i : "en";
};

(async () => {
  const wb = XLSX.readFile(archivo);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const validas = filas.filter((f) => {
    const t = String(f.telefono_e164 || "").replace(/\D/g, "");
    return t.length >= 10 && t.length <= 15 && String(f.vendedor || "").trim();
  });
  console.log("Filas:", filas.length, "| validas:", validas.length);

  const porIdioma = {}, porVendedor = {};
  for (const f of validas) {
    const i = idiomaDe(f); porIdioma[i] = (porIdioma[i] || 0) + 1;
    const v = String(f.vendedor).trim(); porVendedor[v] = (porVendedor[v] || 0) + 1;
  }
  console.log("Por idioma:", porIdioma);
  console.log("Por vendedor:", porVendedor);
  console.log();

  if (simular) {
    console.log("SIMULACION — no se inserta nada. Muestra de 10:");
    console.table(validas.slice(0, 10).map((f) => ({
      nombre: String(f.nombre || "").slice(0, 24),
      empresa: String(f.empresa || "").slice(0, 24),
      telefono: f.telefono_e164,
      idioma: idiomaDe(f),
      vendedor: f.vendedor,
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
          (nombre, empresa, email, telefono_e164, idioma, fecha_lead,
           antiguedad_meses, origen, vendedor, evento)
        values (
          ${String(f.nombre || "").slice(0, 80) || null},
          ${String(f.empresa || "").slice(0, 80) || null},
          ${String(f.email || "").toLowerCase() || null},
          ${tel}, ${idiomaDe(f)},
          ${f.fecha ? new Date(f.fecha) : null},
          ${f.antiguedad_meses != null ? Number(f.antiguedad_meses) : null},
          'expo',
          ${String(f.vendedor || "").trim() || null},
          ${String(f.evento || "").trim() || null}
        )
        on conflict (telefono_e164) do nothing
        returning id`;
      if (r.length) insertados++; else repetidos++;
    } catch (e) { console.error("Error con", tel, String(e).slice(0, 80)); }
  }
  const res = await sql`select origen, estado, count(*)::int n from campana_leads group by 1,2 order by 1,3 desc`;
  console.log("Insertados:", insertados, "| ya estaban:", repetidos);
  console.log(); console.table(res);
  await sql.end();
})();
