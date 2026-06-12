import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketPriority } from '../../common/enums';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @IsInt()
  categoryId: number;

  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsString()
  @IsNotEmpty()
  description: string;
}
