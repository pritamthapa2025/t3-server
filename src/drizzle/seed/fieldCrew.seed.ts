/**
 * Field Crew Seed
 * ============================================================
 * Creates (or ensures existence of) the "Field Crew" department
 * and three canonical field positions used as default labor lines
 * when a new bid is created:
 *
 *   • Foreman     — preset slot "foreman"
 *   • Journeyman  — preset slot "journeyman"
 *   • Apprentice  — preset slot "apprentice"
 *
 * Each position also gets a matching row in auth.labor_rate_templates
 * so that the bid form auto-fills cost/billable rates.
 *
 * Run:   pnpm seed:field-crew   (or npm run seed:field-crew)
 *
 * Safe to re-run: all inserts use onConflictDoNothing / onConflictDoUpdate.
 */

import { db } from "../../config/db.js";
import { eq } from "drizzle-orm";
import { departments, positions } from "../schema/org.schema.js";
import { laborRateTemplates } from "../schema/settings.schema.js";

// ---------------------------------------------------------------------------
// Preset definitions — change rates here if needed; everything else follows
// ---------------------------------------------------------------------------
const PRESET_POSITIONS = [
  {
    name: "Foreman",
    laborPresetRole: "foreman" as const,
    description: "Field crew lead responsible for supervising on-site work",
    payRate: "55.00",
    payType: "Hourly",
    sortOrder: 1,
    // Bid default rates (stored in labor_rate_templates)
    defaultDays: 1,          // template days — overridden to 0 on new-bid seed
    defaultHoursPerDay: "8.00",
    defaultCostRate: "55.00",
    defaultBillableRate: "110.00",
  },
  {
    name: "Journeyman",
    laborPresetRole: "journeyman" as const,
    description: "Experienced HVAC technician working under the foreman",
    payRate: "45.00",
    payType: "Hourly",
    sortOrder: 2,
    defaultDays: 1,
    defaultHoursPerDay: "8.00",
    defaultCostRate: "45.00",
    defaultBillableRate: "90.00",
  },
  {
    name: "Apprentice",
    laborPresetRole: "apprentice" as const,
    description: "Entry-level field technician learning on the job",
    payRate: "25.00",
    payType: "Hourly",
    sortOrder: 3,
    defaultDays: 1,
    defaultHoursPerDay: "8.00",
    defaultCostRate: "25.00",
    defaultBillableRate: "65.00",
  },
] as const;

export const seedFieldCrew = async () => {
  console.log("🔧  Seeding Field Crew department & positions...");

  // ------------------------------------------------------------------
  // 1. Upsert the "Field Crew" department
  // ------------------------------------------------------------------
  const [dept] = await db
    .insert(departments)
    .values({
      name: "Field Crew",
      description: "Default department for field labor positions used in bids",
      isActive: true,
      sortOrder: 0,
    })
    .onConflictDoUpdate({
      target: departments.name,
      set: {
        description: "Default department for field labor positions used in bids",
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning({ id: departments.id, name: departments.name });

  if (!dept) throw new Error("Failed to upsert Field Crew department");

  console.log(`  ✓  Department "${dept.name}" (id=${dept.id})`);

  // ------------------------------------------------------------------
  // 2. Upsert positions + labor_rate_templates for each preset slot
  // ------------------------------------------------------------------
  for (const preset of PRESET_POSITIONS) {
    // Upsert the position
    const [pos] = await db
      .insert(positions)
      .values({
        name: preset.name,
        departmentId: dept.id,
        description: preset.description,
        payRate: preset.payRate,
        payType: preset.payType,
        isFieldRole: true,
        isActive: true,
        sortOrder: preset.sortOrder,
        laborPresetRole: preset.laborPresetRole,
      })
      .onConflictDoUpdate({
        // unique_position_name_per_dept: (name, department_id)
        target: [positions.name, positions.departmentId],
        set: {
          description: preset.description,
          payRate: preset.payRate,
          payType: preset.payType,
          isFieldRole: true,
          isActive: true,
          sortOrder: preset.sortOrder,
          laborPresetRole: preset.laborPresetRole,
          updatedAt: new Date(),
        },
      })
      .returning({ id: positions.id, name: positions.name });

    if (!pos) throw new Error(`Failed to upsert position: ${preset.name}`);

    console.log(`  ✓  Position "${pos.name}" (id=${pos.id})`);

    // Upsert the matching labor_rate_templates row
    // Check if one already exists for this position
    const existing = await db
      .select({ id: laborRateTemplates.id })
      .from(laborRateTemplates)
      .where(eq(laborRateTemplates.positionId, pos.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(laborRateTemplates).values({
        positionId: pos.id,
        defaultDays: preset.defaultDays,
        defaultHoursPerDay: preset.defaultHoursPerDay,
        defaultCostRate: preset.defaultCostRate,
        defaultBillableRate: preset.defaultBillableRate,
      });
      console.log(`    ✓  Created labor_rate_template for "${pos.name}"`);
    } else {
      await db
        .update(laborRateTemplates)
        .set({
          defaultDays: preset.defaultDays,
          defaultHoursPerDay: preset.defaultHoursPerDay,
          defaultCostRate: preset.defaultCostRate,
          defaultBillableRate: preset.defaultBillableRate,
          updatedAt: new Date(),
        })
        .where(eq(laborRateTemplates.positionId, pos.id));
      console.log(`    ✓  Updated labor_rate_template for "${pos.name}"`);
    }
  }

  console.log("\n✅  Field Crew seed complete!\n");
  console.log(
    "   Preset slots assigned — frontend will read positions where\n" +
    "   laborPresetRole IN ('foreman','journeyman','apprentice')\n" +
    "   and pre-populate 3 labor rows (0 days) on every new bid.\n",
  );
};

// Run when called directly
const runSeed = async () => {
  try {
    await seedFieldCrew();
    process.exit(0);
  } catch (error) {
    console.error("Field Crew seed failed:", error);
    process.exit(1);
  }
};

runSeed();
