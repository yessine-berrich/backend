import { Test, TestingModule } from '@nestjs/testing';
import { SemanticSearchController } from './semantic-search.controller';
import { SemanticSearchService } from './semantic-search.service';

describe('SemanticSearchController', () => {
  let controller: SemanticSearchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SemanticSearchController],
      providers: [SemanticSearchService],
    }).compile();

    controller = module.get<SemanticSearchController>(SemanticSearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
