-- Documentos informativos del evento (informativo, reglamento, programa, etc.)
-- Se administran desde la plataforma y se publican en los portales de usuario.
-- Ejecutar en el SQL Editor de Supabase.

create extension if not exists pgcrypto;   -- para gen_random_uuid()
create schema if not exists core;

create table if not exists core.event_documents (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid,                                  -- null = visible en todos los eventos
  title         varchar(180) not null,
  description   text,
  category      varchar(60) not null default 'INFORMATIVO',
  file_url      text not null,
  file_name     varchar(255),
  content_type  varchar(120),
  size_bytes    bigint,
  -- Públicos que pueden verlo: PARTICIPANTE, VIP, CONDUCTOR.
  -- La plataforma de administración siempre los ve todos.
  audiences     text[] not null default array['PARTICIPANTE','VIP','CONDUCTOR'],
  published     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_event_documents_event on core.event_documents(event_id);
create index if not exists idx_event_documents_published on core.event_documents(published);

-- Bucket de Storage. Es público a propósito: son documentos informativos
-- pensados para repartirse (informativo del evento, programa, reglamento).
-- NO subir aquí documentos con datos personales o médicos.
insert into storage.buckets (id, name, public)
values ('event-documents', 'event-documents', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'event_documents_public_read'
  ) then
    create policy "event_documents_public_read"
      on storage.objects for select
      using (bucket_id = 'event-documents');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'event_documents_service_insert'
  ) then
    create policy "event_documents_service_insert"
      on storage.objects for insert
      with check (bucket_id = 'event-documents');
  end if;
end $$;
