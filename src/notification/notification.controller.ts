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
@Get()
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  async getNotifications(
    @CurrentPayload() payload: JwtPayloadType,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('unreadOnly', new DefaultValuePipe(false)) unreadOnly: boolean,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    const offset = (page - 1) * limit;
    return this.notificationService.findForUser(payload.sub, limit, unreadOnly, offset);
  }

  @Patch('mark-all-read')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  async markAllAsRead(@CurrentPayload() payload: JwtPayloadType) {
    const result = await this.notificationService.markAllAsRead(payload.sub);
    return result; // { success: true, count: X }
  }
}
