ALTER TABLE quotes ADD COLUMN product_id INTEGER REFERENCES products(id);
ALTER TABLE quotes ADD COLUMN product_variant_id INTEGER REFERENCES product_variants(id);
