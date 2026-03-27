import { Module } from '@nestjs/common';
import { FoodMenusController } from './food-menus.controller';
import { FoodMenusService } from './food-menus.service';

@Module({
  controllers: [FoodMenusController],
  providers: [FoodMenusService],
})
export class FoodMenusModule {}
