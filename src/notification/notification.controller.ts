import { Controller, DefaultValuePipe, Get, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentPayload } from 'src/users/decorators/current-payload.decorator';
import { AuthGuard } from 'src/users/guards/auth.guard';
import type { JwtPayloadType } from 'utils/types';
import { NotificationService } from './notification.service';
import { Roles } from 'src/users/decorators/user-role.decorator';
import { userRole } from 'utils/constants';

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // GET /api/notifications
  @Get()
  @UseGuards(AuthGuard)
  async getNotifications(
    @CurrentPayload() payload: JwtPayloadType,
    @Query('limit') limit = 20,
    @Query('unreadOnly') unreadOnly = false,
  ) {
    return this.notificationService.findForUser(
      payload.sub,
      +limit,
      unreadOnly === 'true',
    );
  }

  // PATCH /api/notifications/mark-all-read (optionnel)
  @Patch('mark-all-read')
  @UseGuards(AuthGuard)
  async markAllAsRead(@CurrentPayload() payload: JwtPayloadType) {
    // À implémenter dans le service si besoin
    await this.notificationService.markAllAsRead(payload.sub);
    return { success: true };
  }
}
