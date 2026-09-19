import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Alojamiento por delegación y disciplina.
 *
 * La distribución hotelera del evento se decide en una planilla de regiones
 * por deportes: en cada cruce, el hotel donde se aloja esa selección. Aquí
 * vive esa planilla, y desde ella se puede bajar la asignación a cada
 * participante sin tener que tocarlos uno por uno.
 */
export type Rama = 'DAMAS' | 'VARONES';

export type CeldaHotel = {
  delegationId: string;
  disciplineId: string;
  branch: Rama;
  /** null borra la celda. */
  accommodationId: string | null;
};

type FilaGuardada = {
  id: string;
  eventId: string;
  delegationId: string;
  disciplineId: string;
  branch: Rama;
  accommodationId: string | null;
};

const RAMAS: Rama[] = ['DAMAS', 'VARONES'];

@Injectable()
export class DelegationHotelsService {
  constructor(private readonly dataSource: DataSource) {}

  /** La planilla completa de un evento. */
  async findByEvent(eventId: string): Promise<FilaGuardada[]> {
    if (!eventId) throw new BadRequestException('Falta el evento.');
    try {
      const filas: {
        id: string;
        event_id: string;
        delegation_id: string;
        discipline_id: string;
        branch: Rama;
        accommodation_id: string | null;
      }[] = await this.dataSource.query(
        `select id, event_id, delegation_id, discipline_id, branch, accommodation_id
           from logistics.delegation_hotels
          where event_id = $1`,
        [eventId],
      );
      return filas.map((f) => ({
        id: f.id,
        eventId: f.event_id,
        delegationId: f.delegation_id,
        disciplineId: f.discipline_id,
        branch: f.branch,
        accommodationId: f.accommodation_id,
      }));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'No se pudo leer la distribución hotelera.',
      );
    }
  }

  /**
   * Guarda las celdas que cambiaron. Una celda sin hotel se borra, para que la
   * planilla no acumule filas vacías.
   */
  async saveMany(
    eventId: string,
    celdas: CeldaHotel[],
  ): Promise<{ guardadas: number; borradas: number }> {
    if (!eventId) throw new BadRequestException('Falta el evento.');
    if (!Array.isArray(celdas)) throw new BadRequestException('Faltan las celdas.');
    for (const c of celdas) {
      if (!c?.delegationId || !c?.disciplineId) {
        throw new BadRequestException('Cada celda necesita delegación y disciplina.');
      }
      if (!RAMAS.includes(c.branch)) {
        throw new BadRequestException(`Rama desconocida: ${String(c.branch)}`);
      }
    }

    let guardadas = 0;
    let borradas = 0;
    await this.dataSource.transaction(async (manager) => {
      for (const c of celdas) {
        if (c.accommodationId) {
          await manager.query(
            `insert into logistics.delegation_hotels
               (event_id, delegation_id, discipline_id, branch, accommodation_id)
             values ($1, $2, $3, $4, $5)
             on conflict on constraint delegation_hotels_celda_unica
             do update set accommodation_id = excluded.accommodation_id, updated_at = now()`,
            [eventId, c.delegationId, c.disciplineId, c.branch, c.accommodationId],
          );
          guardadas += 1;
        } else {
          await manager.query(
            `delete from logistics.delegation_hotels
              where event_id = $1 and delegation_id = $2 and discipline_id = $3 and branch = $4`,
            [eventId, c.delegationId, c.disciplineId, c.branch],
          );
          borradas += 1;
        }
      }
    });
    return { guardadas, borradas };
  }

  /**
   * Cuántos participantes hay en una selección (región + deporte) y cuántos
   * ya tienen hotel. Sirve para que el panel diga a cuántos va a mover antes
   * de tocar nada.
   */
  async contarGrupo(eventId: string, delegationId: string, disciplineId: string) {
    if (!eventId || !delegationId || !disciplineId) {
      throw new BadRequestException('Faltan evento, delegación o disciplina.');
    }
    const filas: { total: string; con_hotel: string }[] = await this.dataSource.query(
      `select count(*) as total,
              count(ha.id) as con_hotel
         from core.athletes a
         left join logistics.hotel_assignments ha on ha.participant_id = a.id
        where a.event_id = $1
          and a.delegation_id = $2
          and (a.discipline_id = $3
               or a.discipline_id in (select id from core.disciplines where parent_id = $3))`,
      [eventId, delegationId, disciplineId],
    );
    const fila = filas[0] ?? { total: '0', con_hotel: '0' };
    return { total: Number(fila.total), conHotel: Number(fila.con_hotel) };
  }

  /**
   * Deja a toda una selección (región + deporte) en un hotel, de una vez, y
   * guarda la celda en la planilla para que las dos vistas digan lo mismo.
   */
  async assignGroup(params: {
    eventId: string;
    delegationId: string;
    disciplineId: string;
    accommodationId: string;
    branch?: Rama;
  }): Promise<{ actualizados: number; creados: number; total: number }> {
    const { eventId, delegationId, disciplineId, accommodationId } = params;
    if (!eventId || !delegationId || !disciplineId || !accommodationId) {
      throw new BadRequestException('Faltan evento, delegación, disciplina u hotel.');
    }

    // La rama sale del género del deporte; en los mixtos, de lo que pidan, y
    // si no piden nada, damas (las dos celdas suelen coincidir).
    const generos: { gender: string | null }[] = await this.dataSource.query(
      `select gender from core.disciplines where id = $1`,
      [disciplineId],
    );
    const genero = String(generos[0]?.gender ?? '').toUpperCase();
    const rama: Rama =
      genero === 'FEMALE' ? 'DAMAS' : genero === 'MALE' ? 'VARONES' : (params.branch ?? 'DAMAS');

    const participantes: { id: string; ya_tiene: string | null }[] = await this.dataSource.query(
      `select a.id,
              (select ha.id from logistics.hotel_assignments ha
                where ha.participant_id = a.id limit 1) as ya_tiene
         from core.athletes a
        where a.event_id = $1
          and a.delegation_id = $2
          and (a.discipline_id = $3
               or a.discipline_id in (select id from core.disciplines where parent_id = $3))`,
      [eventId, delegationId, disciplineId],
    );

    let actualizados = 0;
    let creados = 0;
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `insert into logistics.delegation_hotels
           (event_id, delegation_id, discipline_id, branch, accommodation_id)
         values ($1, $2, $3, $4, $5)
         on conflict on constraint delegation_hotels_celda_unica
         do update set accommodation_id = excluded.accommodation_id, updated_at = now()`,
        [eventId, delegationId, disciplineId, rama, accommodationId],
      );
      for (const p of participantes) {
        if (p.ya_tiene) {
          await manager.query(
            `update logistics.hotel_assignments set hotel_id = $2, updated_at = now() where id = $1`,
            [p.ya_tiene, accommodationId],
          );
          actualizados += 1;
        } else {
          await manager.query(
            `insert into logistics.hotel_assignments (participant_id, hotel_id) values ($1, $2)`,
            [p.id, accommodationId],
          );
          creados += 1;
        }
      }
    });

    return { actualizados, creados, total: participantes.length };
  }

  /**
   * Baja la planilla a los participantes: cada uno queda con el hotel de su
   * delegación y disciplina. Quien ya tenía asignación se actualiza; quien no
   * la tenía, se le crea. No se tocan habitación ni cama: eso es la asignación
   * fina, que se hace después.
   *
   * La rama de un participante sale del género de su disciplina. En los
   * deportes mixtos no hay de dónde deducirla, así que se toma la celda de
   * damas y, si está vacía, la de varones: en la planilla real las dos
   * coinciden en los mixtos.
   */
  async applyToParticipants(eventId: string): Promise<{
    actualizados: number;
    creados: number;
    sinCelda: number;
  }> {
    if (!eventId) throw new BadRequestException('Falta el evento.');
    try {
      const filas: { athlete_id: string; accommodation_id: string | null; ya_tiene: string | null }[] =
        await this.dataSource.query(
          `with celda as (
             select dh.delegation_id, dh.discipline_id, dh.branch, dh.accommodation_id
               from logistics.delegation_hotels dh
              where dh.event_id = $1 and dh.accommodation_id is not null
           )
           select a.id as athlete_id,
                  coalesce(
                    (select c.accommodation_id from celda c
                      where c.delegation_id = a.delegation_id
                        and c.discipline_id = coalesce(d.parent_id, a.discipline_id)
                        and c.branch = case when d.gender = 'FEMALE' then 'DAMAS'
                                            when d.gender = 'MALE' then 'VARONES'
                                            else 'DAMAS' end
                      limit 1),
                    (select c.accommodation_id from celda c
                      where c.delegation_id = a.delegation_id
                        and c.discipline_id = coalesce(d.parent_id, a.discipline_id)
                      limit 1)
                  ) as accommodation_id,
                  (select ha.id from logistics.hotel_assignments ha
                    where ha.participant_id = a.id limit 1) as ya_tiene
             from core.athletes a
             join core.disciplines d on d.id = a.discipline_id
            where a.event_id = $1
              and a.delegation_id is not null
              and a.discipline_id is not null`,
          [eventId],
        );

      const conHotel = filas.filter((f) => f.accommodation_id);
      const sinCelda = filas.length - conHotel.length;
      let actualizados = 0;
      let creados = 0;

      await this.dataSource.transaction(async (manager) => {
        for (const f of conHotel) {
          if (f.ya_tiene) {
            await manager.query(
              `update logistics.hotel_assignments
                  set hotel_id = $2, updated_at = now()
                where id = $1`,
              [f.ya_tiene, f.accommodation_id],
            );
            actualizados += 1;
          } else {
            await manager.query(
              `insert into logistics.hotel_assignments (participant_id, hotel_id)
               values ($1, $2)`,
              [f.athlete_id, f.accommodation_id],
            );
            creados += 1;
          }
        }
      });

      return { actualizados, creados, sinCelda };
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'No se pudo aplicar la distribución.',
      );
    }
  }
}
