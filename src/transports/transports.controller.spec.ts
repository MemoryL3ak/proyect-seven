import { Test, TestingModule } from '@nestjs/testing';
import { TransportsController } from './transports.controller';
import { TransportsService } from './transports.service';
import { SupabaseClient } from '@supabase/supabase-js';

describe('TransportsController', () => {
  let controller: TransportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransportsController],
      providers: [
        TransportsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: {} as SupabaseClient,
        },
      ],
    }).compile();

    controller = module.get<TransportsController>(TransportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
