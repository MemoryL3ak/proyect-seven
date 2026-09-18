import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoodLocationsController } from './food-locations.controller';
import { FoodLocationsService } from './food-locations.service';

@Module({
  // AuthModule: StaffScopeService acota la alimentación a la delegación del Jefe de Misión.
  imports: [AuthModule],
  controllers: [FoodLocationsController],
  providers: [FoodLocationsService],
})
export class FoodLocationsModule {}
