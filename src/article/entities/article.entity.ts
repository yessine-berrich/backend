import { Category } from 'src/category/entities/category.entity';
import { Tag } from 'src/tag/entities/tag.entity';
import { User } from 'src/users/entities/user.entity';
import { Comment } from 'src/comment/entities/comment.entity';
import { Media } from 'src/media/entities/media.entity'; // Importe l'entité Media

import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { ArticleVersion } from './article-version.entity';
import { ArticleStatus } from 'utils/constants';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: ArticleStatus,
    default: ArticleStatus.DRAFT,
  })
  status: ArticleStatus;

  @Column({ default: 0 })
  viewsCount: number;

  @ManyToOne(() => User, (user) => user.articles)
  author: User;

  @ManyToOne(() => Category, (category) => category.articles)
  category: Category;

  @ManyToMany(() => Tag, (tag) => tag.articles)
  @JoinTable({ name: 'article_tags' })
  tags: Tag[];

  @OneToMany(() => Comment, (comment) => comment.article)
  comments: Comment[];

  @OneToMany(() => Media, (media) => media.article, { cascade: true })
  media: Media[];

  @ManyToMany(() => User, (user) => user.likedArticles)
  @JoinTable({ name: 'article_likes' })
  likes: User[];

  @ManyToMany(() => User, (user) => user.bookmarkedArticles)
  @JoinTable({ name: 'article_bookmarks' })
  bookmarks: User[];

  @OneToMany(() => ArticleVersion, (version) => version.article, {
    cascade: false,
  })
  versions: ArticleVersion[];

  @Column({ nullable: true })
  currentVersionNumber?: number;

  @Column({
    type: 'float4',
    array: true,
    nullable: true,
  })
  embedding_vector: number[];

  @Column({ type: 'jsonb', nullable: true })
  moderationResult?: {
    isFlagged: boolean;
    score: number; // 0.0 à 1.0
    categories: string[];
    reason?: string;
    confidence: number;
    model: string;
    moderatedAt: Date;
  };

  @Column({ default: false })
  isAutoModerated: boolean;

  @Column({ nullable: true })
  moderationScore?: number;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
