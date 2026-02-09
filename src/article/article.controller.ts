import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  BadRequestException,
  ParseFloatPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { userRole } from 'utils/constants';
import { ArticleService } from './article.service';
import { Roles } from 'src/users/decorators/user-role.decorator';
import { AuthGuard } from 'src/users/guards/auth.guard';
import { CurrentPayload } from 'src/users/decorators/current-payload.decorator';
import type { JwtPayloadType } from 'utils/types';
import { User } from 'src/users/entities/user.entity';
import { ArticleStatus } from './entities/article.entity';
import { SemanticSearchService } from 'src/semantic-search/semantic-search.service';

@Controller('api/articles')
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly semanticSearchService: SemanticSearchService,
  ) {}

  @Post()
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  create(
    @Body() createArticleDto: CreateArticleDto,
    @CurrentPayload() payload: JwtPayloadType,
  ) {
    return this.articleService.create(createArticleDto, {
      id: payload.sub,
    } as User);
  }

  @Get()
  findAll() {
    return this.articleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.findOne(id);
  }

  @Patch(':id')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateArticleDto: UpdateArticleDto,
  ) {
    return this.articleService.update(id, updateArticleDto);
  }

  @Delete(':id')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.remove(id);
  }

  @Post(':id/view')
  async handleView(@Param('id') id: string) {
    return this.articleService.incrementView(+id);
  }

  // ───────────────────────────────────────────────
  //              RECHERCHE SÉMANTIQUE
  // ───────────────────────────────────────────────

  @Post('search')
async semanticSearch(@Body() body: any) {
  console.log('Body reçu :', JSON.stringify(body, null, 2)); // ← DEBUG

  try {
    const query = String(body.q ?? '').trim();
    const limit = Number(body.limit ?? 10);
    const minSimilarity = Number(body.minSimilarity ?? 0.72);

    const statusStr = String(body.status ?? '').trim().toLowerCase();
    const validStatus: ArticleStatus = Object.values(ArticleStatus).includes(statusStr as any)
      ? (statusStr as ArticleStatus)
      : ArticleStatus.PUBLISHED;

    const safeLimit = Math.max(1, Math.min(isNaN(limit) ? 10 : limit, 50));
    const safeMinSimilarity = Math.max(0.1, Math.min(isNaN(minSimilarity) ? 0.72 : minSimilarity, 0.98));

    if (!query) {
      return { success: false, message: 'Champ "q" obligatoire', results: [] };
    }

    console.log('Appel semanticSearch avec :', { query, safeLimit, safeMinSimilarity, validStatus });

    const results = await this.articleService.semanticSearch(
      query,
      safeLimit,
      safeMinSimilarity,
      validStatus,
    );

    return {
      success: true,
      query,
      params: { limit: safeLimit, minSimilarity: safeMinSimilarity, status: validStatus },
      found: results.length,
      results,
    };
  } catch (err) {
    console.error('ERREUR INTERNE dans search endpoint :', err);
    return {
      success: false,
      message: 'Erreur serveur interne',
      debug: err.message || 'Détails dans les logs serveur',
    };
  }
}
}
