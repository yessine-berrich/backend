import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from 'src/mail/mail.module';
import { NotificationModule } from 'src/notification/notification.module';
@Module({
  imports: [
    MailModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        // secret: configService.get<string>('JWT_SECRET'), // 👈 Le secret est lu ici
        secret: 'testestseste', // 👈 Le secret est lu ici
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
    NotificationModule,
  ],
  providers: [UsersService, AuthService],
  controllers: [UsersController],
  exports: [UsersService, AuthService, JwtModule],
})
export class UsersModule {}