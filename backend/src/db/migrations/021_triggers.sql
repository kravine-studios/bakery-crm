-- 021_triggers.sql
-- Updated_at trigger: auto-stamp updated_at on every update for tables that need it.

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables that have an updated_at column
CREATE TRIGGER trg_users_updated   BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated  BEFORE UPDATE ON products      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_combos_updated    BEFORE UPDATE ON combos         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_raw_materials_updated BEFORE UPDATE ON raw_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_recipes_updated   BEFORE UPDATE ON recipes        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_batches_updated   BEFORE UPDATE ON production_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated    BEFORE UPDATE ON orders         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_purchase_orders_updated BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
