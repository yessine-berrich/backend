export enum userRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  PENDING = 'pending',
  // ARCHIVED = 'archived',
  REJECTED = 'rejected',
}

export enum NotificationType {
  MENTION = 'mention',
  REPLY = 'reply',
  NEW_COMMENT = 'new_comment',
  SYSTEM_ERROR = 'system_error',
  ARTICLE_PUBLISHED = 'article_published',
  ARTICLE_PENDING_MODERATION = 'article_pending_moderation',
  ARTICLE_REJECTED = 'article_rejected',
  SYSTEM_INFO = 'system_info',
  COMMENT_LIKED = 'comment_liked',
  ARTICLE_LIKED = 'article_liked',
  ARTICLE_BOOKMARKED = 'article_bookmarked',
}