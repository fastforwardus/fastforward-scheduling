import { config } from "dotenv";
config({ path: ".env.meta", override: true });

const token = (process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim();
console.log("Token presente:", token.length > 0, "| largo:", token.length);
if (!token) process.exit(1);

const WABA = "1509260374256987";
const res = await fetch(`https://graph.facebook.com/v22.0/${WABA}/message_templates?fields=name,status,language,category&limit=100`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
if (!res.ok) { console.error("Error:", JSON.stringify(data)); process.exit(1); }
const rows = (data.data || []).map(t => ({ name: t.name, lang: t.language, status: t.status, cat: t.category }));
rows.sort((a, b) => a.name.localeCompare(b.name) || a.lang.localeCompare(b.lang));
console.table(rows);
