import { Article } from 'src/article/entities/article.entity';
import { Comment } from 'src/comment/entities/comment.entity';
import { Notification } from 'src/notification/entities/notification.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { userRole } from 'utils/constants';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ nullable: true })
  facebook: string;

  @Column({ nullable: true })
  twitter: string;

  @Column({ nullable: true })
  linkedin: string;

  @Column({ nullable: true })
  instagram: string;

  @Column({ nullable: true })
  profileImage: string; // Stockera l'URL de l'image (ex: /uploads/avatar.jpg)

  @Column({ type: 'enum', enum: userRole })
  role: userRole;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  status: boolean; // true = compte validé par admin, false = en attente / bloqué

  @Column({ nullable: true })
  verificationToken: string;

  @Column({ nullable: true })
  resetPasswordToken: string;

  @Column({ default: true })
  emailNotificationsEnabled: boolean; // global toggle email

  @Column({ default: true })
  emailOnComment: boolean; // Commentaires sur mes articles

  @Column({ default: false })
  emailOnLike: boolean; // Likes sur mes articles

  @Column({ default: true })
  emailOnNewFollower: boolean; // Nouveaux abonnés

  @Column({ default: false })
  emailNewsletter: boolean; // Newsletter / Actualités plateforme

  // Préférences notifications PUSH (in-app + navigateur/app mobile)
  @Column({ default: true })
  pushNotificationsEnabled: boolean;

  @OneToMany(() => Article, (article) => article.author)
  articles: Article[];

  @OneToMany(() => Comment, (comment) => comment.author)
  comments: Comment[];

  @ManyToMany(() => Comment, (comment) => comment.likes)
  likedComments: Comment[];

  @ManyToMany(() => Article, (article) => article.likes)
  likedArticles: Article[];

  @ManyToMany(() => Article, (article) => article.bookmarks)
  bookmarkedArticles: Article[];

  @OneToMany(() => Notification, (notification) => notification.recipient)
  notifications: Notification[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
