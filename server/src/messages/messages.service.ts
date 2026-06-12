import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { TicketStatus, UserRole } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketsService } from '../tickets/tickets.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { TicketMessage } from './ticket-message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(TicketMessage) private readonly messages: Repository<TicketMessage>,
    private readonly tickets: TicketsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateMessageDto, actor: any, ipAddress?: string) {
    const ticket = await this.tickets.requireVisible(dto.ticketId, actor);
    if (ticket.status === TicketStatus.Closed && actor.role !== UserRole.Admin) {
      throw new ForbiddenException('Tiket sudah closed');
    }
    const message = await this.messages.save(
      this.messages.create({
        ticketId: ticket.id,
        senderId: actor.id,
        message: dto.message,
        replyToId: dto.replyToId,
      }),
    );
    const fullMessage = await this.messages.findOneOrFail({ where: { id: message.id }, relations: { attachments: true } });

    await this.audit.record(actor.id, `Mengirim pesan pada ${ticket.ticketNumber}`, ipAddress);
    const recipientIds = new Set<number>();
    if (actor.id !== ticket.customerId) recipientIds.add(ticket.customerId);
    if (ticket.assignedTo && actor.id !== ticket.assignedTo) recipientIds.add(ticket.assignedTo);
    for (const userId of recipientIds) {
      await this.notifications.create(userId, 'Pesan baru', `Ada pesan baru pada ${ticket.ticketNumber}.`, ticket.id);
    }
    return fullMessage;
  }

  async list(ticketId: number, actor: any) {
    await this.tickets.requireVisible(ticketId, actor);
    return this.messages.find({
      where: { ticketId },
      relations: { attachments: true },
      order: { createdAt: 'ASC' },
    });
  }

  async requireMessage(ticketId: number, messageId: number, actor: any) {
    await this.tickets.requireVisible(ticketId, actor);
    const message = await this.messages.findOne({ where: { id: messageId, ticketId } });
    if (!message) {
      throw new NotFoundException('Pesan tidak ditemukan');
    }
    return message;
  }
}
