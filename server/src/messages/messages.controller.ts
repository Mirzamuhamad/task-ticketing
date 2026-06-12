import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService, private readonly realtime: NotificationsGateway) {}

  @Get('ticket/:ticketId')
  list(@Param('ticketId') ticketId: string, @CurrentUser() user: any) {
    return this.messages.list(Number(ticketId), user);
  }

  @Post()
  async create(@Body() dto: CreateMessageDto, @CurrentUser() user: any, @Req() req: any) {
    const message = await this.messages.create(dto, user, req.ip);
    this.realtime.emitToTicket(dto.ticketId, 'message:new', message);
    return message;
  }
}
