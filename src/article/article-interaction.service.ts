// src/article/services/article-interaction.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Article } from './entities/article.entity';
import { NotificationType } from 'utils/constants';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class ArticleInteractionService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly notificationService: NotificationService,
  ) {}

  async toggleLike(articleId: number, userId: number): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['likes', 'author', 'category'],
    });

    if (!article) {
      throw new NotFoundException('Article non trouvé');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const alreadyLiked = article.likes.some((like) => like.id === user.id);

    if (alreadyLiked) {
      article.likes = article.likes.filter((like) => like.id !== user.id);
    } else {
      article.likes = [...article.likes, user];

      if (article.author.id !== userId) {
        await this.notificationService.createAndNotify(
          NotificationType.ARTICLE_LIKED,
          article.author.id,
          user,
          `${user.firstName} a aimé votre article "${article.title}"`,
          {
            articleId: article.id,
          },
        );
      }
    }

    const savedArticle = await this.articleRepository.save(article);

    return await this.articleRepository.findOneOrFail({
      where: { id: savedArticle.id },
      relations: ['likes', 'bookmarks', 'author', 'category', 'tags'],
    });
  }

  async toggleBookmark(articleId: number, userId: number): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['bookmarks', 'author', 'category'],
    });

    if (!article) {
      throw new NotFoundException('Article non trouvé');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const alreadyBookmarked = article.bookmarks.some(
      (bookmark) => bookmark.id === user.id,
    );

    if (alreadyBookmarked) {
      article.bookmarks = article.bookmarks.filter(
        (bookmark) => bookmark.id !== user.id,
      );
    } else {
      article.bookmarks = [...article.bookmarks, user];

      if (article.author.id !== userId) {
        await this.notificationService.createAndNotify(
          NotificationType.ARTICLE_BOOKMARKED,
          article.author.id, // destinataire = auteur
          user, // expéditeur
          `${user.firstName} a mis votre article "${article.title}" en favori`,
          {
            articleId: article.id,
          },
        );
      }
    }

    const savedArticle = await this.articleRepository.save(article);

    return await this.articleRepository.findOneOrFail({
      where: { id: savedArticle.id },
      relations: ['likes', 'bookmarks', 'author', 'category', 'tags'],
    });
  }

  async getArticleLikesCount(articleId: number): Promise<number> {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['likes'],
    });

    if (!article) {
      throw new NotFoundException('Article non trouvé');
    }

    return article.likes.length;
  }

  async getArticleBookmarksCount(articleId: number): Promise<number> {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['bookmarks'],
    });

    if (!article) {
      throw new NotFoundException('Article non trouvé');
    }

    return article.bookmarks.length;
  }

  async isArticleLikedByUser(
    articleId: number,
    userId: number,
  ): Promise<boolean> {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['likes'],
    });

    if (!article) {
      throw new NotFoundException('Article non trouvé');
    }

    return article.likes.some((like) => like.id === userId);
  }

  async isArticleBookmarkedByUser(
    articleId: number,
    userId: number,
  ): Promise<boolean> {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['bookmarks'],
    });

    if (!article) {
      throw new NotFoundException('Article non trouvé');
    }

    return article.bookmarks.some((bookmark) => bookmark.id === userId);
  }

  async getUserLikedArticles(userId: number): Promise<Article[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        'likedArticles',
        'likedArticles.author',
        'likedArticles.category',
        'likedArticles.likes',
        'likedArticles.bookmarks',
        'likedArticles.tags',
        'likedArticles.comments',
      ],
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user.likedArticles;
  }

  async getUserBookmarkedArticles(userId: number): Promise<Article[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        'bookmarkedArticles',
        'bookmarkedArticles.author',
        'bookmarkedArticles.category',
        'bookmarkedArticles.likes',
        'bookmarkedArticles.bookmarks',
        'bookmarkedArticles.tags',
        'bookmarkedArticles.comments',
      ],
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user.bookmarkedArticles;
  }
}
