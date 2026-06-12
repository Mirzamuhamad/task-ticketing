import { UnauthorizedException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { TicketsService } from '../tickets/tickets.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class MessagesGateway {
  constructor(
    private readonly messages: MessagesService,
    private readonly tickets: TicketsService,
    private readonly realtime: NotificationsGateway,
  ) {}

  @SubscribeMessage('ticket:join')
  async joinTicket(@ConnectedSocket() client: Socket, @MessageBody() ticketId: number) {
    if (!client.data.user) {
      throw new UnauthorizedException('Socket belum terautentikasi');
    }
    const id = Number(ticketId);
    await this.tickets.requireVisible(id, client.data.user);
    client.join(`ticket:${id}`);
    return { joined: id };
  }

  @SubscribeMessage('message:send')
  async send(@ConnectedSocket() client: Socket, @MessageBody() dto: CreateMessageDto) {
    const actor = client.data.user;
    if (!actor) {
      throw new UnauthorizedException('Socket belum terautentikasi');
    }
    const message = await this.messages.create(dto, actor, client.handshake.address);
    this.realtime.emitToTicket(dto.ticketId, 'message:new', message);
    return message;
  }
}
