import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripRequestsController } from './trip-requests.controller';
import { TripRequestsService } from './trip-requests.service';
import { TripRequest } from './entities/trip-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TripRequest])],
  controllers: [TripRequestsController],
  providers: [TripRequestsService],
})
export class TripRequestsModule {}
