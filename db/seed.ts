import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashSync } from "bcryptjs";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

const USERS = [
  { fullName: "Carlos Bisio",           email: "info@fastfwdus.com",       role: "admin" as const,         slug: "carlos",    whatsappPhone: "+13050000001" },
  { fullName: "Tomás Marino",           email: "tmarino@fastfwdus.com",    role: "sales_manager" as const,  slug: "tomas",     whatsappPhone: "+13050000002" },
  { fullName: "Daiana Guastella",       email: "dguastella@fastfwdus.com", role: "sales_rep" as const,      slug: "daiana",    whatsappPhone: "+13050000003" },
  { fullName: "Francisco Logarzo",      email: "flogarzo@fastfwdus.com",   role: "sales_rep" as const,      slug: "francisco", whatsappPhone: "+13050000004" },
  { fullName: "Emiliano Caracciolo",    email: "renewals@fastfwdus.com",   role: "sales_rep" as const,      slug: "emiliano",  whatsappPhone: "+13050000005" },
  { fullName: "Mauricio Lobatón",       email: "mx@fastfwdus.com",         role: "sales_rep" as const,      slug: "mauricio",  whatsappPhone: "+13050000006" },
];

const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Lun–Vie

async function seed() {
  console.log("\n🌱 Seeding FastForward database...\n");

  for (const u of USERS) {
    const passwordHash = hashSync("FastForward2024!", 12);

    const [user] = await db
      .insert(schema.users)
      .values({ ...u, passwordHash, isActive: true })
      .onConflictDoUpdate({
        target: schema.users.email,
        set: { fullName: u.fullName, slug: u.slug, role: u.role, isActive: true },
      })
      .returning();

    console.log(`✓ ${user.fullName} (${user.role}) → /book/${user.slug}`);

    // Availability Mon–Fri 9–18 EST
    for (const day of DEFAULT_DAYS) {
      await db
        .insert(schema.availabilityRules)
        .values({ userId: user.id, dayOfWeek: day, startTime: "09:00", endTime: "18:00", isActive: true })
        .onConflictDoNothing();
    }
  }

  console.log("\n✅ Seed completado");
  console.log("🔑 Password default: FastForward2024!");
  console.log("⚠️  Cambiá los passwords en el primer login\n");

  await client.end();
}

seed().catch((e) => { console.error("❌", e); process.exit(1); });
