import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  CreatePartnerDto,
  PartnerLoginDto,
  UpdatePartnerDto,
} from './dto/partner.dto';

type Row = Record<string, unknown>;

const camelize = (row: Row): Row => {
  const out: Row = {};
  Object.entries(row).forEach(([k, v]) => {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  });
  return out;
};

@Injectable()
export class CouponPartnersService {
  constructor(@Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient) {}

  private throwIfError(error: unknown, fallback: string) {
    if (!error) return;
    const msg = (error as { message?: string })?.message || fallback;
    throw new InternalServerErrorException(msg);
  }

  // ── Sanitiza (saca pin_hash antes de exponer al frontend) ──────────────────
  private sanitize(row: Row): Row {
    const cam = camelize(row);
    delete (cam as any).pinHash;
    return cam;
  }

  // ── CRUD admin ─────────────────────────────────────────────────────────────

  async list(eventId?: string) {
    let q = this.supabase.from('coupon_partners').select('*');
    if (eventId) q = q.eq('event_id', eventId);
    const { data, error } = await q.order('created_at', { ascending: false });
    this.throwIfError(error, 'Error listando partners');
    return (data as Row[]).map((r) => this.sanitize(r));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .from('coupon_partners')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    this.throwIfError(error, 'Error obteniendo partner');
    if (!data) throw new NotFoundException('Partner no encontrado');
    return this.sanitize(data as Row);
  }

  async create(dto: CreatePartnerDto) {
    const pinHash = await bcrypt.hash(dto.pin, 10);
    const row = {
      event_id: dto.eventId ?? null,
      code: dto.code,
      name: dto.name,
      pin_hash: pinHash,
      address: dto.address ?? null,
      logo_url: dto.logoUrl ?? null,
      contact_name: dto.contactName ?? null,
      contact_phone: dto.contactPhone ?? null,
      allowed_coupon_ids: dto.allowedCouponIds ?? [],
      active: dto.active ?? true,
    };
    const { data, error } = await this.supabase
      .from('coupon_partners')
      .insert(row)
      .select('*')
      .single();
    this.throwIfError(error, 'Error creando partner');
    return this.sanitize(data as Row);
  }

  async update(id: string, dto: UpdatePartnerDto) {
    const row: Record<string, unknown> = {};
    if (dto.code !== undefined) row.code = dto.code;
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.eventId !== undefined) row.event_id = dto.eventId ?? null;
    if (dto.address !== undefined) row.address = dto.address ?? null;
    if (dto.logoUrl !== undefined) row.logo_url = dto.logoUrl ?? null;
    if (dto.contactName !== undefined) row.contact_name = dto.contactName ?? null;
    if (dto.contactPhone !== undefined) row.contact_phone = dto.contactPhone ?? null;
    if (dto.allowedCouponIds !== undefined) row.allowed_coupon_ids = dto.allowedCouponIds ?? [];
    if (dto.active !== undefined) row.active = dto.active;
    if (dto.pin) row.pin_hash = await bcrypt.hash(dto.pin, 10);

    const { data, error } = await this.supabase
      .from('coupon_partners')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    this.throwIfError(error, 'Error actualizando partner');
    if (!data) throw new NotFoundException('Partner no encontrado');
    return this.sanitize(data as Row);
  }

  async remove(id: string) {
    const { error } = await this.supabase.from('coupon_partners').delete().eq('id', id);
    this.throwIfError(error, 'Error eliminando partner');
    return { id, deleted: true };
  }

  // ── Auth: login del partner ────────────────────────────────────────────────

  async login(dto: PartnerLoginDto, meta?: { ip?: string; userAgent?: string }) {
    const { data: partner, error } = await this.supabase
      .from('coupon_partners')
      .select('*')
      .eq('code', dto.code.trim())
      .eq('active', true)
      .maybeSingle();
    this.throwIfError(error, 'Error en login');
    if (!partner) throw new UnauthorizedException('Código o PIN inválido');

    const ok = await bcrypt.compare(dto.pin, (partner as any).pin_hash);
    if (!ok) throw new UnauthorizedException('Código o PIN inválido');

    const token = randomBytes(32).toString('hex');
    const session = {
      partner_id: (partner as any).id,
      token,
      ip: meta?.ip ?? null,
      user_agent: meta?.userAgent ?? null,
    };
    const { error: sessionErr } = await this.supabase
      .from('coupon_partner_sessions')
      .insert(session);
    if (sessionErr) {
      throw new InternalServerErrorException('No se pudo crear la sesión');
    }

    return {
      token,
      partner: this.sanitize(partner as Row),
    };
  }

  async logout(token: string) {
    await this.supabase
      .from('coupon_partner_sessions')
      .delete()
      .eq('token', token);
    return { ok: true };
  }

  /** Verifica un token, devuelve el partner o lanza Unauthorized. */
  async verifyToken(token: string) {
    if (!token) throw new UnauthorizedException('Token requerido');

    const { data: session, error } = await this.supabase
      .from('coupon_partner_sessions')
      .select('*, coupon_partners:partner_id(*)')
      .eq('token', token)
      .maybeSingle();
    this.throwIfError(error, 'Error verificando token');
    if (!session) throw new UnauthorizedException('Sesión inválida');

    const expiresAt = new Date((session as any).expires_at).getTime();
    if (expiresAt < Date.now()) {
      await this.supabase.from('coupon_partner_sessions').delete().eq('token', token);
      throw new UnauthorizedException('Sesión expirada');
    }

    // Touch last_used_at (best-effort)
    await this.supabase
      .from('coupon_partner_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token', token);

    const partner = (session as any).coupon_partners;
    if (!partner || !partner.active) {
      throw new UnauthorizedException('Partner inactivo');
    }
    return this.sanitize(partner as Row);
  }

  // ── Canjes recientes del partner ───────────────────────────────────────────

  async myRedemptions(partnerId: string, limit = 20) {
    const { data, error } = await this.supabase
      .from('coupon_claims')
      .select('*, coupons:coupon_id(title, partner_name, discount_type, discount_value, category)')
      .eq('redeemed_partner_id', partnerId)
      .eq('status', 'REDEEMED')
      .order('redeemed_at', { ascending: false })
      .limit(limit);
    this.throwIfError(error, 'Error obteniendo canjes recientes');
    return ((data as Row[]) || []).map((r) => {
      const cam = camelize(r) as any;
      if ((r as any).coupons) cam.coupon = camelize((r as any).coupons as Row);
      delete cam.coupons;
      return cam;
    });
  }

  // ── Métricas del partner ───────────────────────────────────────────────────

  async myStats(partnerId: string) {
    const { data: redeemed, error: errR } = await this.supabase
      .from('coupon_claims')
      .select('status, redeemed_at')
      .eq('redeemed_partner_id', partnerId);
    this.throwIfError(errR, 'Error obteniendo redenciones del partner');
    const rowsR = (redeemed as Row[]) || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalRedemptions = rowsR.length;
    const todayRedemptions = rowsR.filter(
      (r) => r.redeemed_at && new Date(r.redeemed_at as string) >= today,
    ).length;

    // Beneficios visibles para este partner: si tiene allowed_coupon_ids → solo esos;
    // si está vacío → puede canjear TODOS los activos.
    const { data: partnerRow } = await this.supabase
      .from('coupon_partners')
      .select('allowed_coupon_ids')
      .eq('id', partnerId)
      .maybeSingle();
    const allowed = ((partnerRow as any)?.allowed_coupon_ids as string[] | null) || [];

    let couponsQ = this.supabase.from('coupons').select('id, max_redemptions').eq('status', 'ACTIVE');
    if (allowed.length > 0) couponsQ = couponsQ.in('id', allowed);
    const { data: coupons } = await couponsQ;
    const couponList = (coupons as Row[]) || [];
    const eligibleIds = couponList.map((c) => String(c.id));

    // Reclamados/canjeados por cupón → para calcular cuántos quedan disponibles
    let claimsCount = 0;
    let stockRemaining: number | null = 0;
    if (eligibleIds.length > 0) {
      const { count: cl } = await this.supabase
        .from('coupon_claims')
        .select('*', { count: 'exact', head: true })
        .in('coupon_id', eligibleIds)
        .in('status', ['CLAIMED', 'REDEEMED']);
      claimsCount = cl ?? 0;

      // Stock total = suma de max_redemptions (null = "ilimitado")
      let anyUnlimited = false;
      let stockTotal = 0;
      for (const c of couponList) {
        if (c.max_redemptions == null) anyUnlimited = true;
        else stockTotal += Number(c.max_redemptions);
      }
      stockRemaining = anyUnlimited ? null : Math.max(0, stockTotal - claimsCount);
    }

    return {
      totalRedemptions,
      todayRedemptions,
      eligibleCoupons: eligibleIds.length,
      pendingClaims: Math.max(0, claimsCount - totalRedemptions),
      stockRemaining,
    };
  }
}
