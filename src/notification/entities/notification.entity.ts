import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Comment as CommentEntity } from '../../comment/entities/comment.entity';

export enum NotificationType {
  MENTION = 'mention',
  REPLY = 'reply',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean;

  @ManyToOne(() => User)
  recipient: User;

  @ManyToOne(() => User)
  sender: User;

  @ManyToOne(() => CommentEntity, { onDelete: 'CASCADE' })
  comment: CommentEntity;

  @CreateDateColumn()
  createdAt: Date;
}