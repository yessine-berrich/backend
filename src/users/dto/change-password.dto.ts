import { IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Le mot de passe actuel est requis' })
  currentPassword: string;

  @IsNotEmpty({ message: 'Le nouveau mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(/(?=.*[a-z])/, { message: 'Le mot de passe doit contenir au moins une lettre minuscule' })
  @Matches(/(?=.*[A-Z])/, { message: 'Le mot de passe doit contenir au moins une lettre majuscule' })
  @Matches(/(?=.*\d)/, { message: 'Le mot de passe doit contenir au moins un chiffre' })
  @Matches(/(?=.*[@$!%*?&])/, { message: 'Le mot de passe doit contenir au moins un caractère spécial' })
  newPassword: string;
}