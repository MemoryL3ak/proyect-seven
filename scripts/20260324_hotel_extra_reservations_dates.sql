-- Add start_date / end_date to hotel_extra_reservations
alter table logistics.hotel_extra_reservations
  add column if not exists start_date date,
  add column if not exists end_date   date;
