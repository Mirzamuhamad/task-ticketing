import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketsModule } from '../tickets/tickets.module';
import { TicketMessage } from './ticket-message.entity';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';

@Module({
  imports: [TypeOrmModule.forFeature([TicketMessage]), TicketsModule, AuditModule, NotificationsModule],
  controllers: [MessagesController],
  providers: [MessagesGateway, MessagesService],
  exports: [MessagesService, TypeOrmModule],
})
export class MessagesModule {}
