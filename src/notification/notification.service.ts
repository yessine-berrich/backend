import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { NotificationType } from 'utils/constants';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,

    private notificationGateway: NotificationGateway,
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

  const notification = new Notification();
  notification.type = type;
  notification.recipient = recipientUser;
  notification.sender = sender ?? undefined;          // ← correction clé
  notification.message = message;
  notification.data = data;
  notification.isRead = false;

  const saved = await this.notificationRepository.save(notification);

  const payload = this.formatForFrontend(saved);
  this.notificationGateway.sendToUser(recipientUser.id, payload);

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
}