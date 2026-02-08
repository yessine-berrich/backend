import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
// Utilisation d'alias pour éviter les conflits avec les types globaux du navigateur
import { Comment as CommentEntity } from './entities/comment.entity';
import { User } from '../users/entities/user.entity';
import { 
  Notification as NotificationEntity, 
  NotificationType 
} from '../notification/entities/notification.entity';
import { NotificationGateway } from '../notification/notification.gateway';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(CommentEntity)
    private readonly commentRepository: Repository<CommentEntity>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,

    private readonly notificationGateway: NotificationGateway,
  ) {}

  async create(createCommentDto: any, author: User) {
    const { content, articleId, parentId } = createCommentDto;

    // 1. Création et sauvegarde du commentaire
    const comment = this.commentRepository.create({
      content,
      author,
      article: { id: articleId },
      parent: parentId ? { id: parentId } : undefined,
    });

    // Extraction des mentions (ex: @Jean)
    const firstNames = this.extractFirstNames(content);
    if (firstNames.length > 0) {
      comment.mentionedUsers = await this.userRepository.findBy({
        firstName: In(firstNames),
      });
    }

    const savedComment = await this.commentRepository.save(comment);

    // 2. Préparation des notifications
    const newNotifications: Partial<NotificationEntity>[] = [];

    // Cas A : C'est une réponse à un autre commentaire
    if (parentId) {
      const parentComment = await this.commentRepository.findOne({
        where: { id: parentId },
        relations: ['author'],
      });

      if (parentComment?.author && parentComment.author.id !== author.id) {
        newNotifications.push({
          type: NotificationType.REPLY,
          recipient: parentComment.author,
          sender: author,
          comment: savedComment,
        });
      }
    }

    // Cas B : Des utilisateurs ont été mentionnés
    if (savedComment.mentionedUsers?.length > 0) {
      savedComment.mentionedUsers.forEach((user) => {
        // On ne notifie pas l'auteur s'il se mentionne lui-même
        if (user.id !== author.id) {
          newNotifications.push({
            type: NotificationType.MENTION,
            recipient: user,
            sender: author,
            comment: savedComment,
          });
        }
      });
    }

    // 3. Sauvegarde et Envoi Temps Réel (WebSockets)
    if (newNotifications.length > 0) {
      const savedNotifications = await this.notificationRepository.save(newNotifications);
      
      savedNotifications.forEach((notif) => {
        // On renvoie un objet propre au frontend via Socket.io
        this.notificationGateway.sendNotification(notif.recipient.id, {
          id: notif.id,
          type: notif.type,
          senderName: `${author.firstName} ${author.lastName || ''}`,
          commentId: savedComment.id,
          message: notif.type === NotificationType.MENTION 
            ? 'vous a mentionné dans un commentaire' 
            : 'a répondu à votre commentaire',
          createdAt: notif.createdAt,
        });
      });
    }

    return savedComment;
  }

  private extractFirstNames(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex);
    if (!matches) return [];
    // Nettoyage : on enlève le '@' et on supprime les doublons
    return [...new Set(matches.map((match) => match.substring(1)))];
  }

  async findByArticle(articleId: number) {
    return this.commentRepository.find({
      where: {
        article: { id: articleId },
        parent: IsNull(), // On ne récupère que les commentaires parents au premier niveau
      },
      relations: ['author', 'replies', 'replies.author', 'mentionedUsers'],
      order: { createdAt: 'DESC' },
    });
  }
}