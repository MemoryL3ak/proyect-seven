import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import { VehiclePosition } from './entities/vehicle-position.entity';
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
        {
          provide: getRepositoryToken(VehiclePosition),
          useValue: { query: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<VehiclePositionsService>(VehiclePositionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
