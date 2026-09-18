import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoodMenusController } from './food-menus.controller';
import { FoodMenusService } from './food-menus.service';

@Module({
  // AuthModule: StaffScopeService acota la alimentación a la delegación del Jefe de Misión.
  imports: [AuthModule],
  controllers: [FoodMenusController],
  providers: [FoodMenusService],
})
export class FoodMenusModule {}
