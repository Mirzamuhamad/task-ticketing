import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService, private readonly realtime: NotificationsGateway) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.tickets.list(user);
  }

  @Get('stats')
  stats(@CurrentUser() user: any) {
    return this.tickets.stats(user);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tickets.requireVisible(Number(id), user);
  }

  @Post()
  async create(@Body() dto: CreateTicketDto, @CurrentUser() user: any, @Req() req: any) {
    const ticket = await this.tickets.create(dto, user, req.ip);
    this.realtime.emitToTicket(ticket.id, 'ticket:updated', ticket);
    this.realtime.emitToAll('ticket:changed', { ticketId: ticket.id });
    return ticket;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: any, @Req() req: any) {
    const ticket = await this.tickets.update(Number(id), dto, user, req.ip);
    this.realtime.emitToTicket(ticket.id, 'ticket:updated', ticket);
    this.realtime.emitToAll('ticket:changed', { ticketId: ticket.id });
    return ticket;
  }

  @Patch(':id/close')
  async close(@Param('id') id: string, @CurrentUser() user: any, @Req() req: any) {
    const ticket = await this.tickets.close(Number(id), user, req.ip);
    this.realtime.emitToTicket(ticket.id, 'ticket:updated', ticket);
    this.realtime.emitToAll('ticket:changed', { ticketId: ticket.id });
    return ticket;
  }
}
