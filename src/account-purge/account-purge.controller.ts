import { StaffOnly } from '../auth/staff-only.decorator';
import { Controller, Post } from '@nestjs/common';
import { AccountPurgeService } from './account-purge.service';

@StaffOnly()
@Controller('account-purge')
export class AccountPurgeController {
  constructor(private readonly accountPurgeService: AccountPurgeService) {}

  /**
   * Corre la purga a demanda (QA / soporte). Idempotente y acotada: sólo
   * procesa cuentas ya DELETED con el período de gracia vencido — lo mismo
   * que el cron diario haría por sí solo.
   */
  @Post('run')
  run() {
    return this.accountPurgeService.run();
  }
}
