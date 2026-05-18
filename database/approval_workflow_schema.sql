-- ============================================================
-- 🏭 Approval Workflow System - SQL Schema
-- Industrial ERP - Professional Approval System
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ROLES & PERMISSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'chemical_engineer', 'owner', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================================
-- 2. PENDING REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('create', 'update', 'delete')),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID, -- NULL for create operations
    old_data JSONB, -- NULL for create operations
    new_data JSONB NOT NULL,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_by_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_by_name VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    impact_analysis JSONB, -- Stores cost/profit impact analysis
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. APPROVALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES pending_requests(id) ON DELETE CASCADE,
    approved_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by_name VARCHAR(255),
    approval_level INTEGER NOT NULL DEFAULT 1, -- For multi-level approval
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES pending_requests(id),
    action VARCHAR(50) NOT NULL, -- e.g., 'request_created', 'request_approved', 'request_rejected', 'data_applied'
    table_name VARCHAR(100),
    record_id UUID,
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    performed_by_name VARCHAR(255),
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. RECIPE VERSIONS TABLE (Versioning System)
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL, -- Reference to original recipe
    version_number INTEGER NOT NULL,
    product_id UUID NOT NULL,
    product_name VARCHAR(255),
    barcode VARCHAR(100),
    materials JSONB NOT NULL,
    total_materials_cost_per_ton DECIMAL(15, 2),
    cost_per_liter DECIMAL(15, 2),
    created_by UUID REFERENCES auth.users(id),
    created_by_name VARCHAR(255),
    change_reason TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_pending_requests_status ON pending_requests(status);
CREATE INDEX idx_pending_requests_table ON pending_requests(table_name);
CREATE INDEX idx_pending_requests_requested_by ON pending_requests(requested_by);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX idx_recipe_versions_recipe_id ON recipe_versions(recipe_id);
CREATE INDEX idx_recipe_versions_product_id ON recipe_versions(product_id);

-- ============================================================
-- 6. FUNCTIONS FOR AUTOMATIC CALCULATIONS
-- ============================================================

-- Function to calculate cost impact of recipe changes
CREATE OR REPLACE FUNCTION calculate_recipe_cost_impact(old_recipe JSONB, new_recipe JSONB)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    old_cost DECIMAL(15, 2) := 0;
    new_cost DECIMAL(15, 2) := 0;
    cost_diff DECIMAL(15, 2);
    old_margin DECIMAL(15, 2);
    new_margin DECIMAL(15, 2);
    margin_diff DECIMAL(15, 2);
BEGIN
    -- Calculate old cost
    IF old_recipe IS NOT NULL THEN
        old_cost := COALESCE((old_recipe->>'cost_per_liter')::DECIMAL, 0);
    END IF;
    
    -- Calculate new cost
    IF new_recipe IS NOT NULL THEN
        new_cost := COALESCE((new_recipe->>'cost_per_liter')::DECIMAL, 0);
    END IF;
    
    cost_diff := new_cost - old_cost;
    
    result := jsonb_build_object(
        'old_cost', old_cost,
        'new_cost', new_cost,
        'cost_difference', cost_diff,
        'percentage_change', CASE WHEN old_cost > 0 THEN (cost_diff / old_cost * 100) ELSE 0 END
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

-- Trigger for pending_requests updated_at
CREATE TRIGGER update_pending_requests_updated_at
    BEFORE UPDATE ON pending_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_roles updated_at
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. RLS POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_versions ENABLE ROW LEVEL SECURITY;

-- User Roles Policies
CREATE POLICY "Users can view their own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admin can manage roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Pending Requests Policies
CREATE POLICY "Users can create requests" ON pending_requests
    FOR INSERT WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can view their own requests" ON pending_requests
    FOR SELECT USING (auth.uid() = requested_by);

CREATE POLICY "Admin can view all requests" ON pending_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admin can approve/reject requests" ON pending_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Approvals Policies
CREATE POLICY "Users can view approvals for their requests" ON approvals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pending_requests pr
            WHERE pr.id = approvals.request_id AND pr.requested_by = auth.uid()
        )
    );

CREATE POLICY "Admin can view all approvals" ON approvals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admin can create approvals" ON approvals
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Audit Logs Policies
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = performed_by);

CREATE POLICY "Admin can view all audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "System can create audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Recipe Versions Policies
CREATE POLICY "Users can view recipe versions" ON recipe_versions
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage recipe versions" ON recipe_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Chemical Engineers can create recipe versions" ON recipe_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role IN ('admin', 'chemical_engineer')
        )
    );

-- ============================================================
-- 9. RESTRICT DIRECT ACCESS TO CORE TABLES
-- ============================================================

-- Enable RLS on core tables if not already enabled
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_costings ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_quotations ENABLE ROW LEVEL SECURITY;

-- Core Tables Policies - Only Admin can modify directly
CREATE POLICY "Admin can modify raw_materials" ON raw_materials
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated can view raw_materials" ON raw_materials
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can modify products" ON products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated can view products" ON products
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can modify recipes" ON recipes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated can view recipes" ON recipes
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can modify product_costings" ON product_costings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated can view product_costings" ON product_costings
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can modify suppliers" ON suppliers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated can view suppliers" ON suppliers
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can modify production_orders" ON production_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated can view production_orders" ON production_orders
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can modify saved_quotations" ON saved_quotations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated can view saved_quotations" ON saved_quotations
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 10. INITIAL ADMIN USER SETUP (Run manually)
-- ============================================================
-- This is a comment - run this manually after creating your first admin user
-- INSERT INTO user_roles (user_id, role)
-- VALUES ('YOUR_ADMIN_USER_ID', 'admin');

-- ============================================================
-- END OF SCHEMA
-- ============================================================

-- ============================================================
-- موديول المشتريات (Purchase Orders)
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number    TEXT NOT NULL UNIQUE,
    supplier_id     TEXT NOT NULL,
    supplier_name   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','pending','approved','received','cancelled')),
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date   DATE,
    received_date   DATE,
    items           JSONB NOT NULL DEFAULT '[]',
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_percent     NUMERIC(5,2)  NOT NULL DEFAULT 15,
    tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes           TEXT DEFAULT '',
    created_by      TEXT DEFAULT 'admin',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can modify purchase_orders" ON purchase_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "All authenticated can view purchase_orders" ON purchase_orders
    FOR SELECT USING (auth.uid() IS NOT NULL);
