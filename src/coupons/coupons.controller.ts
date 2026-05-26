import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateCouponDto,
  RedeemCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto';
import { ClaimCouponDto, ConfirmRedeemDto } from './dto/claim.dto';
import { CouponsService } from './coupons.service';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly service: CouponsService) {}

  // ── Listados / lectura ─────────────────────────────────────────────────────

  @Get('stats')
  stats(@Query('eventId') eventId?: string) {
    return this.service.getStats(eventId);
  }

  @Get('for-user')
  listForUser(
    @Query('userType') userType: string,
    @Query('eventId') eventId?: string,
  ) {
    return this.service.listForUser(userType || 'ATHLETE', eventId);
  }

  @Get('claims')
  listAllClaims(
    @Query('couponId') couponId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listClaims(couponId, status);
  }

  @Get('claims/mine')
  myClaims(@Query('userId') userId: string, @Query('status') status?: string) {
    return this.service.myClaims(userId, status);
  }

  @Get()
  list(
    @Query('eventId') eventId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('audience') audience?: string,
  ) {
    return this.service.list({ eventId, category, status, audience });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ── CRUD admin ─────────────────────────────────────────────────────────────

  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Claims (sistema con QR) ────────────────────────────────────────────────

  /** El atleta reclama un cupón */
  @Post(':id/claim')
  claim(@Param('id') id: string, @Body() dto: ClaimCouponDto) {
    return this.service.claim(id, dto);
  }

  /** Admin: anula un claim activo */
  @Post('claims/:claimId/revoke')
  revokeClaim(@Param('claimId') claimId: string) {
    return this.service.revokeClaim(claimId);
  }

  /** Público: valida un token/código (sin marcar) — útil para preview */
  @Post('claims/validate')
  validateClaim(@Body() body: { token: string }) {
    return this.service.validateClaim(body.token);
  }

  // ── Legacy (canje directo sin claim) ───────────────────────────────────────

  @Post(':id/redeem')
  redeem(@Param('id') id: string, @Body() dto: RedeemCouponDto) {
    return this.service.redeem(id, dto);
  }

  @Get(':id/redemptions')
  listRedemptions(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    return this.service.listRedemptions(id, userId);
  }

  /** Endpoint genérico de canje por token (usado en flujos sin auth de partner) */
  @Post('claims/redeem')
  redeemByToken(@Body() dto: ConfirmRedeemDto) {
    return this.service.redeemByToken(dto);
  }
}
