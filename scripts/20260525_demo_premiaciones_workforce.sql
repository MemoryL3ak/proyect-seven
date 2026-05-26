-- ============================================================================
-- DEMO — Premiaciones y Workforce
-- ============================================================================
-- Pobla `core.premiaciones`, `core.premiacion_awarders`,
-- `public.workforce_persons`, `public.workforce_products`,
-- `public.workforce_deliveries` con datos de muestra suficientes para que
-- ambas páginas (Premiaciones, Staff & Voluntarios) se vean activas.
--
-- Idempotente: borra primero todo lo marcado con el `notes`/`metadata.seed`.
-- Para deshacer manualmente:
--   delete from public.workforce_deliveries where metadata->>'seed' = 'demo-workforce';
--   delete from public.workforce_products    where metadata->>'seed' = 'demo-workforce';
--   delete from public.workforce_persons     where metadata->>'seed' = 'demo-workforce';
--   delete from core.premiacion_awarders     where metadata->>'seed' = 'demo-premiaciones';
--   delete from core.premiaciones            where metadata->>'seed' = 'demo-premiaciones';
-- ============================================================================

do $$
declare
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_event_id uuid;
  -- premiaciones
  v_prem_marker text := 'demo-premiaciones';
  v_p1 uuid; v_p2 uuid; v_p3 uuid; v_p4 uuid; v_p5 uuid; v_p6 uuid; v_p7 uuid;
  v_ath1 uuid; v_ath2 uuid; v_ath3 uuid; v_ath4 uuid; v_ath5 uuid;
  -- workforce
  v_wf_marker text := 'demo-workforce';
  v_w1 uuid; v_w2 uuid; v_w3 uuid; v_w4 uuid; v_w5 uuid; v_w6 uuid;
  v_prod_camiseta uuid; v_prod_gorra uuid; v_prod_credencial uuid; v_prod_kit uuid;
begin
  -- Evento activo o más reciente
  select id into v_event_id from core.events
  order by case when status = 'ACTIVE' then 0 else 1 end, created_at desc limit 1;
  if v_event_id is null then
    raise exception 'No hay eventos en core.events. Crealo antes.';
  end if;

  -- Atletas (para los awarders). Tomamos los primeros 5 disponibles.
  select id into v_ath1 from core.athletes where event_id = v_event_id or event_id is null order by full_name offset 0 limit 1;
  select id into v_ath2 from core.athletes where event_id = v_event_id or event_id is null order by full_name offset 1 limit 1;
  select id into v_ath3 from core.athletes where event_id = v_event_id or event_id is null order by full_name offset 2 limit 1;
  select id into v_ath4 from core.athletes where event_id = v_event_id or event_id is null order by full_name offset 3 limit 1;
  select id into v_ath5 from core.athletes where event_id = v_event_id or event_id is null order by full_name offset 4 limit 1;

  -- ── Limpieza idempotente ─────────────────────────────────────────────────
  delete from public.workforce_deliveries where metadata->>'seed' = v_wf_marker;
  delete from public.workforce_products    where metadata->>'seed' = v_wf_marker;
  delete from public.workforce_persons     where metadata->>'seed' = v_wf_marker;
  delete from core.premiacion_awarders     where metadata->>'seed' = v_prem_marker;
  delete from core.premiaciones            where metadata->>'seed' = v_prem_marker;

  -- ╔════════════════════════════════════════════════════════════════════════╗
  -- ║ PREMIACIONES                                                           ║
  -- ╚════════════════════════════════════════════════════════════════════════╝

  -- 2 ya realizadas (días pasados)
  insert into core.premiaciones (event_id, title, discipline, scheduled_at, venue_name, location_detail, status, notes, metadata)
  values
    (v_event_id, 'Final 100m libres — Medalla de Oro', 'Natación',
     ((v_today - 2) || ' 19:30:00-04:00')::timestamptz,
     'Estadio Nacional', 'Pileta Olímpica · Podio Central',
     'REALIZADA', 'Ceremonia con himno y banderas.', jsonb_build_object('seed', v_prem_marker))
    returning id into v_p1;
  insert into core.premiaciones (event_id, title, discipline, scheduled_at, venue_name, location_detail, status, notes, metadata)
  values
    (v_event_id, 'Maratón — Premiación general', 'Atletismo',
     ((v_today - 1) || ' 11:00:00-04:00')::timestamptz,
     'Parque O''Higgins', 'Escenario principal',
     'REALIZADA', 'Top 3 femenino y masculino.', jsonb_build_object('seed', v_prem_marker))
    returning id into v_p2;

  -- 5 programadas (hoy + próximos días)
  insert into core.premiaciones (event_id, title, discipline, scheduled_at, venue_name, location_detail, status, notes, metadata)
  values
    (v_event_id, 'Final Básquetbol Femenino', 'Básquetbol',
     (v_today || ' 20:00:00-04:00')::timestamptz,
     'Estadio Nacional', 'Cancha central',
     'PROGRAMADA', 'Premiación al cierre del partido.', jsonb_build_object('seed', v_prem_marker))
    returning id into v_p3;
  insert into core.premiaciones (event_id, title, discipline, scheduled_at, venue_name, location_detail, status, notes, metadata)
  values
    (v_event_id, 'Final Tenis de Mesa Mixto', 'Tenis de Mesa',
     ((v_today + 1) || ' 16:30:00-04:00')::timestamptz,
     'Centro de Entrenamiento Olímpico', 'Sala A',
     'PROGRAMADA', 'Confirmar disponibilidad de medallas.', jsonb_build_object('seed', v_prem_marker))
    returning id into v_p4;
  insert into core.premiaciones (event_id, title, discipline, scheduled_at, venue_name, location_detail, status, notes, metadata)
  values
    (v_event_id, 'Final Vóleibol Playa', 'Vóleibol Playa',
     ((v_today + 2) || ' 18:00:00-04:00')::timestamptz,
     'Parque Peñalolén', 'Cancha 1',
     'PROGRAMADA', null, jsonb_build_object('seed', v_prem_marker))
    returning id into v_p5;
  insert into core.premiaciones (event_id, title, discipline, scheduled_at, venue_name, location_detail, status, notes, metadata)
  values
    (v_event_id, 'Final Surf — Punta de Lobos', 'Surf',
     ((v_today + 3) || ' 14:00:00-04:00')::timestamptz,
     'Playa Punta de Lobos', 'Pichilemu — Escenario costero',
     'PROGRAMADA', 'Coordinar traslado VI Región.', jsonb_build_object('seed', v_prem_marker))
    returning id into v_p6;
  insert into core.premiaciones (event_id, title, discipline, scheduled_at, venue_name, location_detail, status, notes, metadata)
  values
    (v_event_id, 'Ceremonia de Cierre — Medallas globales', 'Multidisciplinario',
     ((v_today + 5) || ' 21:00:00-04:00')::timestamptz,
     'Estadio Nacional', 'Pista central',
     'PROGRAMADA', 'Ceremonia oficial de cierre.', jsonb_build_object('seed', v_prem_marker))
    returning id into v_p7;

  -- Awarders (atletas que entregan premios) — algunos confirmados
  if v_ath1 is not null then
    insert into core.premiacion_awarders (premiacion_id, athlete_id, role, confirmed_at, metadata)
    values (v_p3, v_ath1, 'AWARDER', now(), jsonb_build_object('seed', v_prem_marker));
  end if;
  if v_ath2 is not null then
    insert into core.premiacion_awarders (premiacion_id, athlete_id, role, confirmed_at, metadata)
    values (v_p3, v_ath2, 'AWARDER', now(), jsonb_build_object('seed', v_prem_marker));
  end if;
  if v_ath3 is not null then
    insert into core.premiacion_awarders (premiacion_id, athlete_id, role, metadata)
    values (v_p4, v_ath3, 'AWARDER', jsonb_build_object('seed', v_prem_marker));
  end if;
  if v_ath4 is not null then
    insert into core.premiacion_awarders (premiacion_id, athlete_id, role, confirmed_at, metadata)
    values (v_p5, v_ath4, 'PRESENTER', now(), jsonb_build_object('seed', v_prem_marker));
  end if;
  if v_ath5 is not null then
    insert into core.premiacion_awarders (premiacion_id, athlete_id, role, metadata)
    values (v_p7, v_ath5, 'AWARDER', jsonb_build_object('seed', v_prem_marker));
  end if;

  -- ╔════════════════════════════════════════════════════════════════════════╗
  -- ║ WORKFORCE — Personas, productos, entregas                              ║
  -- ╚════════════════════════════════════════════════════════════════════════╝

  -- Personas (4 staff + 2 voluntarios)
  insert into public.workforce_persons (event_id, full_name, rut, email, phone, gender, person_type, role, daily_rate, days_count, start_date, end_date, status, metadata)
  values
    (v_event_id, 'Camila Fuentes',  '17.234.567-8', 'camila.fuentes@bvan.cl',  '+56 9 4123 5678', 'F', 'STAFF',     'Coordinadora de sede',  85000, 20, v_today - 5, v_today + 15, 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
    returning id into v_w1;
  insert into public.workforce_persons (event_id, full_name, rut, email, phone, gender, person_type, role, daily_rate, days_count, start_date, end_date, status, metadata)
  values
    (v_event_id, 'Diego Salazar',   '18.456.789-K', 'diego.salazar@bvan.cl',   '+56 9 4234 5678', 'M', 'STAFF',     'Supervisor de transporte', 75000, 20, v_today - 5, v_today + 15, 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
    returning id into v_w2;
  insert into public.workforce_persons (event_id, full_name, rut, email, phone, gender, person_type, role, daily_rate, days_count, start_date, end_date, status, metadata)
  values
    (v_event_id, 'Macarena Tapia',  '19.567.890-1', 'macarena.tapia@bvan.cl',  '+56 9 4345 6789', 'F', 'STAFF',     'Asistente de acreditación', 60000, 18, v_today - 3, v_today + 14, 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
    returning id into v_w3;
  insert into public.workforce_persons (event_id, full_name, rut, email, phone, gender, person_type, role, daily_rate, days_count, start_date, end_date, status, metadata)
  values
    (v_event_id, 'Pablo Riquelme',  '20.678.901-2', 'pablo.riquelme@bvan.cl',  '+56 9 4456 7890', 'M', 'STAFF',     'Logística de hotelería',  70000, 18, v_today - 3, v_today + 14, 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
    returning id into v_w4;
  insert into public.workforce_persons (event_id, full_name, rut, email, phone, gender, person_type, role, daily_rate, days_count, start_date, end_date, status, metadata)
  values
    (v_event_id, 'Valentina Soto',  '21.789.012-3', 'valentina.soto@bvan.cl',  '+56 9 4567 8901', 'F', 'VOLUNTEER', 'Punto de información',        0, 15, v_today,       v_today + 14, 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
    returning id into v_w5;
  insert into public.workforce_persons (event_id, full_name, rut, email, phone, gender, person_type, role, daily_rate, days_count, start_date, end_date, status, metadata)
  values
    (v_event_id, 'Tomás Henríquez', '22.890.123-4', 'tomas.henriquez@bvan.cl', '+56 9 4678 9012', 'M', 'VOLUNTEER', 'Apoyo en recintos',            0, 12, v_today,       v_today + 11, 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
    returning id into v_w6;

  -- Productos (uniforme, accesorios)
  insert into public.workforce_products (event_id, name, description, unit_cost, barcode, has_sizes, available_sizes, stock_quantity, category, status, metadata)
  values (v_event_id, 'Camiseta oficial Bvan', 'Camiseta polo color teal con logo', 8500, 'BVAN-CAM-001', true, ARRAY['S','M','L','XL'], 120, 'UNIFORME', 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
  returning id into v_prod_camiseta;

  insert into public.workforce_products (event_id, name, description, unit_cost, barcode, has_sizes, available_sizes, stock_quantity, category, status, metadata)
  values (v_event_id, 'Gorra oficial', 'Gorra trucker color negro con bordado', 4500, 'BVAN-GOR-002', false, ARRAY[]::text[], 90, 'UNIFORME', 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
  returning id into v_prod_gorra;

  insert into public.workforce_products (event_id, name, description, unit_cost, barcode, has_sizes, available_sizes, stock_quantity, category, status, metadata)
  values (v_event_id, 'Credencial impresa + cordón', 'Credencial PVC con código QR y cordón', 1200, 'BVAN-CRD-003', false, ARRAY[]::text[], 200, 'ACREDITACION', 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
  returning id into v_prod_credencial;

  insert into public.workforce_products (event_id, name, description, unit_cost, barcode, has_sizes, available_sizes, stock_quantity, category, status, metadata)
  values (v_event_id, 'Kit de alimentación diario', 'Snack + bebida + colación', 3500, 'BVAN-KIT-004', false, ARRAY[]::text[], 300, 'ALIMENTACION', 'ACTIVE', jsonb_build_object('seed', v_wf_marker))
  returning id into v_prod_kit;

  -- Entregas (mezcla validadas / pendientes / con/sin talla)
  insert into public.workforce_deliveries (person_id, product_id, quantity, size, unit_cost, delivered_at, delivered_by, validated_at, validated_by, notes, metadata)
  values
    (v_w1, v_prod_camiseta,   1, 'M', 8500, v_today - 5, 'Bodega Central', v_today - 5, 'Camila Fuentes', null,                          jsonb_build_object('seed', v_wf_marker)),
    (v_w1, v_prod_credencial, 1, null, 1200, v_today - 5, 'Bodega Central', v_today - 5, 'Camila Fuentes', null,                         jsonb_build_object('seed', v_wf_marker)),
    (v_w2, v_prod_camiseta,   1, 'L', 8500, v_today - 5, 'Bodega Central', v_today - 5, 'Diego Salazar',  null,                          jsonb_build_object('seed', v_wf_marker)),
    (v_w2, v_prod_gorra,      1, null, 4500, v_today - 4, 'Bodega Central', null,        null,             'Pendiente validación',       jsonb_build_object('seed', v_wf_marker)),
    (v_w3, v_prod_camiseta,   1, 'S', 8500, v_today - 3, 'Bodega Central', v_today - 3, 'Macarena Tapia', null,                          jsonb_build_object('seed', v_wf_marker)),
    (v_w3, v_prod_credencial, 1, null, 1200, v_today - 3, 'Bodega Central', v_today - 3, 'Macarena Tapia', null,                         jsonb_build_object('seed', v_wf_marker)),
    (v_w4, v_prod_camiseta,   1, 'XL',8500, v_today - 3, 'Bodega Central', v_today - 3, 'Pablo Riquelme', null,                          jsonb_build_object('seed', v_wf_marker)),
    (v_w5, v_prod_camiseta,   1, 'M', 8500, v_today,     'Bodega Central', null,        null,             'Entregado hoy, sin validar', jsonb_build_object('seed', v_wf_marker)),
    (v_w5, v_prod_kit,        3, null, 3500, v_today,     'Bodega Central', null,        null,             null,                          jsonb_build_object('seed', v_wf_marker)),
    (v_w6, v_prod_camiseta,   1, 'L', 8500, v_today,     'Bodega Central', null,        null,             null,                          jsonb_build_object('seed', v_wf_marker));

  raise notice 'OK: 7 premiaciones, 6 personas workforce, 4 productos, 10 entregas insertados';
end$$;
