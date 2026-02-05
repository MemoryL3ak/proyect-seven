import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { VehiclePositionsController } from './vehicle-positions.controller';
import { VehiclePositionsService } from './vehicle-positions.service';

describe('VehiclePositionsController', () => {
  let controller: VehiclePositionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehiclePositionsController],
      providers: [
        VehiclePositionsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: {} as SupabaseClient,
        },
      ],
    }).compile();

    controller = module.get<VehiclePositionsController>(VehiclePositionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
