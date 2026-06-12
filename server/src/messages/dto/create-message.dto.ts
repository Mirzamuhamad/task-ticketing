import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsInt()
  ticketId: number;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsInt()
  replyToId?: number;
}
