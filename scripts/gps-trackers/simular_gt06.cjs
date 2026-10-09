// Simula un rastreador GT06 contra el receptor: login, una posición y un
// latido, y muestra lo que contesta el servidor. Sirve para probar el puerto
// público de Railway antes de apuntar el equipo real.
//
//   node scripts/gps-trackers/simular_gt06.cjs <host> <puerto> [imei]
const net = require('net');
const [host, puerto, imei = '123456789012345'] = process.argv.slice(2);
if (!host || !puerto) { console.error('uso: simular_gt06.cjs <host> <puerto> [imei]'); process.exit(1); }

const crcItu = (buf) => { let crc = 0xffff; for (const b of buf) { crc ^= b; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1; } return ~crc & 0xffff; };
const trama = (protocolo, serie, contenido = Buffer.alloc(0)) => {
  const largo = 1 + contenido.length + 4;
  const cuerpo = Buffer.concat([Buffer.from([largo, protocolo]), contenido, Buffer.from([(serie >> 8) & 0xff, serie & 0xff])]);
  const crc = crcItu(cuerpo);
  return Buffer.concat([Buffer.from([0x78, 0x78]), cuerpo, Buffer.from([(crc >> 8) & 0xff, crc & 0xff, 0x0d, 0x0a])]);
};
const imeiBcd = (s) => Buffer.from(s.padStart(16, '0'), 'hex');
const bloqueGps = (p) => {
  const b = Buffer.alloc(18);
  const f = p.fecha;
  b[0] = f.getUTCFullYear() - 2000; b[1] = f.getUTCMonth() + 1; b[2] = f.getUTCDate(); b[3] = f.getUTCHours(); b[4] = f.getUTCMinutes(); b[5] = f.getUTCSeconds();
  b[6] = 0xc0 | p.sats;
  b.writeUInt32BE(Math.round(Math.abs(p.lat) * 1800000), 7);
  b.writeUInt32BE(Math.round(Math.abs(p.lng) * 1800000), 11);
  b[15] = p.vel;
  b.writeUInt16BE((p.rumbo & 0x3ff) | 0x1000 | (p.lat >= 0 ? 0x0400 : 0) | (p.lng < 0 ? 0x0800 : 0), 16);
  return b;
};
const hex = (b) => Buffer.from(b).toString('hex').replace(/(..)/g, '$1 ').trim();

const socket = net.createConnection({ host, port: Number(puerto) }, () => {
  console.log('conectado a', host, puerto);
  const login = trama(0x01, 1, Buffer.concat([imeiBcd(imei), Buffer.from([0x00, 0x01])]));
  console.log('→ login   ', hex(login));
  socket.write(login);
  setTimeout(() => {
    const pos = trama(0x12, 2, Buffer.concat([bloqueGps({ fecha: new Date(), sats: 9, lat: -33.4543, lng: -70.5186, vel: 42, rumbo: 143 }), Buffer.alloc(8)]));
    console.log('→ posición', hex(pos));
    socket.write(pos);
  }, 1500);
  setTimeout(() => {
    const latido = trama(0x13, 3, Buffer.from([0x40, 0x06, 0x04, 0x00, 0x01]));
    console.log('→ latido  ', hex(latido));
    socket.write(latido);
  }, 3000);
  setTimeout(() => socket.end(), 5000);
});
socket.on('data', (d) => console.log('← servidor', hex(d)));
socket.on('error', (e) => { console.error('error:', e.message); process.exit(1); });
socket.on('close', () => console.log('cerrado'));
