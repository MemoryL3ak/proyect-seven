// Exporta usuarios (admin + portales) con sus códigos de acceso a docs/_users_export.json.
// Uso: node scripts/export_users_json.js
// El JSON resultante alimenta docs/build_xlsx_v4.py y contiene datos sensibles:
// eliminarlo después de generar los documentos (no se versiona).
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
if (!url || !key) { console.error('Sin credenciales'); process.exit(1); }
const supabase = createClient(url, key);

const code = (id) => String(id).slice(-6).toUpperCase();

(async () => {
  const out = { generatedAt: new Date().toISOString() };

  const { data: adminData, error: adminErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  out.admins = adminErr ? [] : (adminData.users || []).map((u) => ({
    email: u.email,
    name: u.user_metadata?.name || null,
    username: u.user_metadata?.username || null,
    role: u.user_metadata?.role || null,
    modules: Array.isArray(u.user_metadata?.modules) ? u.user_metadata.modules : null,
    banned: u.banned_until ? true : false,
    lastSignIn: u.last_sign_in_at || null,
  }));

  const { data: athletes } = await supabase.schema('core').from('athletes')
    .select('id, full_name, email, user_type, status, is_delegation_lead, country_code')
    .order('full_name');
  out.athletes = (athletes || []).map((a) => ({
    name: a.full_name, email: a.email, type: a.user_type, status: a.status,
    lead: a.is_delegation_lead, country: a.country_code, code: code(a.id),
  }));

  const { data: drivers } = await supabase.schema('transport').from('drivers')
    .select('id, full_name, email, status').order('full_name');
  out.drivers = (drivers || []).map((d) => ({
    name: d.full_name, email: d.email, status: d.status, code: code(d.id),
  }));

  const { data: providers } = await supabase.schema('core').from('providers').select('id, name, type');
  const provMap = Object.fromEntries((providers || []).map((p) => [p.id, p]));
  const { data: parts } = await supabase.schema('core').from('provider_participants')
    .select('id, full_name, email, status, metadata, provider_id').order('full_name');
  out.providerParticipants = (parts || []).map((p) => ({
    name: p.full_name, email: p.email, status: p.status,
    provider: provMap[p.provider_id]?.name || null,
    providerType: provMap[p.provider_id]?.type || null,
    isDriver: p.metadata?.isDriver === true || p.metadata?.isDriver === 'true',
    code: code(p.id),
  }));

  const { data: partners } = await supabase.from('coupon_partners')
    .select('id, code, name, active').order('name');
  out.couponPartners = (partners || []).map((p) => ({
    name: p.name, loginCode: p.code, active: p.active,
  }));

  const dest = path.join(__dirname, '..', 'docs', '_users_export.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 1));
  console.log('Export listo:', dest);
})();
