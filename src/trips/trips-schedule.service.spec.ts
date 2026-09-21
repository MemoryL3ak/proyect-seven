import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { TripsScheduleService } from './trips-schedule.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

// Pool de ejemplo calcado de la forma de los datos reales: conductores de
// proveedor con su patente, un nombre repetido y una patente compartida entre
// dos choferes (ambos casos existen hoy en la base).
const DRIVERS = [
  { id: 'alex', fullName: 'Alex Arevalo', plate: 'GXVS17' },
  { id: 'pedro', fullName: 'Pedro sarmiento', plate: 'FXRV50' },
  {
    id: 'hector',
    fullName: 'Héctor Enrique Contreras Garrido',
    plate: 'SP GY 95',
  },
  { id: 'osvaldo', fullName: 'OSVALDO BUSTAMANTE', plate: 'JBWG65' },
  { id: 'michael', fullName: 'MICHAEL BUSTAMANTE', plate: 'JBWG65' },
  {
    id: 'sergio-1',
    fullName: 'SERGIO AVELINO DURAN REBOLLEDO',
    plate: 'GKPD94',
  },
  {
    id: 'sergio-2',
    fullName: 'sergio avelino duran rebolledo',
    plate: 'JPRB52',
  },
];

type Driver = (typeof DRIVERS)[number];
type MatchResult = { driver: Driver } | { reason: string } | null;
// matchScheduleDriver es privado: se accede por su forma, sin `any`.
type WithMatch = {
  matchScheduleDriver: (
    drivers: Driver[],
    name?: string,
    plate?: string,
  ) => MatchResult;
};

describe('TripsScheduleService — conductor escrito en la planilla', () => {
  let service: TripsScheduleService;
  const match = (name?: string, plate?: string): MatchResult =>
    (service as unknown as WithMatch).matchScheduleDriver(DRIVERS, name, plate);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsScheduleService,
        { provide: 'SUPABASE_CLIENT', useValue: {} as SupabaseClient },
        { provide: PushNotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<TripsScheduleService>(TripsScheduleService);
  });

  it('empareja por nombre y patente, que es el caso de la planilla real', () => {
    expect(match('Alex Arevalo', 'GXVS17')).toEqual({ driver: DRIVERS[0] });
  });

  it('empareja solo con el nombre cuando la patente viene vacía', () => {
    expect(match('Pedro sarmiento', '')).toEqual({ driver: DRIVERS[1] });
  });

  it('empareja solo con la patente cuando el conductor viene vacío', () => {
    expect(match('', 'FXRV50')).toEqual({ driver: DRIVERS[1] });
  });

  it('ignora tildes, mayúsculas y espacios de más en el nombre', () => {
    expect(match('  hector enrique CONTRERAS garrido ', '')).toEqual({
      driver: DRIVERS[2],
    });
  });

  it('ignora los espacios y guiones de la patente', () => {
    expect(match('', 'spgy95')).toEqual({ driver: DRIVERS[2] });
  });

  it('desempata con la patente cuando el nombre está repetido', () => {
    expect(match('SERGIO AVELINO DURAN REBOLLEDO', 'JPRB52')).toEqual({
      driver: DRIVERS[6],
    });
  });

  it('desempata con el nombre cuando la patente la comparten dos choferes', () => {
    expect(match('MICHAEL BUSTAMANTE', 'JBWG65')).toEqual({
      driver: DRIVERS[4],
    });
  });

  it('no asigna cuando la patente sola es ambigua', () => {
    const result = match('', 'JBWG65');
    expect(result).toHaveProperty('reason');
    expect((result as { reason: string }).reason).toContain('2 conductores');
  });

  it('no asigna cuando el nombre y la patente apuntan a personas distintas', () => {
    const result = match('Alex Arevalo', 'FXRV50');
    expect(result).toHaveProperty('reason');
    expect((result as { reason: string }).reason).toContain(
      'apuntan a personas distintas',
    );
  });

  it('no asigna cuando el conductor no está registrado', () => {
    const result = match('Juan Que No Existe', 'ZZZZ99');
    expect(result).toHaveProperty('reason');
    expect((result as { reason: string }).reason).toContain(
      'no hay ningún conductor registrado',
    );
  });

  it('devuelve null cuando la planilla no dice nada: lo resuelve la auto-asignación', () => {
    expect(match('', '')).toBeNull();
    expect(match(undefined, undefined)).toBeNull();
  });

  describe('horas de la planilla', () => {
    type WithDates = {
      parseDate: (raw?: string, defaultYear?: string) => Date | null;
      mergeDateTime: (date: Date | null, hhmm?: string) => Date | null;
    };
    const instante = (fecha: string, hora: string, anio = '2026') => {
      const svc = service as unknown as WithDates;
      return svc.mergeDateTime(svc.parseDate(fecha, anio), hora);
    };

    it('guarda la hora del archivo como hora de Chile, no del servidor', () => {
      // 08:30 en Valparaíso el 23-09-2026 (UTC-3) son las 11:30 UTC.
      expect(instante('23-sept', '08:30')?.toISOString()).toBe(
        '2026-09-23T11:30:00.000Z',
      );
    });

    it('respeta el horario de invierno, cuando Chile está en UTC-4', () => {
      // En julio el reloj chileno corre una hora más atrás que en septiembre.
      expect(instante('15-jul', '08:30')?.toISOString()).toBe(
        '2026-07-15T12:30:00.000Z',
      );
    });

    it('la presentación queda 15 minutos antes de la hora del viaje', () => {
      const svc = service as unknown as WithDates & {
        withLead: (at: Date) => Date;
      };
      const viaje = svc.mergeDateTime(svc.parseDate('23-sept', '2026'), '07:45');
      expect(viaje?.toISOString()).toBe('2026-09-23T10:45:00.000Z'); // 07:45 en Chile
      expect(svc.withLead(viaje as Date).toISOString()).toBe(
        '2026-09-23T10:30:00.000Z', // 07:30 en Chile
      );
    });

    it('la fecha del viaje no se corre por la zona horaria del servidor', () => {
      const svc = service as unknown as WithDates;
      expect(svc.parseDate('23-sept', '2026')?.toISOString().slice(0, 10)).toBe(
        '2026-09-23',
      );
      expect(svc.parseDate('2026-11-01')?.toISOString().slice(0, 10)).toBe(
        '2026-11-01',
      );
    });
  });
});
