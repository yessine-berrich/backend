import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './entities/article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { User } from 'src/users/entities/user.entity';
import { ArticleVersion } from './entities/article-version.entity';
import { MediaService } from 'src/media/media.service';
import { ArticleView } from './entities/article-view.entity';
import { SemanticSearchService } from 'src/semantic-search/semantic-search.service';
import { ArticleInteractionService } from './article-interaction.service';
import { ArticleStatus, NotificationType } from 'utils/constants';
import { ContentModerationService } from 'src/content-moderation/content-moderation.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationGateway } from 'src/notification/notification.gateway';

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,

    @InjectRepository(ArticleVersion)
    private readonly versionRepository: Repository<ArticleVersion>,

    @InjectRepository(ArticleView)
    private readonly viewRepository: Repository<ArticleView>,

    private readonly mediaService: MediaService,
    private readonly semanticSearchService: SemanticSearchService,
    private readonly articleInteractionService: ArticleInteractionService,
    private readonly moderationService: ContentModerationService,
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // ────────────────────────────────────────────────
  // CREATE ─ avec première version
  // ────────────────────────────────────────────────
async create(
  createArticleDto: CreateArticleDto,
  user: User,
): Promise<Article> {
  const {
    tagIds,
    categoryId,
    media: mediaDtos,
    ...articleData
  } = createArticleDto;

  let initialStatus = ArticleStatus.DRAFT;

  if (
    createArticleDto.status &&
    Object.values(ArticleStatus).includes(createArticleDto.status)
  ) {
    initialStatus = createArticleDto.status;
  }

  const article = this.articleRepository.create({
    ...articleData,
    author: user,
    category: { id: categoryId },
    tags: tagIds?.map((id) => ({ id })) || [],
    status: initialStatus,
  });

  let savedArticle = await this.articleRepository.save(article);

  // Gestion médias
  if (mediaDtos?.length) {
    const mediaPromises = mediaDtos.map((dto) =>
      this.mediaService.create({
        ...dto,
        articleId: savedArticle.id,
        type: this.mediaService.getMediaTypeFromMimeType(dto.mimetype),
      }),
    );
    savedArticle.media = await Promise.all(mediaPromises);
  }

  // Auto-modération IA
  const hasContent = !!savedArticle.title?.trim() && !!savedArticle.content?.trim();

  if (hasContent) {
    try {
      const moderation = await this.moderationService.moderate(
        savedArticle.title,
        savedArticle.content,
      );

      savedArticle.moderationResult = moderation;
      savedArticle.isAutoModerated = true;
      savedArticle.moderationScore = moderation.score;

      let newStatus = savedArticle.status;
      let notificationMessage = "";
      let notificationType: NotificationType = NotificationType.SYSTEM_INFO; // nouveau type à ajouter

      // Décision automatique
      if (
        moderation.score > 0.70 ||
        moderation.categories?.includes('severe_toxicity') ||
        moderation.categories?.includes('violence') ||
        moderation.categories?.includes('hate_speech')
      ) {
        newStatus = ArticleStatus.REJECTED;
        savedArticle.rejectionReason =
          moderation.reason || "Contenu jugé inapproprié par l'auto-modération";
        notificationMessage =
          `Votre article "${savedArticle.title}" a été rejeté automatiquement : ${savedArticle.rejectionReason}`;
        notificationType = NotificationType.ARTICLE_REJECTED;
      } else if (moderation.isFlagged || moderation.score > 0.35) {
        newStatus = ArticleStatus.PENDING;
        notificationMessage =
          `Votre article "${savedArticle.title}" est en attente de validation (modération automatique a détecté un risque potentiel)`;
        notificationType = NotificationType.ARTICLE_PENDING_MODERATION;
      } else {
        newStatus = ArticleStatus.PUBLISHED;
        notificationMessage =
          `Votre article "${savedArticle.title}" a été publié automatiquement (approuvé par la modération IA)`;
        notificationType = NotificationType.ARTICLE_PUBLISHED;
      }

      savedArticle.status = newStatus;
      savedArticle = await this.articleRepository.save(savedArticle);

      // Envoyer notification au créateur (sender = null = système)
      await this.notificationService.createAndNotify(
        notificationType,
        user.id,                    // destinataire = auteur de l'article
        null,                       // sender = système
        notificationMessage,
        {
          articleId: savedArticle.id,
          moderationScore: moderation.score,
          moderationCategories: moderation.categories,
        },
      );

    } catch (err) {
      console.error("Échec auto-modération IA :", err);
      // Notification d'erreur technique au créateur
      await this.notificationService.createAndNotify(
        NotificationType.SYSTEM_ERROR,
        user.id,
        null,
        "La modération automatique a échoué. Votre article est en brouillon. Veuillez réessayer ou contacter le support.",
        { articleId: savedArticle.id },
      );
    }
  }

  // Créer la version 1
  await this.createNewVersion(savedArticle, user, "Création initiale de l’article");

  // Embedding en tâche de fond
  this.generateAndSaveEmbedding(savedArticle.id).catch(console.error);

  return this.findOne(savedArticle.id);
}

  /**
   * Génère et sauvegarde le vecteur sémantique (appelée en tâche de fond)
   */
  private async generateAndSaveEmbedding(articleId: number): Promise<void> {
    try {
      const article = await this.articleRepository.findOneOrFail({
        where: { id: articleId },
        relations: ['category', 'tags'],
      });

      const textToEmbed = `
Titre: ${article.title}
Catégorie: ${article.category?.name || 'Non classé'}
Tags: ${article.tags?.map((t) => t.name).join(', ') || 'aucun'}
Contenu:
${article.content}
    `.trim();

      console.log(
        `[EMBED] Texte envoyé à Ollama pour article ${articleId} (${textToEmbed.length} chars)`,
      );

      const vector =
        await this.semanticSearchService.generateEmbedding(textToEmbed);

      if (!vector || !Array.isArray(vector) || vector.length !== 768) {
        console.warn(
          `[EMBED] Vecteur invalide pour article ${articleId} : length=${vector?.length ?? 'null'}`,
        );
        return;
      }

      if (vector?.length === 768) {
        // FORMATAGE OBLIGATOIRE : string au format pgvector '[val1, val2, ...]'
        const vectorString =
          '[' + vector.map((v) => Number(v).toFixed(8)).join(', ') + ']';

        await this.articleRepository.query(
          `
  UPDATE articles
  SET embedding_vector_pg = $1::vector
  WHERE id = $2
  `,
          [vectorString, articleId],
        );

        console.log(
          `[EMBED] Vecteur correctement sauvegardé (dim 768) pour article ${articleId}`,
        );
      } else {
        console.warn(
          `[EMBED] Vecteur invalide (dim = ${vector?.length ?? 'null'}, attendu 768)`,
        );
      }
    } catch (err) {
      console.error(
        `[EMBED] Échec génération/sauvegarde pour article ${articleId} :`,
        err.message,
      );
    }
  }

  /**
   * Recherche sémantique d'articles (appelée par le controller /search)
   */
  async semanticSearch(
    query: string,
    limit = 10,
    minSimilarity = 0.72,
    status: ArticleStatus = ArticleStatus.PUBLISHED,
  ): Promise<
    {
      id: number;
      title: string;
      content_preview: string;
      similarity: number;
    }[]
  > {
    if (!query?.trim()) {
      return [];
    }

    // Génération du vecteur pour la requête
    const queryVector = await this.semanticSearchService.generateEmbedding(
      query.trim(),
    );

    if (
      !queryVector ||
      !Array.isArray(queryVector) ||
      queryVector.length !== 768
    ) {
      console.warn('[SEARCH] Vecteur requête invalide', {
        length: queryVector?.length ?? 'null',
      });
      return [];
    }

    // Format pgvector obligatoire : '[val1, val2, ...]'
    const vectorString =
      '[' + queryVector.map((v) => Number(v).toFixed(8)).join(', ') + ']';

    console.log(
      '[SEARCH] Vecteur formaté (début) :',
      vectorString.substring(0, 120) + '...',
    );

    console.log(
      '[SEARCH] Nombre de vecteurs dans la base :',
      await this.articleRepository.query(
        `SELECT COUNT(*) AS count FROM articles WHERE embedding_vector_pg IS NOT NULL`,
      ),
    );

    try {
      const results = await this.articleRepository.query(
        `
      SELECT 
        id,
        title,
        LEFT(content, 300) AS content_preview,
        ROUND(CAST((1 - (embedding_vector_pg <=> $1::vector)) AS numeric), 4) AS similarity
      FROM articles
      WHERE embedding_vector_pg IS NOT NULL
        AND status = $2
        AND (embedding_vector_pg <=> $1::vector) <= (1 - $3::numeric)
      ORDER BY similarity DESC
      LIMIT $4
      `,
        [vectorString, status, minSimilarity, limit],
      );

      console.log('[SEARCH] Résultats trouvés :', results.length);

      return results;
    } catch (err) {
      console.error('[SEARCH] Erreur pgvector :', err.message, err.stack);
      throw new InternalServerErrorException({
        message: 'Erreur lors de la recherche sémantique',
        debug: err.message,
      });
    }
  }

  async findAll() {
    try {
      console.log('📡 ArticleService.findAll() appelé');
      
      const articles = await this.articleRepository.find({
        relations: [
          'author', 
          'category', 
          'tags', 
          'media', 
          'likes',      // ✅ Important: charger les likes
          'bookmarks',   // ✅ Important: charger les bookmarks
          'comments'
        ],
        order: { createdAt: 'DESC' },
      });
      
      console.log(`✅ ${articles.length} articles trouvés avec relations`);
      
      // ✅ Vérifier que les relations sont bien chargées
      articles.forEach(article => {
        console.log(`📊 Article ${article.id} - likes: ${article.likes?.length || 0}, bookmarks: ${article.bookmarks?.length || 0}`);
      });
      
      return articles;
    } catch (error) {
      console.error('❌ Erreur dans articleService.findAll():', error);
      throw error;
    }
  }

  // ────────────────────────────────────────────────
  // Méthode centrale de création de version
  // ────────────────────────────────────────────────
  private async createNewVersion(
    article: Article,
    user: User,
    changeSummary: string,
  ): Promise<ArticleVersion> {
    const lastVersion = await this.versionRepository.findOne({
      where: { articleId: article.id },
      order: { versionNumber: 'DESC' },
    });

    const nextVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const version = this.versionRepository.create({
      article,
      articleId: article.id,
      versionNumber: nextVersionNumber,
      title: article.title,
      content: article.content,
      author: user,
      authorId: user.id,
      status: article.status,
      changeSummary,
      categorySnapshot: article.category
        ? { id: article.category.id, name: article.category.name }
        : undefined,
      tagsSnapshot: article.tags?.map((t) => ({ id: t.id, name: t.name })),
    });

    const savedVersion = await this.versionRepository.save(version);

    // Mettre à jour le numéro de version courante
    article.currentVersionNumber = nextVersionNumber;
    await this.articleRepository.save(article);

    return savedVersion;
  }

  // ────────────────────────────────────────────────
  // Historique complet
  // ────────────────────────────────────────────────
  async getHistory(articleId: number): Promise<ArticleVersion[]> {
    return this.versionRepository.find({
      where: { articleId },
      relations: ['author'],
      order: { versionNumber: 'DESC' },
    });
  }

  // ────────────────────────────────────────────────
  // Revenir à une version précédente
  // ────────────────────────────────────────────────
  async revertToVersion(
    articleId: number,
    versionNumber: number,
    user: User,
  ): Promise<Article> {
    const version = await this.versionRepository.findOneOrFail({
      where: { articleId, versionNumber },
    });

    const article = await this.articleRepository.findOneOrFail({
      where: { id: articleId },
      relations: ['category', 'tags'],
    });

    // Mise à jour des champs principaux
    article.title = version.title;
    article.content = version.content;
    article.status = version.status as ArticleStatus;

    // Note : on ne restaure PAS automatiquement category/tags (trop risqué)
    // → on peut le faire manuellement si vraiment nécessaire

    const updated = await this.articleRepository.save(article);

    // Créer une nouvelle version pour ce rollback
    await this.createNewVersion(
      updated,
      user,
      `Retour à la version ${versionNumber}`,
    );

    return this.findOne(articleId);
  }

  // ────────────────────────────────────────────────
  // Méthodes existantes (inchangées ou légèrement adaptées)
  // ────────────────────────────────────────────────
  async findOne(id: number): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: [
        'author',
        'category',
        'tags',
        'media',
        'comments',
        'comments.author',
        'versions',
      ],
    });

    if (!article) throw new NotFoundException(`Article #${id} non trouvé`);
    return article;
  }

  // ────────────────────────────────────────────────
  // UPDATE ─ crée une nouvelle version à chaque modif significative
  // ────────────────────────────────────────────────
  async update(
    id: number,
    updateArticleDto: UpdateArticleDto,
    user: User,
  ): Promise<Article> {
    let article = await this.articleRepository.findOneOrFail({
      where: { id },
      relations: ['category', 'tags', 'versions'],
    });

    const hasSignificantChange =
      !!updateArticleDto.title ||
      !!updateArticleDto.content ||
      !!updateArticleDto.status ||
      !!updateArticleDto.categoryId ||
      !!updateArticleDto.tagIds;

    // Mise à jour sécurisée des champs
    if (updateArticleDto.title) {
      article.title = updateArticleDto.title;
    }
    if (updateArticleDto.content) {
      article.content = updateArticleDto.content;
    }
    if (updateArticleDto.status) {
      // Validation + cast sécurisé
      if (Object.values(ArticleStatus).includes(updateArticleDto.status)) {
        article.status = updateArticleDto.status;
      } else {
        console.warn(`Statut invalide ignoré : ${updateArticleDto.status}`);
        // ou throw new BadRequestException() si tu préfères
      }
    }
    if (updateArticleDto.categoryId) {
      article.category = { id: updateArticleDto.categoryId } as any;
    }
    if (updateArticleDto.tagIds) {
      article.tags = updateArticleDto.tagIds.map((id) => ({ id })) as any;
    }

    article = await this.articleRepository.save(article);

    if (hasSignificantChange) {
      await this.createNewVersion(
        article,
        user,
        updateArticleDto.changeSummary ?? 'Mise à jour du contenu',
      );
    }

    if (
      updateArticleDto.title ||
      updateArticleDto.content ||
      updateArticleDto.categoryId ||
      updateArticleDto.tagIds
    ) {
      this.generateAndSaveEmbedding(id).catch(console.error);
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const article = await this.findOne(id);
    await this.articleRepository.remove(article);
  }

  async incrementView(
    articleId: number,
    userId?: number,
    ip?: string,
  ): Promise<void> {
    if (!userId && !ip) return;

    const existing = await this.viewRepository.findOne({
      where: {
        article: { id: articleId },
        ...(userId ? { user: { id: userId } } : { ipAddress: ip }),
      },
    });

    if (!existing) {
      const view = this.viewRepository.create({
        article: { id: articleId },
        user: userId ? { id: userId } : undefined,
        ipAddress: ip,
      });

      await this.viewRepository.save(view);

      await this.articleRepository.increment(
        { id: articleId },
        'viewsCount',
        1,
      );
    }
  }

  async toggleLike(articleId: number, userId: number): Promise<Article> {
    return this.articleInteractionService.toggleLike(articleId, userId);
  }

  async toggleBookmark(articleId: number, userId: number): Promise<Article> {
    return this.articleInteractionService.toggleBookmark(articleId, userId);
  }

  async getUserLikedArticles(userId: number): Promise<Article[]> {
    return this.articleInteractionService.getUserLikedArticles(userId);
  }

  async getUserBookmarkedArticles(userId: number): Promise<Article[]> {
    return this.articleInteractionService.getUserBookmarkedArticles(userId);
  }
 // Edit Bay BADER ******************************************************************************
  async getArticlesByUserId(userId: number): Promise<Article[]> {
    return this.articleRepository.find({
      where: { author: { id: userId } },
      relations: ['author', 'category', 'tags', 'media',
        'likes',      // ✅ AJOUTER
      'bookmarks',  // ✅ AJOUTER
      'comments'    // ✅ AJOUTER
      ],
      order: { createdAt: 'DESC' },
    });
  }
}