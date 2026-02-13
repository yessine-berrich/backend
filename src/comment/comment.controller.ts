import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Delete, 
  UseGuards, 
  Patch,
  ParseIntPipe,
  BadRequestException 
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { AuthGuard } from 'src/users/guards/auth.guard';
import { CurrentPayload } from 'src/users/decorators/current-payload.decorator';
import type { JwtPayloadType } from 'utils/types';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('api/comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentPayload() payload: JwtPayloadType
  ) {
    return this.commentService.create(createCommentDto, payload.sub);
  }

  @Get('article/:articleId')
  findAllByArticle(@Param('articleId', ParseIntPipe) articleId: number) {
    return this.commentService.findByArticle(articleId);
  }

  @Get('article/:articleId/stats')
  getArticleCommentStats(@Param('articleId', ParseIntPipe) articleId: number) {
    return this.commentService.getCommentStats(articleId);
  }

  @Post(':id/like')
  @UseGuards(AuthGuard)
  toggleLike(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPayload() payload: JwtPayloadType
  ) {
    return this.commentService.toggleLike(id, payload.sub);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto,
    @CurrentPayload() payload: JwtPayloadType
  ) {
    // Assurez-vous que content existe
    if (!updateCommentDto.content) {
      throw new BadRequestException('Le contenu du commentaire est requis');
    }
    return this.commentService.update(id, updateCommentDto.content, payload.sub);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPayload() payload: JwtPayloadType
  ) {
    return this.commentService.remove(id, payload.sub);
  }

  // /home/pfe2026/Desktop/PfeProject/backend/src/comment/comment.controller.ts

// AJOUTEZ CES ENDPOINTS:

/**
 * Récupérer tous les commentaires de l'utilisateur connecté
 */
@Get('user')
@UseGuards(AuthGuard)
async getUserComments(@CurrentPayload() payload: JwtPayloadType) {
  return this.commentService.findByUser(payload.sub);
}

/**
 * Récupérer les articles commentés par l'utilisateur
 */
@Get('user/articles')
@UseGuards(AuthGuard)
async getUserCommentedArticles(@CurrentPayload() payload: JwtPayloadType) {
  return this.commentService.findCommentedArticlesByUser(payload.sub);
}
}