import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { VehiclePositionsService } from './vehicle-positions.service';

describe('VehiclePositionsService', () => {
  let service: VehiclePositionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclePositionsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: {} as SupabaseClient,
        },
      ],
    }).compile();

    service = module.get<VehiclePositionsService>(VehiclePositionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
