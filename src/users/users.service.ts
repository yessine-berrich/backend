import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm/browser/repository/Repository.js';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ILike, In } from 'typeorm';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcryptjs';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  async getCurrentUser(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async register(registerDto: CreateUserDto) {
    return this.authService.register(registerDto);
  }

  async login(loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find();
  }

  async getUserById(id: number): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé.`);
    }

    return user;
  }

  /**
   * Verify Email
   * @param userId id of the user from the link
   * @param verificationToken verification token from the link
   * @returns success message
   */
  public async verifyEmail(userId: number, verificationToken: string) {
    const user = await this.getCurrentUser(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.verificationToken === null) {
      throw new NotFoundException('There is no verification token');
    }

    if (user.verificationToken !== verificationToken) {
      throw new BadRequestException('Invalid link');
    }

    user.isActive = true;

    user.verificationToken = null as any;

    await this.userRepository.save(user);
    return {
      message: 'Your email has been verified, please log in to your account',
    };
  }

  /**
   * Sending reset password template
   * @param email email of the user
   * @returns a success message
   */
  public sendResetPassword(email: string) {
    return this.authService.sendResetPasswordLink(email);
  }

  /**
   * Get reset password link
   * @param userId user id from the link
   * @param resetPasswordToken reset password token from the link
   * @returns a success message
   */
  public getResetPassword(userId: number, resetPasswordToken: string) {
    return this.authService.getResetPasswordLink(userId, resetPasswordToken);
  }

  /**
   * Reset the password
   * @param dto data for reset the password
   * @returns a success message
   */
  public resetPassword(dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * Trouve les utilisateurs correspondant aux mentions @FirstNameLastName
   */
  async findByNames(
    mentions: { firstName: string; lastName: string }[],
  ): Promise<User[]> {
    if (mentions.length === 0) return [];

    const query = this.userRepository.createQueryBuilder('user');

    // On boucle sur chaque mention pour construire la clause WHERE
    mentions.forEach((mention, index) => {
      const firstParam = `first${index}`;
      const lastParam = `last${index}`;

      // Condition : le prénom ET le nom doivent correspondre
      const condition = `(user.firstName = :${firstParam} AND user.lastName = :${lastParam})`;

      if (index === 0) {
        query.where(condition, {
          [firstParam]: mention.firstName,
          [lastParam]: mention.lastName,
        });
      } else {
        query.orWhere(condition, {
          [firstParam]: mention.firstName,
          [lastParam]: mention.lastName,
        });
      }
    });

    return await query.getMany();
  }

  /**
   * Mettre à jour un utilisateur
   */
  async update(id: number, updateUserDto: any): Promise<User> {
    // 1. On cherche l'utilisateur
    const user = await this.userRepository.preload({
      id: id,
      ...updateUserDto,
    });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    // 2. On sauvegarde les modifications (incluant profileImage)
    return this.userRepository.save(user);
  }

  /**
   * Supprimer un utilisateur
   */
  async remove(id: number): Promise<{ message: string }> {
    const user = await this.getUserById(id);

    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé.`);
    }

    await this.userRepository.remove(user);
    return {
      message: `L'utilisateur avec l'ID ${id} a été supprimé avec succès.`,
    };
  }

  async searchUsers(query: string) {
    if (!query || query.length < 2) return [];

    return await this.userRepository.find({
      where: [
        // On force le type à 'any' pour bypasser le conflit Browser/Node
        { firstName: ILike(`${query}%`) as any },
        { lastName: ILike(`${query}%`) as any }
      ],
      select: ['id', 'firstName', 'lastName'],
      take: 5,
    });
  }
  //crate bay bader *****************************************************************************************

    async changePassword(userId: number, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier l'ancien mot de passe
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    user.password = hashedPassword;
    await this.userRepository.save(user);

    return { message: 'Mot de passe modifié avec succès' };
  }
}
