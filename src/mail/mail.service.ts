import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, RequestTimeoutException } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { NotificationType } from 'utils/constants';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  /**
   * Sending email after user logged in to his account
   * @param email logged in user email
   */
  public async sendLogInEmail(email: string) {
    try {
      const today = new Date();

      await this.mailerService.sendMail({
        to: email,
        from: `<no-reply@my-nestjs-app.com>`,
        subject: 'Log in',
        template: 'login',
        context: { email, today },
      });
    } catch (error) {
      console.log(error);
      throw new RequestTimeoutException();
    }
  }

  /**
   * Sending verify email template
   * @param email email of the registered user
   * @param link link with id of the user and verification token
   */
  public async sendVerifyEmailTemplate(email: string, link: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        from: `<no-reply@my-nestjs-app.com>`,
        subject: 'Verify your account',
        template: 'verify-email',
        context: { link },
      });
    } catch (error) {
      console.log(error);
      throw new RequestTimeoutException();
    }
  }

  /**
   * Sending reset password template
   * @param email email of the user
   * @param resetPasswordLink link with id of the user and reset password token
   */
  public async sendResetPasswordTemplate(
    email: string,
    resetPasswordLink: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to: email,
        from: `<no-reply@my-nestjs-app.com>`,
        subject: 'Reset password',
        template: 'reset-password',
        context: { resetPasswordLink },
      });
    } catch (error) {
      console.log(error);
      throw new RequestTimeoutException();
    }
  }

  /**
   * Envoie une notification par email selon le type
   * @param to Adresse email du destinataire
   * @param type Type de notification (COMMENT_ON_ARTICLE, LIKE_ON_ARTICLE, NEW_FOLLOWER, etc.)
   * @param message Texte court de la notification (optionnel)
   * @param data Données supplémentaires (ex: { articleTitle, articleSlug, commentId, ... })
   * @param sender Utilisateur qui a déclenché la notif (optionnel)
   */
  public async sendNotificationEmail(
    to: string,
    type: NotificationType,
    message?: string,
    data: Record<string, any> = {},
    sender?: User | null,
  ): Promise<void> {
    try {
      let subject = 'Notification';
      let template = 'notification-default'; // template par défaut
      let context: Record<string, any> = {
        message,
        senderName: sender
          ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() ||
            'Quelqu’un'
          : 'La plateforme',
        year: new Date().getFullYear(),
      };

      // Personnalisation selon le type de notification
      switch (type) {
        case NotificationType.COMMENT_ON_ARTICLE:
          subject = 'Nouveau commentaire sur votre article';
          template = 'notification-comment';
          context = {
            ...context,
            articleTitle: data.articleTitle || 'votre article',
            articleUrl:
              data.articleUrl || data.articleSlug
                ? `${process.env.CLIENT_DOMAIN}/articles/${data.articleSlug}`
                : '#',
            commenterName: data.commenterName || context.senderName,
            commentPreview:
              data.commentPreview || message || 'a commenté votre publication',
          };
          break;

        case NotificationType.LIKE_ON_ARTICLE:
          subject = 'Quelqu’un a aimé votre article';
          template = 'notification-like';
          context = {
            ...context,
            articleTitle: data.articleTitle || 'votre publication',
            articleUrl: data.articleUrl || '#',
            likerName: context.senderName,
          };
          break;

        case NotificationType.NEW_FOLLOWER:
          subject = 'Nouveau abonné !';
          template = 'notification-follower';
          context = {
            ...context,
            followerName: context.senderName,
            profileUrl: sender?.id
              ? `${process.env.CLIENT_DOMAIN}/profile/${sender.id}`
              : '#',
          };
          break;

        case NotificationType.NEWSLETTER:
        case NotificationType.PLATFORM_UPDATE:
          subject = 'Actualités de la plateforme';
          template = 'notification-newsletter';
          context = {
            ...context,
            title: data.title || 'Mise à jour importante',
            contentPreview: message || data.contentPreview,
            link: data.link || `${process.env.CLIENT_DOMAIN}`,
          };
          break;

        // Ajoute d’autres cas selon tes NotificationType
        // ex: ARTICLE_APPROVED, ARTICLE_REJECTED, MENTION, etc.

        default:
          // Fallback pour les types non gérés spécifiquement
          subject = `Notification - ${type}`;
          template = 'notification-default';
          break;
      }

      await this.mailerService.sendMail({
        to,
        from: `"Ma Plateforme" <no-reply@my-nestjs-app.com>`,
        subject,
        template, // ex: 'notification-comment.hbs', 'notification-like.hbs', etc.
        context,
      });
    } catch (error) {
      console.error('Erreur lors de l’envoi de la notification email:', error);
      // Ne pas bloquer l’API → on log seulement
      // throw new RequestTimeoutException(); // ← à éviter ici pour ne pas casser l’envoi de notif
    }
  }
}
