-- Databases built before Flyway by Hibernate's ddl-auto=update were baselined at V1 without running it. This brings
-- them in line with V1 so every database is the same from here on. On a database created by V1 it changes nothing.

-- No longer used: "exclude from meal plans" became a per-family list (meal_plan_exclusions).
ALTER TABLE recipes DROP COLUMN IF EXISTS excluded_from_meal_plans;

-- ddl-auto=update named these unique constraints with hashes; V1 uses PostgreSQL's default names.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk6dotkott2kjsp8vw4d0m25fb7') THEN
        ALTER TABLE users RENAME CONSTRAINT uk6dotkott2kjsp8vw4d0m25fb7 TO users_email_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ukpve49daqjq59t6hrm9lxs29ve') THEN
        ALTER TABLE families RENAME CONSTRAINT ukpve49daqjq59t6hrm9lxs29ve TO families_invite_code_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk4mm0yti14ydr0h83m599rusb0') THEN
        ALTER TABLE shopping_lists RENAME CONSTRAINT uk4mm0yti14ydr0h83m599rusb0 TO shopping_lists_meal_plan_id_key;
    END IF;
END $$;
