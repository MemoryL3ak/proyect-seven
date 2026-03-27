import { Module } from '@nestjs/common';
import { FoodLocationsController } from './food-locations.controller';
import { FoodLocationsService } from './food-locations.service';

@Module({
  controllers: [FoodLocationsController],
  providers: [FoodLocationsService],
})
export class FoodLocationsModule {}
