import { Module } from '@nestjs/common';
import { SemanticSearchService } from './semantic-search.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from 'src/article/entities/article.entity';
import { HttpModule } from '@nestjs/axios';  // For Ollama API calls

@Module({
  imports: [
    TypeOrmModule.forFeature([Article]),
    HttpModule,
  ],
  providers: [SemanticSearchService],
  exports: [SemanticSearchService],  // Export for use in other modules
})
export class SemanticSearchModule {}