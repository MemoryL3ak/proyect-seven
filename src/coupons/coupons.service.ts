import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import {
  CreateCouponDto,
  RedeemCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto';
import { ClaimCouponDto, ConfirmRedeemDto } from './dto/claim.dto';

type Row = Record<string, unknown>;

const camelize = (row: Row): Row => {
  const out: Row = {};
  Object.entries(row).forEach(([k, v]) => {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  });
  return out;
};

// "CPN-AB12CD" — 6 chars base32 sin ambigüedad (no I, O, 0, 1)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeUniqueCode(): string {
  let out = 'CPN-';
  const buf = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  }
  return out;
}

function makeQrToken(): string {
  return randomBytes(32).toString('hex'); // 64 chars
}

@Injectable()
export class CouponsService {
  constructor(@Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient) {}

  private throwIfError(error: unknown, fallback: string) {
    if (!error) return;
    const msg = (error as { message?: string })?.message || fallback;
    throw new InternalServerErrorException(msg);
  }

  // ── Listado ────────────────────────────────────────────────────────────────

  async list(filters?: {
    eventId?: string;
    category?: string;
    status?: string;
    audience?: string;
  }) {
    let q = this.supabase.schema('public').from('coupons').select('*');
    if (filters?.eventId) q = q.eq('event_id', filters.eventId);
    if (filters?.category) q = q.eq('category', filters.category);
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.audience) q = q.contains('audience', [filters.audience]);
    const { data, error } = await q.order('created_at', { ascending: false });
    this.throwIfError(error, 'Error listando cupones');
    return (data as Row[]).map(camelize);
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    this.throwIfError(error, 'Error obteniendo cupón');
    if (!data) throw new NotFoundException(`Cupón ${id} no encontrado`);
    return camelize(data as Row);
  }

  // ── Para usuarios finales (portal): cupones válidos hoy según audience ─────

  async listForUser(userType: string, eventId?: string) {
    let q = this.supabase
      .from('coupons')
      .select('*')
      .eq('status', 'ACTIVE');
    if (eventId) q = q.eq('event_id', eventId);
    const { data, error } = await q.order('created_at', { ascending: false });
    this.throwIfError(error, 'Error listando cupones para usuario');
    const rows = (data as Row[]).map(camelize);
    const now = Date.now();
    return rows.filter((c: any) => {
      const aud = Array.isArray(c.audience) ? c.audience : [];
      if (aud.length > 0 && !aud.includes(userType)) return false;
      if (c.validFrom && new Date(c.validFrom).getTime() > now) return false;
      if (c.validUntil && new Date(c.validUntil).getTime() < now) return false;
      return true;
    });
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(dto: CreateCouponDto) {
    const row = {
      event_id: dto.eventId ?? null,
      code: dto.code,
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category ?? 'OTHER',
      discount_type: dto.discountType ?? 'PERCENTAGE',
      discount_value: dto.discountValue ?? null,
      terms_and_conditions: dto.termsAndConditions ?? null,
      partner_name: dto.partnerName ?? null,
      partner_logo_url: dto.partnerLogoUrl ?? null,
      partner_address: dto.partnerAddress ?? null,
      valid_from: dto.validFrom ?? null,
      valid_until: dto.validUntil ?? null,
      max_redemptions: dto.maxRedemptions ?? null,
      per_user_limit: dto.perUserLimit ?? 1,
      audience: dto.audience ?? [],
      status: dto.status ?? 'ACTIVE',
      image_url: dto.imageUrl ?? null,
    };
    const { data, error } = await this.supabase
      .from('coupons')
      .insert(row)
      .select('*')
      .single();
    this.throwIfError(error, 'Error creando cupón');
    return camelize(data as Row);
  }

  async update(id: string, dto: UpdateCouponDto) {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.eventId !== undefined) row.event_id = dto.eventId ?? null;
    if (dto.code !== undefined) row.code = dto.code;
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.description !== undefined) row.description = dto.description ?? null;
    if (dto.category !== undefined) row.category = dto.category;
    if (dto.discountType !== undefined) row.discount_type = dto.discountType;
    if (dto.discountValue !== undefined) row.discount_value = dto.discountValue;
    if (dto.termsAndConditions !== undefined) row.terms_and_conditions = dto.termsAndConditions ?? null;
    if (dto.partnerName !== undefined) row.partner_name = dto.partnerName ?? null;
    if (dto.partnerLogoUrl !== undefined) row.partner_logo_url = dto.partnerLogoUrl ?? null;
    if (dto.partnerAddress !== undefined) row.partner_address = dto.partnerAddress ?? null;
    if (dto.validFrom !== undefined) row.valid_from = dto.validFrom ?? null;
    if (dto.validUntil !== undefined) row.valid_until = dto.validUntil ?? null;
    if (dto.maxRedemptions !== undefined) row.max_redemptions = dto.maxRedemptions ?? null;
    if (dto.perUserLimit !== undefined) row.per_user_limit = dto.perUserLimit;
    if (dto.audience !== undefined) row.audience = dto.audience ?? [];
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.imageUrl !== undefined) row.image_url = dto.imageUrl ?? null;
    const { data, error } = await this.supabase
      .from('coupons')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    this.throwIfError(error, 'Error actualizando cupón');
    if (!data) throw new NotFoundException(`Cupón ${id} no encontrado`);
    return camelize(data as Row);
  }

  async remove(id: string) {
    const { error } = await this.supabase.schema('public').from('coupons').delete().eq('id', id);
    this.throwIfError(error, 'Error eliminando cupón');
    return { id, deleted: true };
  }

  // ── Redención legacy (canje directo sin claim, para flujos viejos) ─────────

  async listRedemptions(couponId?: string, userId?: string) {
    let q = this.supabase.schema('public').from('coupon_redemptions').select('*');
    if (couponId) q = q.eq('coupon_id', couponId);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q.order('redeemed_at', { ascending: false });
    this.throwIfError(error, 'Error listando redenciones');
    return (data as Row[]).map(camelize);
  }

  async redeem(couponId: string, dto: RedeemCouponDto) {
    const coupon = await this.findOne(couponId);

    if ((coupon as any).status !== 'ACTIVE') {
      throw new BadRequestException('El cupón no está activo');
    }
    const now = Date.now();
    if ((coupon as any).validFrom && new Date((coupon as any).validFrom).getTime() > now) {
      throw new BadRequestException('El cupón aún no está vigente');
    }
    if ((coupon as any).validUntil && new Date((coupon as any).validUntil).getTime() < now) {
      throw new BadRequestException('El cupón ya expiró');
    }

    if ((coupon as any).maxRedemptions) {
      const { count } = await this.supabase
        .from('coupon_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', couponId);
      if ((count ?? 0) >= Number((coupon as any).maxRedemptions)) {
        throw new BadRequestException('Cupón agotado: se alcanzó el máximo de canjes');
      }
    }

    if (dto.userId && (coupon as any).perUserLimit) {
      const { count } = await this.supabase
        .from('coupon_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', couponId)
        .eq('user_id', dto.userId);
      if ((count ?? 0) >= Number((coupon as any).perUserLimit)) {
        throw new BadRequestException('Este usuario ya canjeó el cupón el máximo de veces permitidas');
      }
    }

    const row = {
      coupon_id: couponId,
      user_id: dto.userId ?? null,
      user_type: dto.userType ?? null,
      user_name: dto.userName ?? null,
      redeemed_by: dto.redeemedBy ?? null,
      location: dto.location ?? null,
      notes: dto.notes ?? null,
    };
    const { data, error } = await this.supabase
      .from('coupon_redemptions')
      .insert(row)
      .select('*')
      .single();
    this.throwIfError(error, 'Error registrando redención');
    return camelize(data as Row);
  }

  // ── Claims (sistema con QR) ────────────────────────────────────────────────

  /**
   * El atleta "reclama" un cupón. Se valida vigencia + límites contando claims
   * activos (CLAIMED) + canjeados (REDEEMED) — esto evita acaparamiento.
   */
  async claim(couponId: string, dto: ClaimCouponDto) {
    const coupon = await this.findOne(couponId) as any;

    if (coupon.status !== 'ACTIVE') {
      throw new BadRequestException('El cupón no está activo');
    }
    const now = Date.now();
    if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now) {
      throw new BadRequestException('El cupón aún no está vigente');
    }
    if (coupon.validUntil && new Date(coupon.validUntil).getTime() < now) {
      throw new BadRequestException('El cupón ya expiró');
    }

    // Expirar claims vencidos perezosamente
    await this.supabase
      .from('coupon_claims')
      .update({ status: 'EXPIRED' })
      .eq('coupon_id', couponId)
      .eq('status', 'CLAIMED')
      .lt('expires_at', new Date().toISOString());

    // Límite global (cuenta CLAIMED + REDEEMED)
    if (coupon.maxRedemptions) {
      const { count } = await this.supabase
        .from('coupon_claims')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', couponId)
        .in('status', ['CLAIMED', 'REDEEMED']);
      if ((count ?? 0) >= Number(coupon.maxRedemptions)) {
        throw new BadRequestException('Cupón agotado: ya no quedan disponibles');
      }
    }

    // Límite por usuario (cuenta CLAIMED + REDEEMED del mismo userId)
    if (coupon.perUserLimit) {
      const { count } = await this.supabase
        .from('coupon_claims')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', couponId)
        .eq('user_id', dto.userId)
        .in('status', ['CLAIMED', 'REDEEMED']);
      if ((count ?? 0) >= Number(coupon.perUserLimit)) {
        throw new BadRequestException(
          'Ya reclamaste este cupón el máximo de veces permitidas',
        );
      }
    }

    // Generar credenciales (reintenta si choca el unique)
    let unique_code = makeUniqueCode();
    let qr_token = makeQrToken();
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = {
        coupon_id: couponId,
        user_id: dto.userId,
        user_type: dto.userType ?? null,
        user_name: dto.userName ?? null,
        user_email: dto.userEmail ?? null,
        unique_code,
        qr_token,
        status: 'CLAIMED',
      };
      const { data, error } = await this.supabase
        .from('coupon_claims')
        .insert(row)
        .select('*')
        .single();
      if (!error) return camelize(data as Row);

      // Si el error es por colisión de unique_code/qr_token, reintenta
      const msg = (error as any)?.message || '';
      if (/duplicate key|unique constraint/i.test(msg)) {
        unique_code = makeUniqueCode();
        qr_token = makeQrToken();
        continue;
      }
      this.throwIfError(error, 'Error creando claim');
    }
    throw new InternalServerErrorException('No se pudo generar un código único, intentá de nuevo');
  }

  /** Lista los claims del usuario (atleta) — todos los estados. */
  async myClaims(userId: string, status?: string) {
    // Expirar vencidos primero
    await this.supabase
      .from('coupon_claims')
      .update({ status: 'EXPIRED' })
      .eq('user_id', userId)
      .eq('status', 'CLAIMED')
      .lt('expires_at', new Date().toISOString());

    let q = this.supabase
      .from('coupon_claims')
      .select('*, coupons:coupon_id(*)')
      .eq('user_id', userId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('claimed_at', { ascending: false });
    this.throwIfError(error, 'Error listando claims del usuario');
    return (data as Row[]).map((r) => {
      const cam = camelize(r) as any;
      if (cam.coupons) cam.coupon = camelize(cam.coupons as Row);
      delete cam.coupons;
      return cam;
    });
  }

  /** Lista claims de un cupón (para la vista admin). */
  async listClaims(couponId?: string, status?: string) {
    let q = this.supabase.from('coupon_claims').select('*');
    if (couponId) q = q.eq('coupon_id', couponId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('claimed_at', { ascending: false });
    this.throwIfError(error, 'Error listando claims');
    return (data as Row[]).map(camelize);
  }

  /**
   * Validación (preview): el partner escanea, vemos qué cupón es y si está vigente.
   * No marca nada — solo retorna detalle. Acepta qr_token o unique_code.
   */
  async validateClaim(token: string, partnerId?: string) {
    const normalized = token.trim().toUpperCase().startsWith('CPN-')
      ? token.trim().toUpperCase()
      : token.trim();

    const lookupCol = normalized.startsWith('CPN-') ? 'unique_code' : 'qr_token';

    const { data, error } = await this.supabase
      .from('coupon_claims')
      .select('*, coupons:coupon_id(*)')
      .eq(lookupCol, normalized)
      .maybeSingle();
    this.throwIfError(error, 'Error validando código');
    if (!data) throw new NotFoundException('Código inválido o no existe');

    const claim: any = camelize(data as Row);
    if ((data as any).coupons) claim.coupon = camelize((data as any).coupons as Row);
    delete claim.coupons;

    // Expirar si está vencido
    if (claim.status === 'CLAIMED' && claim.expiresAt && new Date(claim.expiresAt).getTime() < Date.now()) {
      await this.supabase
        .from('coupon_claims')
        .update({ status: 'EXPIRED' })
        .eq('id', claim.id);
      claim.status = 'EXPIRED';
    }

    // Si hay partnerId y el cupón tiene whitelist, validar
    if (partnerId) {
      const { data: p } = await this.supabase
        .from('coupon_partners')
        .select('allowed_coupon_ids')
        .eq('id', partnerId)
        .maybeSingle();
      const allowed = (p as any)?.allowed_coupon_ids as string[] | null;
      if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(claim.couponId)) {
        throw new BadRequestException('Este partner no puede canjear este cupón');
      }
    }

    return claim;
  }

  /**
   * El partner confirma el canje. Cambia CLAIMED → REDEEMED y registra en
   * coupon_redemptions para mantener trazabilidad histórica.
   */
  async redeemByToken(dto: ConfirmRedeemDto, partnerId?: string, partnerName?: string) {
    const claim = await this.validateClaim(dto.token, partnerId);

    if (claim.status === 'REDEEMED') {
      throw new BadRequestException(
        `Este cupón ya fue canjeado el ${new Date(claim.redeemedAt).toLocaleString('es-CL')}`,
      );
    }
    if (claim.status === 'EXPIRED') {
      throw new BadRequestException('Este cupón expiró sin ser canjeado');
    }
    if (claim.status === 'REVOKED') {
      throw new BadRequestException('Este cupón fue anulado');
    }
    if (claim.status !== 'CLAIMED') {
      throw new BadRequestException(`Estado inesperado: ${claim.status}`);
    }

    const nowIso = new Date().toISOString();
    const update = {
      status: 'REDEEMED',
      redeemed_at: nowIso,
      redeemed_partner_id: partnerId ?? null,
      redeemed_by: dto.redeemedBy ?? null,
      redemption_location: dto.location ?? partnerName ?? null,
      notes: dto.notes ?? null,
    };
    const { data: updated, error } = await this.supabase
      .from('coupon_claims')
      .update(update)
      .eq('id', claim.id)
      .select('*')
      .single();
    this.throwIfError(error, 'Error confirmando canje');

    // Espejo en coupon_redemptions
    await this.supabase
      .from('coupon_redemptions')
      .insert({
        coupon_id: claim.couponId,
        user_id: claim.userId,
        user_type: claim.userType,
        user_name: claim.userName,
        redeemed_by: dto.redeemedBy ?? partnerName ?? null,
        location: dto.location ?? partnerName ?? null,
        notes: dto.notes ?? null,
        metadata: { claim_id: claim.id, unique_code: claim.uniqueCode },
      });

    return camelize(updated as Row);
  }

  /** Admin: anula un claim activo. */
  async revokeClaim(claimId: string) {
    const { data, error } = await this.supabase
      .from('coupon_claims')
      .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
      .eq('id', claimId)
      .eq('status', 'CLAIMED')
      .select('*')
      .single();
    this.throwIfError(error, 'Error anulando claim');
    if (!data) throw new NotFoundException('Claim no encontrado o ya no está activo');
    return camelize(data as Row);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  async getStats(eventId?: string) {
    let q = this.supabase.schema('public').from('coupons').select('*');
    if (eventId) q = q.eq('event_id', eventId);
    const { data: coupons } = await q;
    const { data: claims } = await this.supabase
      .from('coupon_claims')
      .select('status');
    const claimsArr = (claims as Row[]) || [];
    return {
      totalCoupons: (coupons as Row[])?.length || 0,
      activeCoupons:
        (coupons as Row[])?.filter((c) => (c.status as string) === 'ACTIVE').length || 0,
      totalClaims: claimsArr.length,
      activeClaims: claimsArr.filter((c) => c.status === 'CLAIMED').length,
      totalRedemptions: claimsArr.filter((c) => c.status === 'REDEEMED').length,
      expiredClaims: claimsArr.filter((c) => c.status === 'EXPIRED').length,
    };
  }
}
