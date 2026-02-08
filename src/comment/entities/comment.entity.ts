import { Article } from 'src/article/entities/article.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  // Indique si le commentaire a été modifié (optionnel mais utile)
  @Column({ default: false })
  isEdited: boolean;

  @ManyToOne(() => Article, (article) => article.comments, {
    onDelete: 'CASCADE',
  })
  article: Article;

  @ManyToOne(() => User, (user) => user.comments, { eager: true }) // On charge souvent l'auteur par défaut
  author: User;

  // --- Système de réponse ---
  @ManyToOne(() => Comment, (comment) => comment.replies, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  parent: Comment;

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies: Comment[];

  // --- Mentions ---
  @ManyToMany(() => User)
  @JoinTable({ name: 'comment_mentions' })
  mentionedUsers: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Optionnel : Pour ne pas perdre le fil de discussion si le parent supprime
  @DeleteDateColumn()
  deletedAt: Date;
}
