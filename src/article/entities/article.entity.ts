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

export enum ArticleStatus {
  DRAFT = 'draft',
  PENDING = 'pending', // Correction, 'pending' ou 'draft' selon tes besoins
  PUBLISHED = 'published',
}

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string; // Stockera le Markdown (avec URLs d'images)

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

  @ManyToMany(() => Tag, (tag) => tag.articles) // Ajoute (tag) => tag.articles ici
  @JoinTable({ name: 'article_tags' })
  tags: Tag[];

  @OneToMany(() => Comment, (comment) => comment.article)
  comments: Comment[];

  // NOUVEAU : Relation pour les pièces jointes (fichiers et/ou images non-intégrées au Markdown)
  @OneToMany(() => Media, (media) => media.article, { cascade: true }) // important pour sauvegarder les médias avec l'article
  media: Media[];

  @OneToMany(() => ArticleVersion, (version) => version.article)
  versions: ArticleVersion[];

  @Column({
    type: 'float4', // On trompe TypeORM temporairement
    array: true,
    nullable: true,
  })
  embedding_vector: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}