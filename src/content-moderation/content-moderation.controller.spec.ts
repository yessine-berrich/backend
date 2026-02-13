import { Test, TestingModule } from '@nestjs/testing';
import { ContentModerationController } from './content-moderation.controller';
import { ContentModerationService } from './content-moderation.service';

describe('ContentModerationController', () => {
  let controller: ContentModerationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentModerationController],
      providers: [ContentModerationService],
    }).compile();

    controller = module.get<ContentModerationController>(ContentModerationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
