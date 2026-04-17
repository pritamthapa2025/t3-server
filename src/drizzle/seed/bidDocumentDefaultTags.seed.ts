/**
 * Seed Default Document Tags for All Existing Bids
 *
 * Inserts the three protected default tags into every existing bid that does
 * not already have them.  Safe to run multiple times — uses ON CONFLICT DO
 * NOTHING via seedDefaultDocumentTagsForBid.
 *
 * Usage:
 *   pnpm run seed:bid-default-tags
 */

import { db } from "../../config/db.js";
import { bidsTable } from "../schema/bids.schema.js";
import {
  seedDefaultDocumentTagsForBid,
  DEFAULT_DOCUMENT_TAG_NAMES,
} from "../../services/bid.service.js";

async function seedBidDocumentDefaultTags(): Promise<void> {
  console.log("🏷️  Seeding default document tags for all existing bids...\n");
  console.log(
    `   Default tags: ${DEFAULT_DOCUMENT_TAG_NAMES.map((n) => `"${n}"`).join(", ")}\n`,
  );

  // Fetch all bid IDs
  const bids = await db.select({ id: bidsTable.id }).from(bidsTable);

  if (bids.length === 0) {
    console.log("   No bids found — nothing to seed.");
    return;
  }

  console.log(`   Found ${bids.length} bid(s). Inserting default tags...\n`);

  let success = 0;
  let failed = 0;

  for (const bid of bids) {
    try {
      await seedDefaultDocumentTagsForBid(bid.id);
      success++;
    } catch (err) {
      console.error(`   ❌ Failed for bid ${bid.id}:`, err);
      failed++;
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Processed : ${bids.length} bid(s)`);
  console.log(`   Succeeded : ${success}`);
  if (failed > 0) console.log(`   Failed    : ${failed}`);
}

seedBidDocumentDefaultTags()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
