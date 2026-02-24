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
  USER_ROLE_CHANGED = 'user_role_changed',
  COMMENT_ON_ARTICLE = 'comment_on_article',
  LIKE_ON_ARTICLE = 'like_on_article',
  NEW_FOLLOWER = 'new_follower',
  NEWSLETTER = 'newsletter',
  PLATFORM_UPDATE = 'platform_update'
}