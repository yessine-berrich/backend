import { Controller } from '@nestjs/common';
import { ContentModerationService } from './content-moderation.service';

@Controller('content-moderation')
export class ContentModerationController {
  constructor(private readonly contentModerationService: ContentModerationService) {}
}
