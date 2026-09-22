import { Module } from '@nestjs/common';
import { MealTimeBlocksController } from './meal-time-blocks.controller';
import { MealTimeBlocksService } from './meal-time-blocks.service';

@Module({
  controllers: [MealTimeBlocksController],
  providers: [MealTimeBlocksService],
})
export class MealTimeBlocksModule {}
