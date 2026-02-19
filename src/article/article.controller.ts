import { ArticleInteractionService } from './article-interaction.service';
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
  Req,
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleStatus, userRole } from 'utils/constants';
import { ArticleService } from './article.service';
import { Roles } from 'src/users/decorators/user-role.decorator';
import { AuthGuard } from 'src/users/guards/auth.guard';
import { CurrentPayload } from 'src/users/decorators/current-payload.decorator';
import type { JwtPayloadType } from 'utils/types';
import { User } from 'src/users/entities/user.entity';
import { SemanticSearchService } from 'src/semantic-search/semantic-search.service';
import { UsersService } from 'src/users/users.service';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt'; // 👈 AJOUTER CET IMPORT


@Controller('api/articles')
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly userService: UsersService,
    private readonly semanticSearchService: SemanticSearchService,
    private readonly articleInteractionService: ArticleInteractionService,
    private readonly jwtService: JwtService, // 👈 AJOUTER DANS LE CONSTRUCTEUR
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

 // DANS article.controller.ts
@Get()
  async findAll(@Req() request: Request) {
    let userId: number | undefined = undefined;
    
    try {
      const authHeader = request.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        const payload = this.jwtService.verify(token);
        userId = payload.sub;
      }
    } catch (err) {
      // Token invalide ou expiré - on ignore
    }
    
    const articles = await this.articleService.findAll();
    
    return articles.map(article => {
      const isLiked = userId ? article.likes?.some(like => like.id === userId) : false;
      const isBookmarked = userId ? article.bookmarks?.some(bookmark => bookmark.id === userId) : false;
      
      return {
        id: article.id,
        title: article.title,
        content: article.content,
        description: article.content?.substring(0, 150) + '...' || '',
        status: article.status,
        viewsCount: article.viewsCount || 0,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        
        author: article.author ? {
          id: article.author.id,
          name: `${article.author.firstName || ''} ${article.author.lastName || ''}`.trim() || 'Utilisateur',
          initials: ((article.author.firstName?.charAt(0) || '') + (article.author.lastName?.charAt(0) || '')).toUpperCase() || 'U',
          department: article.author.role || 'Membre',
          avatar: article.author.profileImage,
        } : null,
        
        category: article.category ? {
          id: article.category.id,
          name: article.category.name,
          slug: article.category.name?.toLowerCase().replace(/\s+/g, '-') || '',
        } : null,
        
        tags: article.tags?.map(tag => tag?.name || '').filter(Boolean) || [],
        
        stats: {
          likes: article.likes?.length || 0,
          comments: article.comments?.length || 0,
          views: article.viewsCount || 0,
        },
        
        isLiked: isLiked,
        isBookmarked: isBookmarked,
        isFeatured: false,
      };
    });
  }

// Dans article.controller.ts

// Dans article.controller.ts

@Get(':id')
async findOne(
  @Param('id', ParseIntPipe) id: number,
  @Req() request: Request,
) {
  let userId: number | undefined = undefined;
  
  try {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const payload = this.jwtService.verify(token);
      userId = payload.sub;
    }
  } catch (err) {
    // Token invalide ou expiré - on ignore
  }
  
  const article = await this.articleService.findOne(id);
  
  // Calculer isLiked et isBookmarked à partir des tableaux chargés
  const isLiked = userId ? article.likes?.some(like => like.id === userId) : false;
  const isBookmarked = userId ? article.bookmarks?.some(bookmark => bookmark.id === userId) : false;
  
  // Retourner l'article formaté avec toutes les informations
  return {
    id: article.id,
    title: article.title,
    content: article.content,
    description: article.content?.substring(0, 150) + '...' || '',
    status: article.status,
    viewsCount: article.viewsCount || 0,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    
    author: article.author ? {
      id: article.author.id,
      name: `${article.author.firstName || ''} ${article.author.lastName || ''}`.trim() || 'Utilisateur',
      initials: ((article.author.firstName?.charAt(0) || '') + (article.author.lastName?.charAt(0) || '')).toUpperCase() || 'U',
      department: article.author.role || 'Membre',
      avatar: article.author.profileImage,
    } : null,
    
    category: article.category ? {
      id: article.category.id,
      name: article.category.name,
      slug: article.category.name?.toLowerCase().replace(/\s+/g, '-') || '',
    } : null,
    
    tags: article.tags?.map(tag => tag?.name || '').filter(Boolean) || [],
    
    stats: {
      likes: article.likes?.length || 0,
      comments: article.comments?.length || 0,
      views: article.viewsCount || 0,
    },
    
    // ✅ Ces champs sont maintenant calculés correctement
    isLiked: isLiked,
    isBookmarked: isBookmarked,
    isFeatured: false,
    
    // Optionnel: inclure les tableaux complets si nécessaire
    likes: article.likes,
    bookmarks: article.bookmarks,
    comments: article.comments,
  };
}
  // ─── UPDATE ────────────────────────────────────────
  @Patch(':id')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateArticleDto: UpdateArticleDto,
    @CurrentPayload() payload: JwtPayloadType,
  ) {
    const user = await this.userService.getUserById(payload.sub)
    return this.articleService.update(id, updateArticleDto, user as User);
  }

  // ─── DELETE ────────────────────────────────────────
  @Delete(':id')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.remove(id);
  }

  @Get(':id/history')
  @UseGuards(AuthGuard)
  async getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.getHistory(id);
  }

  @Post(':id/revert/:versionNumber')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  async revertToVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @CurrentPayload() payload: JwtPayloadType,
  ) {
    const user = { id: payload.sub } as User;
    const article = await this.articleService.revertToVersion(
      id,
      versionNumber,
      user,
    );
    return {
      success: true,
      message: `Article revenu à la version ${versionNumber}`,
      article: { id: article.id, title: article.title, status: article.status },
    };
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

      const statusStr = String(body.status ?? '')
        .trim()
        .toLowerCase();
      const validStatus: ArticleStatus = Object.values(ArticleStatus).includes(
        statusStr as any,
      )
        ? (statusStr as ArticleStatus)
        : ArticleStatus.PUBLISHED;

      const safeLimit = Math.max(1, Math.min(isNaN(limit) ? 10 : limit, 50));
      const safeMinSimilarity = Math.max(
        0.1,
        Math.min(isNaN(minSimilarity) ? 0.72 : minSimilarity, 0.98),
      );

      if (!query) {
        return {
          success: false,
          message: 'Champ "q" obligatoire',
          results: [],
        };
      }

      console.log('Appel semanticSearch avec :', {
        query,
        safeLimit,
        safeMinSimilarity,
        validStatus,
      });

      const results = await this.articleService.semanticSearch(
        query,
        safeLimit,
        safeMinSimilarity,
        validStatus,
      );

      return {
        success: true,
        query,
        params: {
          limit: safeLimit,
          minSimilarity: safeMinSimilarity,
          status: validStatus,
        },
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

  // LIKE ENDPOINT
  @Post(':id/like')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  async toggleLike(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPayload() payload: JwtPayloadType,
  ) {
    try {
      const article = await this.articleInteractionService.toggleLike(
        id,
        payload.sub,
      );
      return {
        success: true,
        message: 'Like mis à jour avec succès',
        article: {
          id: article.id,
          title: article.title,
          likesCount: article.likes?.length || 0,
          isLiked:
            article.likes?.some((like) => like.id === payload.sub) || false,
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Erreur lors du like');
    }
  }

  // BOOKMARK ENDPOINT
  @Post(':id/bookmark')
  @UseGuards(AuthGuard)
  async toggleBookmark(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPayload() payload: JwtPayloadType,
  ) {
    try {
      const article = await this.articleInteractionService.toggleBookmark(
        id,
        payload.sub,
      );
      return {
        success: true,
        message: 'Bookmark mis à jour avec succès',
        article: {
          id: article.id,
          title: article.title,
          bookmarksCount: article.bookmarks?.length || 0,
          isBookmarked:
            article.bookmarks?.some(
              (bookmark) => bookmark.id === payload.sub,
            ) || false,
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Erreur lors du bookmark');
    }
  }

  // ============================================
// À MODIFIER DANS ArticleController
// ============================================

// DANS article.controller.ts - GET /user/liked
@Get('user/liked')
@UseGuards(AuthGuard)
async getUserLikedArticles(@CurrentPayload() payload: JwtPayloadType) {
  try {
    const articles = await this.articleInteractionService.getUserLikedArticles(payload.sub);
    return {
      success: true,
      count: articles.length,
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        description: article.content?.substring(0, 150) + '...' || '',
        author: article.author ? {
          id: article.author.id,
          name: `${article.author.firstName} ${article.author.lastName}`,
          avatar: article.author.profileImage,
        } : null,
        category: article.category ? {
          id: article.category.id,
          name: article.category.name,
        } : null,
        createdAt: article.createdAt,
        likesCount: article.likes?.length || 0,
        bookmarksCount: article.bookmarks?.length || 0,
        commentsCount: article.comments?.length || 0,
        // ✅ AJOUTER CES LIGNES
        isLiked: true, // Forcément true car ce sont ses likes
        isBookmarked: article.bookmarks?.some(bookmark => bookmark.id === payload.sub) || false,
      })),
    };
  } catch (error) {
    throw new BadRequestException(error.message);
  }
}

// DANS article.controller.ts - GET /user/bookmarked
@Get('user/bookmarked')
@UseGuards(AuthGuard)
async getUserBookmarkedArticles(@CurrentPayload() payload: JwtPayloadType) {
  try {
    const articles = await this.articleInteractionService.getUserBookmarkedArticles(payload.sub);
    return {
      success: true,
      count: articles.length,
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        description: article.content?.substring(0, 150) + '...' || '',
        author: article.author ? {
          id: article.author.id,
          name: `${article.author.firstName} ${article.author.lastName}`,
          avatar: article.author.profileImage,
        } : null,
        category: article.category ? {
          id: article.category.id,
          name: article.category.name,
        } : null,
        createdAt: article.createdAt,
        likesCount: article.likes?.length || 0,
        bookmarksCount: article.bookmarks?.length || 0,
        commentsCount: article.comments?.length || 0,
        // ✅ AJOUTER CES LIGNES
        isLiked: article.likes?.some(like => like.id === payload.sub) || false,
        isBookmarked: true, // Forcément true car ce sont ses bookmarks
      })),
    };
  } catch (error) {
    throw new BadRequestException(error.message);
  }
}
  // Dans votre controller NestJS
 // Edit Bay BADER ******************************************************************************
@Get('user/:userId')
async getArticlesByUserId(@Param('userId', ParseIntPipe) userId: number) {
  try {
    const articles = await this.articleService.getArticlesByUserId(userId);
    
    // Retourner les articles avec toutes les données nécessaires
    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      description: article.content?.substring(0, 150) + '...' || '',
      author: article.author ? {
        id: article.author.id,
        name: `${article.author.firstName || ''} ${article.author.lastName || ''}`.trim() || 'Utilisateur',
        firstName: article.author.firstName,
        lastName: article.author.lastName,
        avatar: article.author.profileImage,
      } : null,
      category: article.category ? {
        id: article.category.id,
        name: article.category.name,
      } : null,
      tags: article.tags?.map(tag => tag.name) || [],
      createdAt: article.createdAt,
      status: article.status,
      // ✅ RETOURNER LES RELATIONS
      likes: article.likes || [],           // Tableau complet des users qui ont liké
      bookmarks: article.bookmarks || [],   // Tableau complet des users qui ont bookmarké
      comments: article.comments || [],     // Tableau des commentaires
      // ✅ STATISTIQUES CALCULÉES
      stats: {
        likes: article.likes?.length || 0,
        comments: article.comments?.length || 0,
        views: article.viewsCount || 0,
      },
      // ✅ ÉTATS POUR L'UTILISATEUR COURANT (sera calculé côté frontend)
      viewsCount: article.viewsCount || 0,
    }));
  } catch (error) {
    throw new BadRequestException(error.message);
  }
}
}
