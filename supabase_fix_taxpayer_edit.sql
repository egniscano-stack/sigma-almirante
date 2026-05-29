-- SIGMA ALMIRANTE - TAXPAYER EDIT SCHEMA FIX
-- Run this in your Supabase SQL Editor (Dashboard) to resolve taxpayer registration & editing issues.

DO $$ 
BEGIN
    -- 1. ADD MISSING COLUMNS TO TAXPAYERS TABLE
    
    -- magnitude
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'magnitude') THEN
        ALTER TABLE taxpayers ADD COLUMN magnitude TEXT DEFAULT 'PEQUEÑO';
    END IF;

    -- selected_tax_codes
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'selected_tax_codes') THEN
        ALTER TABLE taxpayers ADD COLUMN selected_tax_codes JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- rotulo_amount
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'rotulo_amount') THEN
        ALTER TABLE taxpayers ADD COLUMN rotulo_amount DECIMAL(10, 2) DEFAULT 0;
    END IF;

    -- garbage_amount
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'garbage_amount') THEN
        ALTER TABLE taxpayers ADD COLUMN garbage_amount DECIMAL(10, 2) DEFAULT 0;
    END IF;

    -- business_start_date
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'business_start_date') THEN
        ALTER TABLE taxpayers ADD COLUMN business_start_date TEXT;
    END IF;

    -- payment_start_date
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'payment_start_date') THEN
        ALTER TABLE taxpayers ADD COLUMN payment_start_date TEXT;
    END IF;

    -- yearly_amount
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'yearly_amount') THEN
        ALTER TABLE taxpayers ADD COLUMN yearly_amount DECIMAL(10, 2) DEFAULT 0;
    END IF;

    -- vehicles column (to store active vehicles array in JSON format)
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'vehicles') THEN
        ALTER TABLE taxpayers ADD COLUMN vehicles JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- 2. CORRECT TAXPAYER TYPE AND STATUS CHECK CONSTRAINTS
    
    -- Drop old type constraints if they exist
    ALTER TABLE taxpayers DROP CONSTRAINT IF EXISTS taxpayers_type_check;
    ALTER TABLE taxpayers DROP CONSTRAINT IF EXISTS check_taxpayer_type;
    ALTER TABLE taxpayers DROP CONSTRAINT IF EXISTS check_type;
    
    -- Recreate type check constraint to accept NATURAL_1, NATURAL_2, JURIDICA, PLACA and legacy NATURAL
    ALTER TABLE taxpayers ADD CONSTRAINT taxpayers_type_check 
    CHECK (type IN ('NATURAL_1', 'NATURAL_2', 'JURIDICA', 'PLACA', 'NATURAL'));

    -- Drop old status constraints if they exist
    ALTER TABLE taxpayers DROP CONSTRAINT IF EXISTS taxpayers_status_check;
    ALTER TABLE taxpayers DROP CONSTRAINT IF EXISTS check_taxpayer_status;
    ALTER TABLE taxpayers DROP CONSTRAINT IF EXISTS check_status;

    -- Recreate status check constraint
    ALTER TABLE taxpayers ADD CONSTRAINT taxpayers_status_check 
    CHECK (status IN ('ACTIVO', 'SUSPENDIDO', 'BLOQUEADO', 'MOROSO', 'PAZ_Y_SALVO'));

    -- Drop old magnitude constraint if exists and recreate
    ALTER TABLE taxpayers DROP CONSTRAINT IF EXISTS taxpayers_magnitude_check;
    ALTER TABLE taxpayers ADD CONSTRAINT taxpayers_magnitude_check 
    CHECK (magnitude IN ('PEQUEÑO', 'MEDIANO', 'GRANDE'));

    RAISE NOTICE 'Taxpayer editing & creation schema fix applied successfully.';
END $$;
