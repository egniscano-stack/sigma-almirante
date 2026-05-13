-- SIGMA ALMIRANTE - FULL DATABASE SETUP v1.0
-- This script creates all necessary tables, constraints, and policies for a fresh Supabase project.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABLES

-- TAXPAYERS
CREATE TABLE IF NOT EXISTS taxpayers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxpayer_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('NATURAL', 'JURIDICA')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVO', 'SUSPENDIDO', 'BLOQUEADO', 'MOROSO')),
  doc_id TEXT UNIQUE NOT NULL,
  dv TEXT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  corregimiento TEXT,
  balance DECIMAL(10, 2) DEFAULT 0,
  has_commercial_activity BOOLEAN DEFAULT FALSE,
  commercial_category TEXT,
  commercial_name TEXT,
  has_construction BOOLEAN DEFAULT FALSE,
  has_garbage_service BOOLEAN DEFAULT FALSE,
  documents JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxpayer_id UUID REFERENCES taxpayers(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  year TEXT,
  color TEXT,
  motor_serial TEXT,
  chassis_serial TEXT,
  has_transfer_documents BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, 
  taxpayer_id UUID REFERENCES taxpayers(id),
  tax_type TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('PAGADO', 'PENDIENTE', 'ANULADO')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('EFECTIVO', 'TARJETA', 'CHEQUE', 'ONLINE', 'ARREGLO_PAGO')),
  teller_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- APP USERS
CREATE TABLE IF NOT EXISTS app_users (
  username TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CAJERO', 'CONTRIBUYENTE', 'AUDITOR', 'REGISTRO', 'ALCALDE', 'SECRETARIA')),
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADMIN REQUESTS (For edits/voids)
CREATE TABLE IF NOT EXISTS admin_requests (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requester_name TEXT NOT NULL,
    taxpayer_name TEXT,
    description TEXT,
    taxpayer_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AGENDA ITEMS (Mayor's Schedule)
CREATE TABLE IF NOT EXISTS agenda_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EVENTO', 'REUNION', 'TRAMITE', 'VISITA')),
    status TEXT NOT NULL CHECK (status IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'COMPLETADA')),
    requester_name TEXT,
    requester_id TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INTERNAL CHAT
CREATE TABLE IF NOT EXISTS team_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_username TEXT REFERENCES app_users(username),
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    message TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SYSTEM CONFIG
CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY DEFAULT 1,
  config JSONB NOT NULL
);

-- 3. DEFAULT DATA
INSERT INTO app_users (username, name, role, password) 
VALUES 
('admin', 'Administrador Almirante', 'ADMIN', 'admin123'),
('alcalde', 'Alcalde Municipal', 'ALCALDE', 'almirante2026'),
('secretaria', 'Secretaría Ejecutiva', 'SECRETARIA', 'metsama')
ON CONFLICT (username) DO NOTHING;

INSERT INTO system_config (id, config) 
VALUES (1, '{
  "plateCost": 25.00,
  "constructionRatePerSqm": 1.50,
  "garbageResidentialRate": 5.00,
  "garbageCommercialRate": 15.00,
  "commercialBaseRate": 10.00,
  "liquorLicenseRate": 150.00,
  "advertisementRate": 20.00,
  "commercialRates": {
    "NONE": 0,
    "CLASE_A": 150.00,
    "CLASE_B": 75.00,
    "CLASE_C": 25.00
  }
}')
ON CONFLICT (id) DO NOTHING;

-- 4. RLS POLICIES (Development - Open Access)
ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access" ON %I', t);
        EXECUTE format('CREATE POLICY "Enable all access" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;
