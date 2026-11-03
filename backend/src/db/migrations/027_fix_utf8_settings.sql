-- 027_fix_utf8_settings.sql
-- Bonus Fix 3: Repair UTF-8 double-encoding in the settings address field.
-- The pattern "â€"" is the UTF-8 em-dash (U+2014) stored as Latin-1 bytes.
-- Run this once after upgrading to the UTF-8-enforced DB connection.
-- Safe to run multiple times (idempotent via REPLACE).

UPDATE settings
  SET address = REPLACE(address, 'â€"', '–')  -- en-dash
WHERE address LIKE '%â€"%';

UPDATE settings
  SET address = REPLACE(address, 'â€™', ''')  -- right single quote
WHERE address LIKE '%â€™%';

UPDATE settings
  SET address = REPLACE(address, 'â€œ', '"')  -- left double quote
WHERE address LIKE '%â€œ%';

UPDATE settings
  SET address = REPLACE(address, 'â€', '"')   -- right double quote
WHERE address LIKE '%â€%';

-- Also fix invoice_footer which can have the same issue
UPDATE settings
  SET invoice_footer = REPLACE(invoice_footer, 'â€"', '–')
WHERE invoice_footer LIKE '%â€"%';

COMMENT ON TABLE settings IS 'Shop configuration. All text columns are stored and returned as UTF-8.';
