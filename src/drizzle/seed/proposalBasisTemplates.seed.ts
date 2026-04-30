/**
 * Seed default Proposal Basis Templates for each job type.
 * Run this after running the migration that adds `job_type` and `items` columns.
 *
 * Usage: ts-node -r tsconfig-paths/register src/drizzle/seed/proposalBasisTemplates.seed.ts
 */

import { db } from "../../config/db.js";
import { proposalBasisTemplates } from "../schema/settings.schema.js";
import { eq, and } from "drizzle-orm";

const DEFAULT_TEMPLATES = [
  {
    label: "General",
    jobType: "general",
    sortOrder: 0,
    items: [
      "Provide M sheets and design for city permit set",
      "Demo and safe off ductwork to be removed (off haul by others)",
      "Provide and install ( ) rooftop package units",
      "Provide and install all distribution ductwork per plans",
      "Provide and install secondary condensate pans on all above grid F/C units",
      "Provide and install ( ) fire smoke dampers — 1 for each firewall penetration",
      "Provide and install new T-bar supply and return diffusers",
      "Provide and coordinate crane services",
      "Provide and install proper support to meet SMACNA and local code requirements throughout",
      "Provide and install hardwired thermostat",
      "Provide start up on new units",
      "Provide scissor lift",
      "Provide third party air balance and report",
      "Provide T3 comfort air balance and report",
      "Ensure proper functionality",
    ],
  },
  {
    label: "Preventative Maintenance",
    jobType: "preventative_maintenance",
    sortOrder: 1,
    items: [
      "Remove and replace MERV 13 filters on all HVAC units — total of ( ) RTUs",
      "Visually check all belts, compressors, coils, and condensate lines",
      "Visually check all exhaust fans are working properly",
      "Visually check all mushroom exhaust fans",
      "Provide maintenance checklist",
    ],
  },
];

async function seedProposalBasisTemplates() {
  console.log("Seeding proposal basis templates...");

  for (const tpl of DEFAULT_TEMPLATES) {
    // Check if a template with the same label + jobType already exists
    const [existing] = await db
      .select({ id: proposalBasisTemplates.id })
      .from(proposalBasisTemplates)
      .where(
        and(
          eq(proposalBasisTemplates.label, tpl.label),
          eq(proposalBasisTemplates.isDeleted, false),
        ),
      )
      .limit(1);

    if (existing) {
      console.log(`  Skipping "${tpl.label}" — already exists (id: ${existing.id})`);
      continue;
    }

    const [created] = await db
      .insert(proposalBasisTemplates)
      .values({
        label: tpl.label,
        jobType: tpl.jobType,
        items: tpl.items,
        template: tpl.items.map((line, i) => `${i + 1}. ${line}`).join("\n"),
        sortOrder: tpl.sortOrder,
        isActive: true,
        isDeleted: false,
      })
      .returning({ id: proposalBasisTemplates.id, label: proposalBasisTemplates.label });

    if (created) console.log(`  Created "${created.label}" (id: ${created.id})`);
  }

  console.log("Done seeding proposal basis templates.");
  process.exit(0);
}

seedProposalBasisTemplates().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
