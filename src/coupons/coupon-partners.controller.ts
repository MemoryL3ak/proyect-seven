import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CouponPartnersService } from './coupon-partners.service';
import {
  CreatePartnerDto,
  PartnerLoginDto,
  UpdatePartnerDto,
} from './dto/partner.dto';
import { CouponsService } from './coupons.service';
import { ConfirmRedeemDto } from './dto/claim.dto';
import { PartnerAuthGuard } from './partner-auth.guard';

@Controller('coupon-partners')
export class CouponPartnersController {
  constructor(
    private readonly partners: CouponPartnersService,
    private readonly coupons: CouponsService,
  ) {}

  // ── Admin (sin auth — protegido a nivel de gateway/UI por ahora) ───────────

  @Get()
  list(@Query('eventId') eventId?: string) {
    return this.partners.list(eventId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.partners.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePartnerDto) {
    return this.partners.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.partners.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.partners.remove(id);
  }

  // ── Auth del partner ───────────────────────────────────────────────────────

  @Post('auth/login')
  login(@Body() dto: PartnerLoginDto, @Req() req: any) {
    return this.partners.login(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('auth/logout')
  logout(@Headers('x-partner-token') token: string) {
    return this.partners.logout(token);
  }

  // ── Endpoints protegidos del partner ───────────────────────────────────────

  @Get('me/profile')
  @UseGuards(PartnerAuthGuard)
  profile(@Req() req: any) {
    return req.partner;
  }

  @Get('me/stats')
  @UseGuards(PartnerAuthGuard)
  myStats(@Req() req: any) {
    return this.partners.myStats(req.partner.id);
  }

  @Get('me/redemptions')
  @UseGuards(PartnerAuthGuard)
  myRedemptions(@Req() req: any) {
    return this.partners.myRedemptions(req.partner.id, 20);
  }

  @Post('me/validate')
  @UseGuards(PartnerAuthGuard)
  validate(@Body() body: { token: string }, @Req() req: any) {
    return this.coupons.validateClaim(body.token, req.partner.id);
  }

  @Post('me/redeem')
  @UseGuards(PartnerAuthGuard)
  redeem(@Body() dto: ConfirmRedeemDto, @Req() req: any) {
    return this.coupons.redeemByToken(
      dto,
      req.partner.id,
      req.partner.name,
    );
  }
}
