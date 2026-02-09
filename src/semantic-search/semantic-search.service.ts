// src/semantic-search/semantic-search.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from 'src/article/entities/article.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ArticleStatus } from 'src/article/entities/article.entity';

@Injectable()
export class SemanticSearchService {
  private readonly ollamaHost = 'http://localhost:11434';
  private readonly embedModel = 'nomic-embed-text'; // ou 'mxbai-embed-large' pour de meilleurs résultats

  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,

    private readonly httpService: HttpService,
  ) {}

  /**
   * Génère un vecteur d'embedding via Ollama
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!text?.trim()) return null;

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.ollamaHost}/api/embed`, {
          model: this.embedModel,
          input: text,
        }),
      );

      const embedding = response.data.embeddings?.[0];

      if (!Array.isArray(embedding) || embedding.length !== 768) {
        throw new Error(`Dimension invalide : ${embedding?.length ?? 'null'}`);
      }

      return embedding;
    } catch (error) {
      console.error('Erreur Ollama embedding:', error.message);
      return null;
    }
  }

  /**
   * Recherche sémantique principale
   */
  async semanticSearch(
    query: string,
    limit = 10,
    minSimilarity = 0.72,
    status: ArticleStatus = ArticleStatus.PUBLISHED,
  ): Promise<{
    id: number;
    title: string;
    content_preview: string;
    similarity: number;
  }[]> {
    if (!query?.trim()) return [];

    const queryVector = await this.generateEmbedding(query.trim());

    if (!queryVector?.length) {
      console.warn('Impossible de générer le vecteur pour la requête');
      return [];
    }

    const results = await this.articleRepository.query(
      `
      SELECT 
        id,
        title,
        LEFT(content, 280) AS content_preview,
        ROUND(CAST((1 - (embedding_vector <=> $1)) AS numeric), 4) AS similarity
      FROM articles
      WHERE embedding_vector IS NOT NULL
        AND status = $2
        AND (embedding_vector <=> $1) <= (1 - $3)
      ORDER BY similarity DESC
      LIMIT $4
      `,
      [queryVector, status, minSimilarity, limit],
    );

    return results;
  }

  /**
   * Méthode utilitaire : retourne le modèle utilisé
   */
  getEmbedModel(): string {
    return this.embedModel;
  }
}