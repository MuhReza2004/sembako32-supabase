-- Supabase Database Schema for Sembako32
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE produk (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL,
  satuan TEXT NOT NULL,
  stok INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('aktif', 'nonaktif')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE pelanggan (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  id_pelanggan TEXT NOT NULL UNIQUE, -- PLG-xxxxx
  kode_pelanggan TEXT NOT NULL,
  nama_pelanggan TEXT NOT NULL,
  nama_toko TEXT NOT NULL,
  nib TEXT,
  alamat TEXT NOT NULL,
  no_telp TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL CHECK (status IN ('aktif', 'nonaktif')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  alamat TEXT NOT NULL,
  telp TEXT NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Supplier Products table (junction table with pricing)
CREATE TABLE supplier_produk (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  produk_id UUID REFERENCES produk(id) ON DELETE CASCADE,
  harga_beli DECIMAL(10,2) NOT NULL,
  harga_jual DECIMAL(10,2) NOT NULL,
  stok INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(supplier_id, produk_id)
);

-- Inventory table
CREATE TABLE inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  produk_id UUID REFERENCES produk(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  stok INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(produk_id, supplier_id)
);

-- Stock Adjustments table
CREATE TABLE stock_adjustments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  produk_id UUID REFERENCES produk(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('increase', 'decrease')),
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Purchases table
CREATE TABLE pembelian (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  no_do TEXT,
  no_npb TEXT,
  invoice TEXT,
  metode_pembayaran TEXT NOT NULL CHECK (metode_pembayaran IN ('Tunai', 'Transfer')),
  nama_bank TEXT,
  nama_pemilik_rekening TEXT,
  nomor_rekening TEXT,
  total DECIMAL(14,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Completed', 'Decline')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Details table
CREATE TABLE pembelian_detail (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pembelian_id UUID REFERENCES pembelian(id) ON DELETE CASCADE,
  supplier_produk_id UUID REFERENCES supplier_produk(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL,
  harga DECIMAL(14,2) NOT NULL,
  subtotal DECIMAL(14,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales table
CREATE TABLE penjualan (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tanggal DATE NOT NULL,
  pelanggan_id UUID REFERENCES pelanggan(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  catatan TEXT,
  no_invoice TEXT NOT NULL UNIQUE,
  no_npb TEXT NOT NULL,
  no_do TEXT,
  no_tanda_terima TEXT,
  metode_pengambilan TEXT NOT NULL CHECK (metode_pengambilan IN ('Ambil Langsung', 'Diantar')),
  total DECIMAL(14,2) NOT NULL,
  total_dibayar DECIMAL(14,2) DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Lunas', 'Belum Lunas', 'Batal')),
  metode_pembayaran TEXT,
  nomor_rekening TEXT,
  nama_bank TEXT,
  nama_pemilik_rekening TEXT,
  tanggal_jatuh_tempo DATE,
  diskon DECIMAL(14,2) DEFAULT 0,
  pajak_enabled BOOLEAN DEFAULT false,
  pajak DECIMAL(14,2) DEFAULT 0,
  total_akhir DECIMAL(14,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery Order table (separate for long-term scalability)
CREATE TABLE delivery_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  penjualan_id UUID REFERENCES penjualan(id) ON DELETE CASCADE,
  no_do TEXT NOT NULL UNIQUE,
  no_tanda_terima TEXT,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Dikirim', 'Diterima', 'Batal')) DEFAULT 'Draft',
  tanggal_kirim DATE,
  tanggal_terima DATE,
  alamat_pengiriman TEXT,
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Details table
CREATE TABLE penjualan_detail (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  penjualan_id UUID REFERENCES penjualan(id) ON DELETE CASCADE,
  supplier_produk_id UUID REFERENCES supplier_produk(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL,
  harga DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment History table
CREATE TABLE riwayat_pembayaran (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  penjualan_id UUID REFERENCES penjualan(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  jumlah DECIMAL(10,2) NOT NULL,
  metode_pembayaran TEXT NOT NULL,
  atas_nama TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_produk_kode ON produk(kode);
CREATE INDEX idx_pelanggan_id_pelanggan ON pelanggan(id_pelanggan);
CREATE INDEX idx_suppliers_kode ON suppliers(kode);
CREATE INDEX idx_supplier_produk_supplier_id ON supplier_produk(supplier_id);
CREATE INDEX idx_supplier_produk_produk_id ON supplier_produk(produk_id);
CREATE INDEX idx_inventory_produk_id ON inventory(produk_id);
CREATE INDEX idx_pembelian_supplier_id ON pembelian(supplier_id);
CREATE INDEX idx_pembelian_tanggal ON pembelian(tanggal);
CREATE INDEX idx_penjualan_pelanggan_id ON penjualan(pelanggan_id);
CREATE INDEX idx_penjualan_tanggal ON penjualan(tanggal);
CREATE INDEX idx_delivery_orders_penjualan_id ON delivery_orders(penjualan_id);
CREATE INDEX idx_delivery_orders_no_do ON delivery_orders(no_do);
CREATE INDEX idx_penjualan_no_invoice ON penjualan(no_invoice);
CREATE INDEX idx_pembelian_detail_pembelian_id ON pembelian_detail(pembelian_id);
CREATE INDEX idx_penjualan_detail_penjualan_id ON penjualan_detail(penjualan_id);
CREATE INDEX idx_riwayat_pembayaran_penjualan_id ON riwayat_pembayaran(penjualan_id);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE produk ENABLE ROW LEVEL SECURITY;
ALTER TABLE pelanggan ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_produk ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembelian ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembelian_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE penjualan ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE penjualan_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE riwayat_pembayaran ENABLE ROW LEVEL SECURITY;

-- Hardened RLS policies (admin write, authenticated read)
-- Helper functions
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() = 'admin';
$$;

-- USERS
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile (staff only)" ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'staff');

CREATE POLICY "Users can update own profile without role change" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.users u WHERE u.id = auth.uid())
  );

CREATE POLICY "Admins can manage users" ON users
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PRODUK (read for all authenticated, write admin)
CREATE POLICY "Authenticated can read produk" ON produk
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can write produk" ON produk
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PELANGGAN (read for all authenticated, write admin)
CREATE POLICY "Authenticated can read pelanggan" ON pelanggan
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can write pelanggan" ON pelanggan
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SUPPLIERS (admin-only)
CREATE POLICY "Admins can read suppliers" ON suppliers
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can write suppliers" ON suppliers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SUPPLIER_PRODUK (read for all authenticated, write admin)
CREATE POLICY "Authenticated can read supplier_produk" ON supplier_produk
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can write supplier_produk" ON supplier_produk
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INVENTORY (admin-only)
CREATE POLICY "Admins can read inventory" ON inventory
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can write inventory" ON inventory
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- STOCK_ADJUSTMENTS (admin-only)
CREATE POLICY "Admins can read stock_adjustments" ON stock_adjustments
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can write stock_adjustments" ON stock_adjustments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PEMBELIAN (admin-only)
CREATE POLICY "Admins can read pembelian" ON pembelian
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can write pembelian" ON pembelian
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PEMBELIAN_DETAIL (admin-only)
CREATE POLICY "Admins can read pembelian_detail" ON pembelian_detail
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can write pembelian_detail" ON pembelian_detail
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELIVERY_ORDERS (admin full, staff own)
CREATE POLICY "Admins manage delivery_orders" ON delivery_orders
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Staff read own delivery_orders" ON delivery_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = delivery_orders.penjualan_id
        AND p.created_by = auth.uid()
    )
  );
CREATE POLICY "Staff insert own delivery_orders" ON delivery_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = delivery_orders.penjualan_id
        AND p.created_by = auth.uid()
    )
  );
CREATE POLICY "Staff update own delivery_orders" ON delivery_orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = delivery_orders.penjualan_id
        AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = delivery_orders.penjualan_id
        AND p.created_by = auth.uid()
    )
  );

-- PENJUALAN (admin full, staff own)
CREATE POLICY "Admins manage penjualan" ON penjualan
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Staff read own penjualan" ON penjualan
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "Staff insert own penjualan" ON penjualan
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff update own penjualan" ON penjualan
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- PENJUALAN_DETAIL (admin full, staff own)
CREATE POLICY "Admins manage penjualan_detail" ON penjualan_detail
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Staff read own penjualan_detail" ON penjualan_detail
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = penjualan_detail.penjualan_id
        AND p.created_by = auth.uid()
    )
  );
CREATE POLICY "Staff insert own penjualan_detail" ON penjualan_detail
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = penjualan_detail.penjualan_id
        AND p.created_by = auth.uid()
    )
  );
CREATE POLICY "Staff update own penjualan_detail" ON penjualan_detail
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = penjualan_detail.penjualan_id
        AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = penjualan_detail.penjualan_id
        AND p.created_by = auth.uid()
    )
  );

-- RIWAYAT_PEMBAYARAN (admin full, staff own)
CREATE POLICY "Admins manage riwayat_pembayaran" ON riwayat_pembayaran
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Staff read own riwayat_pembayaran" ON riwayat_pembayaran
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = riwayat_pembayaran.penjualan_id
        AND p.created_by = auth.uid()
    )
  );
CREATE POLICY "Staff insert own riwayat_pembayaran" ON riwayat_pembayaran
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = riwayat_pembayaran.penjualan_id
        AND p.created_by = auth.uid()
    )
  );
CREATE POLICY "Staff update own riwayat_pembayaran" ON riwayat_pembayaran
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = riwayat_pembayaran.penjualan_id
        AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM penjualan p
      WHERE p.id = riwayat_pembayaran.penjualan_id
        AND p.created_by = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_produk_updated_at BEFORE UPDATE ON produk FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pelanggan_updated_at BEFORE UPDATE ON pelanggan FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pembelian_updated_at BEFORE UPDATE ON pembelian FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_penjualan_updated_at BEFORE UPDATE ON penjualan FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_orders_updated_at BEFORE UPDATE ON delivery_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
