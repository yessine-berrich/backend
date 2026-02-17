import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationType } from 'utils/constants';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'text', nullable: true })
  message?: string;               // ← texte court affiché (ex: "Yessine a répondu à votre commentaire")

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;     // ← payload flexible (articleId, commentId, etc.)

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  recipient: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  sender?: User;                  // peut être null si système

  @CreateDateColumn()
  createdAt: Date;
}