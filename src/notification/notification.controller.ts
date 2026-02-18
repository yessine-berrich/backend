import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentPayload } from 'src/users/decorators/current-payload.decorator';
import { AuthGuard } from 'src/users/guards/auth.guard';
import type { JwtPayloadType } from 'utils/types';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // GET /api/notifications
}
