-- 024_product_code.sql
-- Adds a unique, short, human-readable product code to every product.
-- Format: zero-padded 3-digit integer (001, 002, …) that grows as the catalog grows.
-- Existing products are backfilled using their primary key cast to 3 digits.
-- The code is stored separately from the database PK so it never changes
-- even if the PK sequence changes.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_code TEXT;

-- Backfill existing products: code = LPAD(id::text, 3, '0')
-- If a product already has a code (from an earlier migration or import) we skip it.
UPDATE products
  SET product_code = LPAD(id::text, 3, '0')
  WHERE product_code IS NULL;

-- Make it non-nullable and unique going forward
ALTER TABLE products
  ALTER COLUMN product_code SET NOT NULL,
  ADD CONSTRAINT uq_products_product_code UNIQUE (product_code);

-- Sequence table for generating the next product code
CREATE TABLE IF NOT EXISTS product_code_sequence (
  id          SERIAL PRIMARY KEY,
  last_code   INTEGER NOT NULL DEFAULT 0
);

-- Seed with the highest existing code so the next auto-generated code is unique
INSERT INTO product_code_sequence (last_code)
SELECT COALESCE(MAX(product_code::integer), 0) FROM products
  WHERE product_code ~ '^\d+$'
ON CONFLICT (id) DO UPDATE SET last_code = EXCLUDED.last_code;

-- Index for fast code lookup from the billing search
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);

COMMENT ON COLUMN products.product_code IS
  'Short human-readable code (001, 002, …) unique per product, permanent, used for fast billing lookup.';
