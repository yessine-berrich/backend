// src/article/dto/update-article.dto.ts
import { IsString, IsOptional, IsEnum, IsNumber, IsArray } from 'class-validator';
import { ArticleStatus } from 'utils/constants';

export class UpdateArticleDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(ArticleStatus)
  @IsOptional()
  status?: ArticleStatus;

  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  tagIds?: number[];

  @IsString()
  @IsOptional()
  changeSummary?: string;
}