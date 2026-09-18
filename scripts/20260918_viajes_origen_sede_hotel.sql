-- Origen del viaje: sede u hotel, igual que el destino.
-- El selector "Tipo de origen" sólo copiaba la dirección al campo Origen y se
-- descartaba, así que al editar un viaje volvía vacío. Estas columnas lo
-- guardan y reponen la selección (espejo de destination_venue_id / hotel_id).

alter table transport.trips
  add column if not exists origin_venue_id uuid references logistics.venues(id) on delete set null;

alter table transport.trips
  add column if not exists origin_hotel_id uuid;
