// src/notification/notification.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification as NotificationEntity } from './entities/notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    readonly notificationRepository: Repository<NotificationEntity>,
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
  
}