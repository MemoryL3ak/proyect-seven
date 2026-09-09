// Crea un usuario del panel de administración directamente en Supabase Auth,
// con rol y módulos en user_metadata (mismo formato que /auth/register y que
// lee el menú lateral del panel).
//
// Uso:
//   node scripts/create_panel_user.js --name "Nombre Apellido" --email correo@dominio.com \
//     --role Coordinador --modules operacion.tracking,operacion.viajes,sede --password ClaveTemp123
//
// - --password es opcional: si se omite, se genera una clave temporal.
// - El usuario entra con clave temporal y el panel le exige cambiarla al primer login.
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
if (!url || !key) { console.error('Sin credenciales en .env'); process.exit(1); }
const supabase = createClient(url, key);

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i]?.replace(/^--/, '');
  if (k) args[k] = process.argv[i + 1];
}

const name = args.name;
const username = String(args.username || '').trim().toLowerCase();
// Cuenta tipo usuario (sin correo): mismo esquema que /auth/register —
// email sintético @nomail.seven y clave permanente.
const email = username ? `${username}@nomail.seven` : String(args.email || '').trim().toLowerCase();
const role = args.role || 'Coordinador';
const modules = String(args.modules || '').split(',').map((m) => m.trim()).filter(Boolean);
const password = args.password || `Seven${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 90 + 10)}`;
const forceChange = username ? false : true;

if (!name || !email) {
  console.error('Faltan --name y/o --email (o --username)');
  process.exit(1);
}

(async () => {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      role,
      ...(modules.length > 0 ? { modules } : {}),
      ...(username ? { username } : {}),
      forcePasswordChange: forceChange,
      force_password_change: forceChange,
    },
  });
  if (error || !data.user) {
    console.error('Error creando usuario:', error?.message || 'desconocido');
    process.exit(1);
  }
  console.log('Usuario creado:');
  console.log('  id:      ', data.user.id);
  console.log('  email:   ', email);
  console.log('  rol:     ', role);
  console.log('  módulos: ', modules.join(', ') || '(todos — sin restricción)');
  console.log('  clave:   ', password);
  console.log(forceChange
    ? 'Clave temporal: al primer login el panel exige cambiarla.'
    : `Clave permanente. Login con: ${email}`);
})();
