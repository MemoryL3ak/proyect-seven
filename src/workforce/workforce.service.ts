import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  CreateDeliveryDto,
  CreatePersonDto,
  CreateProductDto,
  UpdateDeliveryDto,
  UpdatePersonDto,
  UpdateProductDto,
} from './dto/workforce.dto';

type PersonRow = Record<string, unknown>;
type ProductRow = Record<string, unknown>;
type DeliveryRow = Record<string, unknown>;

const camelize = (row: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  Object.entries(row).forEach(([k, v]) => {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  });
  return out;
};

@Injectable()
export class WorkforceService {
  constructor(@Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private get client() {
    // Forzar schema 'public' explícito: cuando hay varios schemas expuestos en Supabase,
    // las llamadas sin .schema() pueden ambiguar y fallar con "schema cache" error.
    return this.supabase.schema('public');
  }

  private readonly T_PERSONS = 'workforce_persons';
  private readonly T_PRODUCTS = 'workforce_products';
  private readonly T_DELIVERIES = 'workforce_deliveries';

  private throwIfError(error: unknown, fallback: string) {
    if (!error) return;
    const message = (error as { message?: string })?.message || fallback;
    throw new InternalServerErrorException(message);
  }

  // ── Persons ────────────────────────────────────────────────────────────────

  async listPersons(filters?: { personType?: string; eventId?: string; q?: string }) {
    let q = this.client.from(this.T_PERSONS).select('*');
    if (filters?.personType) q = q.eq('person_type', filters.personType);
    if (filters?.eventId) q = q.eq('event_id', filters.eventId);
    if (filters?.q) {
      q = q.or(
        `full_name.ilike.%${filters.q}%,rut.ilike.%${filters.q}%,email.ilike.%${filters.q}%`,
      );
    }
    const { data, error } = await q.order('full_name', { ascending: true });
    this.throwIfError(error, 'Error listando personas');
    return (data as PersonRow[]).map(camelize);
  }

  async getPerson(id: string) {
    const { data, error } = await this.client.from(this.T_PERSONS).select('*').eq('id', id).maybeSingle();
    this.throwIfError(error, 'Error obteniendo persona');
    if (!data) throw new NotFoundException(`Persona ${id} no encontrada`);
    return camelize(data as PersonRow);
  }

  async createPerson(dto: CreatePersonDto) {
    const row = {
      event_id: dto.eventId ?? null,
      full_name: dto.fullName,
      rut: dto.rut ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      gender: dto.gender ?? null,
      address: dto.address ?? null,
      person_type: dto.personType ?? 'STAFF',
      role: dto.role ?? null,
      daily_rate: dto.dailyRate ?? 0,
      days_count: dto.daysCount ?? 0,
      start_date: dto.startDate ?? null,
      end_date: dto.endDate ?? null,
      status: dto.status ?? 'ACTIVE',
      notes: dto.notes ?? null,
    };
    const { data, error } = await this.client.from(this.T_PERSONS).insert(row).select('*').single();
    this.throwIfError(error, 'Error creando persona');
    return camelize(data as PersonRow);
  }

  async updatePerson(id: string, dto: UpdatePersonDto) {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.eventId !== undefined) row.event_id = dto.eventId ?? null;
    if (dto.fullName !== undefined) row.full_name = dto.fullName;
    if (dto.rut !== undefined) row.rut = dto.rut ?? null;
    if (dto.email !== undefined) row.email = dto.email ?? null;
    if (dto.phone !== undefined) row.phone = dto.phone ?? null;
    if (dto.gender !== undefined) row.gender = dto.gender ?? null;
    if (dto.address !== undefined) row.address = dto.address ?? null;
    if (dto.personType !== undefined) row.person_type = dto.personType;
    if (dto.role !== undefined) row.role = dto.role ?? null;
    if (dto.dailyRate !== undefined) row.daily_rate = dto.dailyRate ?? 0;
    if (dto.daysCount !== undefined) row.days_count = dto.daysCount ?? 0;
    if (dto.startDate !== undefined) row.start_date = dto.startDate ?? null;
    if (dto.endDate !== undefined) row.end_date = dto.endDate ?? null;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.notes !== undefined) row.notes = dto.notes ?? null;
    const { data, error } = await this.client.from(this.T_PERSONS).update(row).eq('id', id).select('*').single();
    this.throwIfError(error, 'Error actualizando persona');
    if (!data) throw new NotFoundException(`Persona ${id} no encontrada`);
    return camelize(data as PersonRow);
  }

  async deletePerson(id: string) {
    const { error } = await this.client.from(this.T_PERSONS).delete().eq('id', id);
    this.throwIfError(error, 'Error eliminando persona');
    return { id, deleted: true };
  }

  // ── Products ───────────────────────────────────────────────────────────────

  async listProducts(filters?: { eventId?: string }) {
    let q = this.client.from(this.T_PRODUCTS).select('*');
    if (filters?.eventId) q = q.eq('event_id', filters.eventId);
    const { data, error } = await q.order('name', { ascending: true });
    this.throwIfError(error, 'Error listando productos');
    const rows = data as ProductRow[];

    // Backfill perezoso: cualquier producto sin barcode recibe uno auto-generado
    const missing = rows.filter((r) => !r.barcode);
    if (missing.length > 0) {
      for (const r of missing) {
        const code = await this.generateUniqueBarcode();
        await this.client.from(this.T_PRODUCTS)
          .update({ barcode: code }).eq('id', String(r.id));
        r.barcode = code;
      }
    }

    return rows.map(camelize);
  }

  /**
   * Genera un código EAN-13 válido (scaneable por cualquier lector estándar).
   * Prefijo "200" = uso interno (rango 200-299 reservado por GS1 para empresas).
   * 9 dígitos random + 1 checksum mod 10.
   */
  private generateEAN13(): string {
    const prefix = '200';
    let body = prefix;
    for (let i = 0; i < 9; i++) {
      body += Math.floor(Math.random() * 10).toString();
    }
    // Checksum EAN-13
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(body[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return body + check.toString();
  }

  private async generateUniqueBarcode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateEAN13();
      const { data } = await this.client.from(this.T_PRODUCTS)
        .select('id').eq('barcode', code).maybeSingle();
      if (!data) return code;
    }
    // fallback prácticamente imposible
    return this.generateEAN13();
  }

  async createProduct(dto: CreateProductDto) {
    const barcode = await this.generateUniqueBarcode();
    const row = {
      event_id: dto.eventId ?? null,
      name: dto.name,
      description: dto.description ?? null,
      unit_cost: dto.unitCost ?? 0,
      barcode, // siempre auto-generado, ignora dto.barcode
      has_sizes: dto.hasSizes ?? false,
      available_sizes: dto.availableSizes ?? [],
      stock_quantity: dto.stockQuantity ?? 0,
      category: dto.category ?? null,
      status: dto.status ?? 'ACTIVE',
    };
    const { data, error } = await this.client.from(this.T_PRODUCTS).insert(row).select('*').single();
    this.throwIfError(error, 'Error creando producto');
    return camelize(data as ProductRow);
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.eventId !== undefined) row.event_id = dto.eventId ?? null;
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.description !== undefined) row.description = dto.description ?? null;
    if (dto.unitCost !== undefined) row.unit_cost = dto.unitCost ?? 0;
    // barcode NUNCA se actualiza desde el cliente: es inmutable post-creación
    if (dto.hasSizes !== undefined) row.has_sizes = dto.hasSizes ?? false;
    if (dto.availableSizes !== undefined) row.available_sizes = dto.availableSizes ?? [];
    if (dto.stockQuantity !== undefined) row.stock_quantity = dto.stockQuantity ?? 0;
    if (dto.category !== undefined) row.category = dto.category ?? null;
    if (dto.status !== undefined) row.status = dto.status;
    const { data, error } = await this.client.from(this.T_PRODUCTS).update(row).eq('id', id).select('*').single();
    this.throwIfError(error, 'Error actualizando producto');
    if (!data) throw new NotFoundException(`Producto ${id} no encontrado`);
    return camelize(data as ProductRow);
  }

  async deleteProduct(id: string) {
    const { error } = await this.client.from(this.T_PRODUCTS).delete().eq('id', id);
    this.throwIfError(error, 'Error eliminando producto');
    return { id, deleted: true };
  }

  // ── Deliveries ─────────────────────────────────────────────────────────────

  async listDeliveries(filters?: { personId?: string; productId?: string; validated?: boolean }) {
    let q = this.client.from(this.T_DELIVERIES).select('*');
    if (filters?.personId) q = q.eq('person_id', filters.personId);
    if (filters?.productId) q = q.eq('product_id', filters.productId);
    if (filters?.validated === true) q = q.not('validated_at', 'is', null);
    if (filters?.validated === false) q = q.is('validated_at', null);
    const { data, error } = await q.order('created_at', { ascending: false });
    this.throwIfError(error, 'Error listando entregas');
    return (data as DeliveryRow[]).map(camelize);
  }

  async createDelivery(dto: CreateDeliveryDto) {
    // snapshot del unit_cost si no se pasó: usa el del producto actual
    let unitCost = dto.unitCost;
    if (unitCost === undefined) {
      const { data: prod } = await this.client.from(this.T_PRODUCTS).select('unit_cost').eq('id', dto.productId).maybeSingle();
      unitCost = Number((prod as { unit_cost?: number })?.unit_cost ?? 0);
    }
    const row = {
      person_id: dto.personId,
      product_id: dto.productId,
      quantity: dto.quantity ?? 1,
      size: dto.size ?? null,
      unit_cost: unitCost ?? 0,
      delivered_at: dto.deliveredAt ?? new Date().toISOString(),
      delivered_by: dto.deliveredBy ?? null,
      validated_at: dto.validatedAt ?? null,
      validated_by: dto.validatedBy ?? null,
      notes: dto.notes ?? null,
    };
    const { data, error } = await this.client.from(this.T_DELIVERIES).insert(row).select('*').single();
    this.throwIfError(error, 'Error creando entrega');
    return camelize(data as DeliveryRow);
  }

  async updateDelivery(id: string, dto: UpdateDeliveryDto) {
    const row: Record<string, unknown> = {};
    if (dto.quantity !== undefined) row.quantity = dto.quantity;
    if (dto.size !== undefined) row.size = dto.size ?? null;
    if (dto.deliveredAt !== undefined) row.delivered_at = dto.deliveredAt ?? null;
    if (dto.deliveredBy !== undefined) row.delivered_by = dto.deliveredBy ?? null;
    if (dto.validatedAt !== undefined) row.validated_at = dto.validatedAt ?? null;
    if (dto.validatedBy !== undefined) row.validated_by = dto.validatedBy ?? null;
    if (dto.notes !== undefined) row.notes = dto.notes ?? null;
    const { data, error } = await this.client.from(this.T_DELIVERIES).update(row).eq('id', id).select('*').single();
    this.throwIfError(error, 'Error actualizando entrega');
    if (!data) throw new NotFoundException(`Entrega ${id} no encontrada`);
    return camelize(data as DeliveryRow);
  }

  async validateDelivery(id: string, validatedBy: string) {
    const { data, error } = await this.client
      .from(this.T_DELIVERIES)
      .update({
        validated_at: new Date().toISOString(),
        validated_by: validatedBy,
      })
      .eq('id', id)
      .select('*')
      .single();
    this.throwIfError(error, 'Error validando entrega');
    if (!data) throw new NotFoundException(`Entrega ${id} no encontrada`);
    return camelize(data as DeliveryRow);
  }

  async deleteDelivery(id: string) {
    const { error } = await this.client.from(this.T_DELIVERIES).delete().eq('id', id);
    this.throwIfError(error, 'Error eliminando entrega');
    return { id, deleted: true };
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboard(eventId?: string) {
    const [persons, products, deliveries] = await Promise.all([
      this.listPersons({ eventId }),
      this.listProducts({ eventId }),
      this.listDeliveries(),
    ]);

    const totalPersons = persons.length;
    const totalStaff = persons.filter((p: any) => p.personType === 'STAFF').length;
    const totalVolunteers = persons.filter((p: any) => p.personType === 'VOLUNTEER').length;

    const totalProducts = products.length;
    const totalProductValue = products.reduce(
      (sum: number, p: any) => sum + Number(p.unitCost || 0) * Number(p.stockQuantity || 0),
      0,
    );

    const totalDeliveries = deliveries.length;
    const deliveriesValidated = deliveries.filter((d: any) => d.validatedAt).length;
    const deliveriesPending = totalDeliveries - deliveriesValidated;
    const totalDeliveredValue = deliveries.reduce(
      (sum: number, d: any) => sum + Number(d.unitCost || 0) * Number(d.quantity || 0),
      0,
    );

    const totalLaborCost = persons.reduce(
      (sum: number, p: any) => sum + Number(p.dailyRate || 0) * Number(p.daysCount || 0),
      0,
    );

    return {
      persons: {
        total: totalPersons,
        staff: totalStaff,
        volunteers: totalVolunteers,
      },
      products: {
        total: totalProducts,
        totalInventoryValue: totalProductValue,
      },
      deliveries: {
        total: totalDeliveries,
        validated: deliveriesValidated,
        pending: deliveriesPending,
        totalDeliveredValue,
      },
      costs: {
        labor: totalLaborCost,
        materials: totalDeliveredValue,
        total: totalLaborCost + totalDeliveredValue,
      },
    };
  }
}
