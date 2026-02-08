// src/notification/notification.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification as NotificationEntity } from './entities/notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  // Récupérer l'historique pour le Controller
  async findAllForUser(userId: number) {
    return await this.notificationRepository.find({
      where: { recipient: { id: userId } },
      relations: ['sender', 'comment'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  // Marquer comme lu pour le Controller
  async markAsRead(id: number) {
    await this.notificationRepository.update(id, { isRead: true });
    return { success: true };
  }

  // Cette méthode est celle que tu as déjà dans ton entité/service pour la création
  // Elle est utilisée par le CommentService
}