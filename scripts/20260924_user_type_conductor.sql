-- 24-09-2026. Dos participantes de proveedor tenían el rol escrito "condcutor"
-- y el panel no los contaba como conductores (ni en la planilla ni en el
-- estado de documentación). Se corrige la errata. Idempotente.
update core.provider_participants
   set user_type = 'conductor'
 where lower(trim(user_type)) in ('condcutor', 'conducor', 'conductora');
