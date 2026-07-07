-- Associate each GPS fix with the driver's active trip so we can later
-- reconstruct the exact route taken during a trip. The column is nullable:
-- positions emitted while the driver has no active trip (app open, no viaje)
-- are still stored, just without a trip_id.
alter table telemetry.vehicle_positions
  add column if not exists trip_id uuid;

-- Route reconstruction queries filter by trip_id and order by timestamp.
create index if not exists idx_vehicle_positions_trip_id
  on telemetry.vehicle_positions (trip_id, "timestamp");
