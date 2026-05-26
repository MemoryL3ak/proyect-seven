-- Seed de partner de prueba para el portal de cupones.
-- Credenciales:
--   Código: MCDO-001
--   PIN:    1234
--
-- Eliminar después en producción.

insert into public.coupon_partners (code, name, address, pin_hash, active)
values (
  'MCDO-001',
  'McDonald''s — Local de prueba',
  'Av. de prueba 1234, Santiago',
  '$2b$10$5teuelDJ8Sn01zRLBd0E8OZ7AQqcuqBurzkAoDOqU3qVQQVpib4d6',
  true
)
on conflict do nothing;
