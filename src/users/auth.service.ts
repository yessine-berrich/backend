import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayloadType } from 'utils/types';
import { userRole } from 'utils/constants';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Create new user
   * @param registerDto data for creating new user
   * @returns a success message
   */
  public async register(registerDto: CreateUserDto) {
    const { email, password, firstName, lastName } = registerDto;

    const userFromDb = await this.userRepository.findOne({ where: { email } });
    if (userFromDb) throw new BadRequestException('user already exist');

    const hashedPassword = await this.hashPassword(password);

    let newUser = this.userRepository.create({
      email,
      firstName,
      lastName,
      password: hashedPassword,
      verificationToken: randomBytes(32).toString('hex'),
      role: userRole.EMPLOYEE,
      isActive: false,
      status: false,
    });

    newUser = await this.userRepository.save(newUser);
    const link = this.generateLink(newUser.id, newUser.verificationToken);

    await this.mailService.sendVerifyEmailTemplate(email, link);

    return {
      message:
        'Verification token has been sent to your email, please verify your email address',
    };
  }

  /**
   * Log In user
   * @param loginDto data for log in to user account
   * @returns JWT (access token)
   */
  public async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new BadRequestException('invalid email or password');

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch)
      throw new BadRequestException('invalid email or password');

    if (!user.isActive) {
      let verificationToken = user.verificationToken;

      if (!verificationToken) {
        user.verificationToken = randomBytes(32).toString('hex');
        const result = await this.userRepository.save(user);
        verificationToken = result.verificationToken;
      }

      const link = this.generateLink(user.id, verificationToken);
      await this.mailService.sendVerifyEmailTemplate(email, link);

      return {
        message:
          'Verification token has been sent to your email, please verify your email address',
      };
    }

    if (!user.status) {
      throw new BadRequestException(
        'Your account has not been approved by an administrator yet. Please wait for approval.'
      );
    }

    const accessToken = await this.generateJWT({
      sub: user.id,
      role: user.role,
    });
    return { accessToken };
  }

  /**
   *  Sending reset password link to the client
   */
  public async sendResetPasswordLink(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user)
      throw new BadRequestException('user with given email does not exist');

    user.resetPasswordToken = randomBytes(32).toString('hex');
    const result = await this.userRepository.save(user);

    const resetPasswordLink = `${this.config.get<string>('CLIENT_DOMAIN')}/reset-password/${user.id}/${result.resetPasswordToken}`;
    await this.mailService.sendResetPasswordTemplate(email, resetPasswordLink);

    return {
      message:
        'Password reset link sent to your email, please check your inbox',
    };
  }

  /**
   * Get reset password link
   */
  public async getResetPasswordLink(
    userId: number,
    resetPasswordToken: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('invalid link');

    if (
      user.resetPasswordToken === null ||
      user.resetPasswordToken !== resetPasswordToken
    )
      throw new BadRequestException('invalid link');

    return { message: 'valid link' };
  }

  /**
   *  Reset the password
   */
  public async resetPassword(dto: ResetPasswordDto) {
    const { userId, resetPasswordToken, newPassword } = dto;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('invalid link');

    if (
      user.resetPasswordToken === null ||
      user.resetPasswordToken !== resetPasswordToken
    )
      throw new BadRequestException('invalid link');

    const hashedPassword = await this.hashPassword(newPassword);
    user.password = hashedPassword;
    user.resetPasswordToken = '';
    await this.userRepository.save(user);

    return { message: 'password reset successfully, please log in' };
  }

  /**
   * Hashing password
   * @param password plain text password
   * @returns hashed password
   */
  public async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Generate Json Web Token
   * @param payload JWT payload
   * @returns token
   */
  private generateJWT(payload: JwtPayloadType): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  /**
   *  Generate email verification link
   */
  private generateLink(userId: number, verificationToken: string) {
    return `${this.config.get<string>('DOMAIN')}/api/users/verify-email/${userId}/${verificationToken}`;
  }

  /**
   * Active un compte utilisateur (par un administrateur)
   */
  public async activateUser(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.status === true) {
      throw new BadRequestException('User is already activated');
    }

    user.status = true;
    await this.userRepository.save(user);

    // Optionnel : envoyer un email de notification
    // await this.mailService.sendAccountApprovedEmail(user.email);

    return { message: 'User account has been activated successfully' };
  }

  /**
   * Désactive un compte utilisateur (par un administrateur)
   */
  public async deactivateUser(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.status === false) {
      throw new BadRequestException('User is already deactivated');
    }

    user.status = false;
    await this.userRepository.save(user);

    // Optionnel : envoyer un email d'explication
    // await this.mailService.sendAccountDeactivatedEmail(user.email);

    return { message: 'User account has been deactivated' };
  }

  /**
   * Change le rôle d'un utilisateur (réservé aux administrateurs)
   * @param adminId ID de l'admin qui effectue l'action (pour logging/audit futur)
   * @param targetUserId ID de l'utilisateur dont on change le rôle
   * @param newRole Le nouveau rôle à attribuer
   */
  public async changeUserRole(
    adminId: number,
    targetUserId: number,
    newRole: userRole,
  ): Promise<{ message: string }> {
    // 1. Vérifier que l'utilisateur cible existe
    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    // 2. Vérifier que le rôle demandé est valide
    if (!Object.values(userRole).includes(newRole)) {
      throw new BadRequestException(`Rôle invalide. Valeurs possibles : ${Object.values(userRole).join(', ')}`);
    }

    // 3. (Optionnel) Empêcher de modifier son propre rôle si on veut plus de sécurité
    if (adminId === targetUserId) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre rôle');
    }

    // 4. (Optionnel) Empêcher de rétrograder le dernier admin (sécurité minimale)
    if (newRole !== userRole.ADMIN && user.role === userRole.ADMIN) {
      const adminCount = await this.userRepository.count({
        where: { role: userRole.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          'Impossible de retirer le rôle ADMIN : il doit rester au moins un administrateur',
        );
      }
    }

    // 5. Appliquer le changement
    user.role = newRole;
    await this.userRepository.save(user);

    // Optionnel : logger l'action ou envoyer une notification
    // await this.notificationService.createAdminActionLog(adminId, targetUserId, `Changement de rôle → ${newRole}`);

    return {
      message: `Le rôle de l'utilisateur a été modifié avec succès : ${newRole}`,
    };
  }
}
