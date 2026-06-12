import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { TicketStatus } from '../../common/enums';

export class UpdateTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsInt()
  assignedTo?: number;
}
