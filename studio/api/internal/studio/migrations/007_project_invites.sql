ALTER TABLE invites ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;
