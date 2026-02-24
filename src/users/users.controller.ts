import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  NotFoundException,
  Res,
  Query,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { Roles } from './decorators/user-role.decorator';
import { userRole } from 'utils/constants';
import { AuthGuard } from './guards/auth.guard';
import { CurrentPayload } from './decorators/current-payload.decorator';
import type { JwtPayloadType } from 'utils/types';
import { AuthRolesGuard } from './guards/auth-roles.guard';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { extname } from 'path/win32';
import { diskStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { join } from 'path';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('/auth/register')
  register(@Body() body: CreateUserDto) {
    return this.usersService.register(body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/auth/login')
  login(@Body() body: LoginDto) {
    return this.usersService.login(body);
  }

  @Get('/current-user')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  getCurrentUser(@CurrentPayload() payload: JwtPayloadType) {
    return this.usersService.getCurrentUser(payload.sub);
  }

  @Post('admin/:id/activate')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)           // ← à implémenter
  async activate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.activateUser(id);
  }

  @Post('admin/:id/deactivate')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deactivateUser(id);
  }

  @Post('admin/users/:id/role')
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  @UseGuards(AuthGuard)
  async updateRole(
    @Param('id', ParseIntPipe) userId: number,
    @Body('role') newRole: userRole,
    @CurrentPayload() payload: JwtPayloadType, // l'utilisateur connecté
  ) {
    return this.usersService.changeUserRole(payload.sub, userId, newRole);
  }

  @Patch('me/notifications-preferences')
  @UseGuards(AuthGuard)
  async updateNotificationPreferences(
    @CurrentPayload() payload: JwtPayloadType,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(payload.sub, dto);
  }

  @Get()
  @UseGuards(AuthRolesGuard)
  @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get(':id')
  // @UseGuards(AuthRolesGuard)
  // @Roles(userRole.ADMIN, userRole.EMPLOYEE)
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserById(id);
  }

  // GET: ~/api/users/verify-email/:id/:verificationToken
  @Get('verify-email/:id/:verificationToken')
  public verifyEmail(
    @Param('id', ParseIntPipe) id: number,
    @Param('verificationToken') verificationToken: string,
  ) {
    return this.usersService.verifyEmail(id, verificationToken);
  }

  // POST: ~/api/users/forgot-password
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  public forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.usersService.sendResetPassword(body.email);
  }

  // GET: ~/api/users/reset-password/:id/:resetPasswordToken
  @Get('reset-password/:id/:resetPasswordToken')
  public getResetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Param('resetPasswordToken') resetPasswordToken: string,
  ) {
    return this.usersService.getResetPassword(id, resetPasswordToken);
  }

  // POST: ~/api/users/reset-password
  @Post('reset-password')
  public resetPassword(@Body() body: ResetPasswordDto) {
    return this.usersService.resetPassword(body);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('profileImage', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `profile-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto, // Le type possède maintenant profileImage
    @UploadedFile() file: Express.Multer.File,
  ) {
    // On crée un objet de données à envoyer au service
    const updateData = { ...updateUserDto };

    if (file) {
      // L'erreur TS2339 disparaîtra ici car UpdateUserDto contient profileImage
      updateData.profileImage = `/uploads/${file.filename}`;
    }

    return this.usersService.update(+id, updateData);
  }

  @Get('profile-image/:id')
  async getProfileImage(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: any, // Utilise l'interface importée d'express
  ) {
    const user = await this.usersService.getUserById(id);

    if (!user || !user.profileImage) {
      throw new NotFoundException(
        "Cet utilisateur n'a pas de photo de profil.",
      );
    }

    // Construction du chemin. Note : On retire le slash initial de profileImage
    // s'il existe pour éviter des erreurs avec join()
    const relativePath = user.profileImage.startsWith('/')
      ? user.profileImage.substring(1)
      : user.profileImage;

    const imagePath = join(process.cwd(), relativePath);

    // Utilisation d'un callback pour gérer l'erreur si le fichier est absent du disque
    return res.sendFile(imagePath, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(404).send({
            message: 'Le fichier physique est introuvable sur le serveur.',
          });
        }
      }
    });
  }

  @Delete('admin/:id')
  @UseGuards(AuthRolesGuard)
  @Roles(userRole.ADMIN) // Seul l'ADMIN peut supprimer un compte
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @Get('search')
  async search(@Query('q') q: string) {
    return this.usersService.searchUsers(q);
  }

  @Post(':id/change-password')
  @UseGuards(AuthGuard)
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentPayload() payload: JwtPayloadType,
  ) {
    // Vérifier les droits : soit l'utilisateur lui-même, soit un admin
    const isAdmin = payload.role === userRole.ADMIN;
    if (payload.sub !== id && !isAdmin) {
      throw new ForbiddenException('Vous ne pouvez pas modifier le mot de passe d\'un autre utilisateur');
    }

    return this.usersService.changePassword(id, changePasswordDto);
  }
}




