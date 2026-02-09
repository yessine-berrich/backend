import { Controller } from '@nestjs/common';
import { SemanticSearchService } from './semantic-search.service';

@Controller('semantic-search')
export class SemanticSearchController {
  constructor(private readonly semanticSearchService: SemanticSearchService) {}
}
