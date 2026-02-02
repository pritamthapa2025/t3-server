-- Add total_price (price to client, with markup) and gross_profit (totalPrice - totalCost) to bid_financial_breakdown
ALTER TABLE "org"."bid_financial_breakdown"
  ADD COLUMN "total_price" numeric(15, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "gross_profit" numeric(15, 2) NOT NULL DEFAULT '0';
