import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Article } from './article.entity';
import { User } from 'src/users/entities/user.entity';

@Entity('article_versions')
@Index('idx_article_versions_article_id', ['articleId'])
@Index('idx_article_versions_article_version', ['articleId', 'versionNumber'], {
  unique: true,
})
export class ArticleVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Article, (article) => article.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column()
  articleId: number;

  @Column()
  versionNumber: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'author_id' })
  author?: User;

  @Column({ nullable: true })
  authorId?: number;

  @Column({
    type: 'enum',
    enum: ['draft', 'pending', 'published', 'rejected'],
    default: 'draft',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  changeSummary?: string;

  // Snapshot léger des relations (optionnel mais très utile)
  @Column({ type: 'jsonb', nullable: true })
  categorySnapshot?: { id: number; name: string };

  @Column({ type: 'jsonb', nullable: true })
  tagsSnapshot?: Array<{ id: number; name: string }>;

  @CreateDateColumn()
  createdAt: Date;
}
