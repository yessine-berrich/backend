import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { NotificationType } from 'utils/constants';
import { NotificationGateway } from './notification.gateway';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,

    private notificationGateway: NotificationGateway,
    private readonly mailService: MailService,
  ) {}

  async createAndNotify(
    type: NotificationType,
    recipient: User | number,
    sender: User | null,
    message?: string,
    data?: Record<string, any>,
  ): Promise<Notification | null> {
    let recipientUser: User | null = null;

    if (typeof recipient === 'number') {
      recipientUser = await this.getUserById(recipient);
    } else {
      recipientUser = recipient;
    }

    if (!recipientUser) {
      console.warn('Destinataire introuvable');
      return null;
    }

    // ─── Vérification push (in-app via websocket) ───
    const sendPush = await this.shouldSendPush(recipientUser.id);

    // Créer la notification en base (toujours, car elle peut être vue dans l'interface)
    const notification = this.notificationRepository.create({
      type,
      recipient: recipientUser,
      sender: sender ?? undefined,
      message,
      data,
      isRead: false,
    });

    const saved = await this.notificationRepository.save(notification);

    // ─── Envoi push/websocket SI autorisé ───
    if (sendPush) {
      const payload = this.formatForFrontend(saved);
      this.notificationGateway.sendToUser(recipientUser.id, payload);
    }

    // ─── Envoi email SI autorisé ───
    const sendEmail = await this.shouldSendEmail(recipientUser.id, type);
    if (sendEmail && this.mailService) { // suppose que tu injectes MailService
      await this.mailService.sendNotificationEmail(
        recipientUser.email,
        type,
        message,
        data,
        sender,
      );
    }
    return saved;
  }

  private async getUserById(id: number): Promise<User | null> {
    return this.notificationRepository.manager
      .getRepository(User)
      .findOne({ where: { id } });
  }

  private formatForFrontend(notif: Notification) {
    return {
      id: notif.id,
      type: notif.type,
      isRead: notif.isRead,
      createdAt: notif.createdAt,
      message: notif.message,
      sender: notif.sender
        ? {
            id: notif.sender.id,
            name: `${notif.sender.firstName || ''} ${notif.sender.lastName || ''}`.trim(),
            avatar: notif.sender.profileImage,
          }
        : null,
      data: notif.data || {},
    };
  }

  /**
   * Récupère les notifications destinées à un utilisateur
   * @param userId ID de l'utilisateur destinataire
   * @param limit Nombre maximum de résultats (défaut 30)
   * @param unreadOnly Si true, ne retourne que les non lues
   * @param offset Pour la pagination (optionnel)
   */
  async findForUser(
    userId: number,
    limit: number = 30,
    unreadOnly: boolean = false,
    offset: number = 0,
  ): Promise<Notification[]> {
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      // Jointure sender avec sélection minimale (optimisation)
      .leftJoinAndSelect('n.sender', 'sender')
      .addSelect([
        'sender.id',
        'sender.firstName',
        'sender.lastName',
        'sender.profileImage',
      ])
      .where('n.recipientId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    // Filtre non lues si demandé
    if (unreadOnly) {
      qb.andWhere('n.isRead = :isRead', { isRead: false });
    }

    // Charger les relations utiles sans tout charger
    qb.leftJoinAndSelect('n.recipient', 'recipient', 'recipient.id = :userId', { userId });

    const notifications = await qb.getMany();

    return notifications;
  }

  async markAsRead(notificationId: number, userId: number) {
    const notif = await this.notificationRepository.findOne({
      where: { id: notificationId, recipient: { id: userId } },
    });

    if (!notif) throw new Error('Notification non trouvée');

    notif.isRead = true;
    await this.notificationRepository.save(notif);

    return { success: true };
  }

  async markAllAsRead(userId: number): Promise<{ success: boolean; count: number }> {
    const unreadCount = await this.notificationRepository.count({
      where: {
        recipient: { id: userId },
        isRead: false,
      },
    });

    if (unreadCount === 0) {
      return { success: true, count: 0 };
    }

    await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('recipientId = :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    return { success: true, count: unreadCount };
  }

  /**
   * Vérifie si l'utilisateur souhaite recevoir cette notification par email
   */
  async shouldSendEmail(recipientId: number, type: NotificationType): Promise<boolean> {
    const user = await this.notificationRepository.manager
      .getRepository(User)
      .findOne({
        where: { id: recipientId },
        select: [
          'emailNotificationsEnabled',
          'emailOnComment',
          'emailOnLike',
          'emailOnNewFollower',
          'emailNewsletter',
        ],
      });

    if (!user || !user.emailNotificationsEnabled) {
      return false;
    }

    switch (type) {
      case NotificationType.COMMENT_ON_ARTICLE:
        return user.emailOnComment;
      case NotificationType.LIKE_ON_ARTICLE:
        return user.emailOnLike;
      case NotificationType.NEW_FOLLOWER:
        return user.emailOnNewFollower;
      case NotificationType.NEWSLETTER:
        return user.emailNewsletter;
      // Ajoute d'autres types selon tes NotificationType
      default:
        return true; // par défaut on envoie si global est activé
    }
  }

  /**
   * Vérifie si on doit envoyer une notification push/in-app
   * (plus simple car souvent moins granulaire)
   */
  async shouldSendPush(recipientId: number): Promise<boolean> {
    const user = await this.notificationRepository.manager
      .getRepository(User)
      .findOne({
        where: { id: recipientId },
        select: ['pushNotificationsEnabled'],
      });

    return !!user?.pushNotificationsEnabled;
  }
}