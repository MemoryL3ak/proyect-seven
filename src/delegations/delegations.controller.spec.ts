import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';

describe('DelegationsController', () => {
  let controller: DelegationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DelegationsController],
      providers: [
        DelegationsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: {} as SupabaseClient,
        },
      ],
    }).compile();

    controller = module.get<DelegationsController>(DelegationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
