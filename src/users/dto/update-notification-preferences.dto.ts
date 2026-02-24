import { IsBoolean, IsOptional } from "class-validator";

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnComment?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnLike?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOnNewFollower?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNewsletter?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;
}