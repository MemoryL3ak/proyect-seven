import { Test, TestingModule } from '@nestjs/testing';
import { TransportsService } from './transports.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('TransportsService', () => {
  let service: TransportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransportsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: {} as SupabaseClient,
        },
      ],
    }).compile();

    service = module.get<TransportsService>(TransportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
