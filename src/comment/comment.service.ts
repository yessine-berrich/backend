import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { User } from '../users/entities/user.entity';
import { NotificationGateway } from 'src/notification/notification.gateway';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType } from 'utils/constants';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async create(
    createCommentDto: {
      articleId: number;
      content: string;
      parentId?: number;
      mentionedUserIds?: number[];
    },
    userId: number,
  ): Promise<Comment> {
    // Récupérer l'utilisateur
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Créer le commentaire avec les IDs
    const comment = this.commentRepository.create({
      content: createCommentDto.content,
      article: { id: createCommentDto.articleId } as any, // Référence à l'article par ID
      author: user,
    });

    // Gérer la réponse à un commentaire parent
    if (createCommentDto.parentId) {
      const parentComment = await this.commentRepository.findOne({
        where: { id: createCommentDto.parentId },
        relations: ['article'],
      });

      if (!parentComment) {
        throw new NotFoundException('Commentaire parent non trouvé');
      }

      // Vérifier que le parent appartient au même article
      if (parentComment.article.id !== createCommentDto.articleId) {
        throw new ForbiddenException(
          'Le commentaire parent ne correspond pas au même article',
        );
      }

      comment.parent = parentComment;
    }

    // Gérer les mentions
    if (
      createCommentDto.mentionedUserIds &&
      createCommentDto.mentionedUserIds.length > 0
    ) {
      const mentionedUsers = await this.userRepository.findByIds(
        createCommentDto.mentionedUserIds,
      );
      comment.mentionedUsers = mentionedUsers;
    }

    // const savedComment = await this.commentRepository.save(comment);

    // // Retourner avec les relations nécessaires
    // return await this.commentRepository.findOneOrFail({
    //   where: { id: savedComment.id },
    //   relations: [
    //     'author',
    //     'article',
    //     'parent',
    //     'mentionedUsers',
    //     'replies',
    //     'likes',
    //   ],
    // });

    const savedComment = await this.commentRepository.save(comment);

    const fullComment = await this.commentRepository.findOneOrFail({
      where: { id: savedComment.id },
      relations: [
        'author',
        'article',
        'parent',
        'mentionedUsers',
        'replies',
        'likes',
      ],
    });

    // ────────────────────────────────────────────────
    // Notifications
    // ────────────────────────────────────────────────

    const sender = fullComment.author;

    // Cas 1 : Réponse à un commentaire → notifier l'auteur du parent
    if (fullComment.parent) {
      const parentAuthorId = fullComment.parent.author.id;
      if (parentAuthorId !== userId) {
        // ne pas se notifier soi-même
        await this.sendCommentNotification(
          NotificationType.REPLY,
          parentAuthorId,
          sender,
          fullComment,
        );
      }
    }

    // Cas 2 : Mentions → notifier chaque personne mentionnée
    if (fullComment.mentionedUsers && fullComment.mentionedUsers.length > 0) {
      for (const mentioned of fullComment.mentionedUsers) {
        if (mentioned.id !== userId) {
          await this.sendCommentNotification(
            NotificationType.MENTION,
            mentioned.id,
            sender,
            fullComment,
          );
        }
      }
    }

    // Optionnel : notifier l'auteur de l'article (nouveau commentaire)
    // const articleAuthorId = fullComment.article.author.id;
    // if (articleAuthorId !== userId) { ... }

    // Retourner le commentaire complet
    return fullComment;
  }

  private async sendCommentNotification(
    type: NotificationType,
    recipientId: number,
    sender: User,
    comment: Comment,
  ): Promise<void> {
    // 1. Créer l'enregistrement en base
    const notification = this.notificationService.notificationRepository.create(
      {
        type,
        recipient: { id: recipientId } as User,
        sender,
        comment,
      },
    );

    const savedNotif =
      await this.notificationService.notificationRepository.save(notification);

    // 2. Charger la notification complète avec relations
    const fullNotif =
      await this.notificationService.notificationRepository.findOne({
        where: { id: savedNotif.id },
        relations: ['sender', 'comment', 'comment.author', 'comment.article'],
      });

    if (!fullNotif) return;

    // 3. Format léger pour le frontend
    const payload = {
      id: fullNotif.id,
      type: fullNotif.type,
      isRead: fullNotif.isRead,
      createdAt: fullNotif.createdAt,
      sender: {
        id: fullNotif.sender.id,
        name: `${fullNotif.sender.firstName} ${fullNotif.sender.lastName}`.trim(),
        avatar: fullNotif.sender.profileImage,
      },
      comment: {
        id: fullNotif.comment.id,
        content:
          fullNotif.comment.content.substring(0, 120) +
          (fullNotif.comment.content.length > 120 ? '...' : ''),
        articleId: fullNotif.comment.article?.id,
        articleTitle: fullNotif.comment.article?.title || 'Article',
      },
    };

    // 4. Envoyer en temps réel via WebSocket
    this.notificationGateway.sendNotification(recipientId, payload);
  }

  async findByArticle(
    articleId: number,
    currentUserId?: number,
  ): Promise<any[]> {
    const comments = await this.commentRepository.find({
      where: {
        article: { id: articleId },
        parent: IsNull(), // ✅ CORRECTION: utiliser { id: null } au lieu de null
      },
      relations: [
        'author',
        'replies',
        'replies.author',
        'likes',
        'replies.likes',
      ],
      order: {
        createdAt: 'DESC',
        replies: {
          createdAt: 'ASC',
        },
      },
    });

    // Transformer les données pour le frontend
    return comments.map((comment) =>
      this.transformComment(comment, currentUserId),
    );
  }

  private transformComment(comment: Comment, currentUserId?: number): any {
    return {
      id: comment.id,
      content: comment.content,
      likes: comment.likes?.length || 0,
      isEdited: comment.isEdited || false,
      isLiked: currentUserId
        ? comment.likes?.some((like) => like.id === currentUserId)
        : false,
      author: {
        id: comment.author?.id || 0,
        firstName: comment.author?.firstName || 'Utilisateur',
        lastName: comment.author?.lastName || 'Inconnu',
        profileImage: comment.author?.profileImage || null,
      },
      parentId: comment.parent?.id || null,
      createdAt: comment.createdAt,
      replies:
        comment.replies?.map((reply) =>
          this.transformComment(reply, currentUserId),
        ) || [],
    };
  }

  // MODIFIE toggleLike pour retourner le bon format
  async toggleLike(commentId: number, userId: number) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['likes'],
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const alreadyLiked = comment.likes.some((like) => like.id === user.id);

    if (alreadyLiked) {
      comment.likes = comment.likes.filter((like) => like.id !== user.id);
    } else {
      comment.likes = [...comment.likes, user];
    }

    await this.commentRepository.save(comment);

    return {
      id: comment.id,
      likes: comment.likes.length,
      isLiked: !alreadyLiked, // Inverse le statut
    };
  }

  async update(
    commentId: number,
    content: string,
    userId: number,
  ): Promise<Comment> {
    // Récupérer l'utilisateur
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['author'],
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    if (comment.author.id !== user.id) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier ce commentaire',
      );
    }

    comment.content = content;
    comment.isEdited = true;
    comment.updatedAt = new Date();

    const savedComment = await this.commentRepository.save(comment);

    return await this.commentRepository.findOneOrFail({
      where: { id: savedComment.id },
      relations: ['author', 'mentionedUsers', 'likes', 'replies'],
    });
  }

  async remove(commentId: number, userId: number): Promise<void> {
    // Récupérer l'utilisateur
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['author', 'replies'],
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    // Vérifier les permissions (auteur ou admin)
    const isAuthor = comment.author.id === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer ce commentaire',
      );
    }

    // Si le commentaire a des réponses, marquer comme supprimé
    if (comment.replies && comment.replies.length > 0) {
      comment.content = '[Commentaire supprimé]';
      comment.deletedAt = new Date();
      await this.commentRepository.save(comment);
    } else {
      // Sinon, supprimer définitivement
      await this.commentRepository.remove(comment);
    }
  }

  async getCommentStats(
    articleId: number,
  ): Promise<{ total: number; withReplies: number }> {
    const comments = await this.commentRepository.find({
      where: { article: { id: articleId } as any },
    });

    const withReplies = comments.filter(
      (comment) => comment.replies && comment.replies.length > 0,
    ).length;

    return {
      total: comments.length,
      withReplies,
    };
  }

  /**
   * Récupérer tous les commentaires d'un utilisateur
   */
  async findByUser(userId: number): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { author: { id: userId } },
      relations: [
        'article',
        'article.author',
        'article.category',
        'article.tags',
        'article.likes',
        'article.bookmarks',
        'article.comments',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Récupérer les articles commentés par l'utilisateur (uniques)
   */
  async findCommentedArticlesByUser(userId: number) {
    // Récupérer tous les commentaires de l'utilisateur avec les articles
    const comments = await this.commentRepository.find({
      where: { author: { id: userId } },
      relations: [
        'article',
        'article.author',
        'article.category',
        'article.tags',
        'article.likes',
        'article.bookmarks',
        'article.comments',
      ],
      order: { createdAt: 'DESC' },
    });

    // Grouper par article et ajouter des métadonnées
    const articleMap = new Map();

    comments.forEach((comment) => {
      if (comment.article && !articleMap.has(comment.article.id)) {
        const article = comment.article;

        // Compter le nombre de commentaires de l'utilisateur sur cet article
        const userCommentsCount = comments.filter(
          (c) => c.article?.id === article.id,
        ).length;

        // Dernier commentaire de l'utilisateur sur cet article
        const lastUserComment = comments
          .filter((c) => c.article?.id === article.id)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0];

        articleMap.set(article.id, {
          ...article,
          userCommentsCount,
          lastCommentDate: lastUserComment?.createdAt,
          isLiked: article.likes?.some((like) => like.id === userId) || false,
          isBookmarked:
            article.bookmarks?.some((bookmark) => bookmark.id === userId) ||
            false,
          commentsCount: article.comments?.length || 0,
          likesCount: article.likes?.length || 0,
          bookmarksCount: article.bookmarks?.length || 0,
        });
      }
    });

    const articles = Array.from(articleMap.values());

    return {
      success: true,
      count: articles.length,
      articles,
    };
  }
}
