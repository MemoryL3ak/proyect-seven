import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { Venue } from './entities/venue.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Venue])],
  controllers: [VenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
