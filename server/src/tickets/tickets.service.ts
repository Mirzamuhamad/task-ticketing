import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CategoriesService } from '../categories/categories.service';
import { TicketPriority, TicketStatus, UserRole } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketWorkflowLog } from './ticket-workflow-log.entity';
import { Ticket } from './ticket.entity';

const statusLabels: Record<TicketStatus, string> = {
  [TicketStatus.Open]: 'Open',
  [TicketStatus.Assigned]: 'Assigned',
  [TicketStatus.InProgress]: 'In Progress',
  [TicketStatus.WaitingCustomer]: 'Waiting Customer',
  [TicketStatus.Solved]: 'Solved',
  [TicketStatus.Closed]: 'Closed',
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketWorkflowLog) private readonly workflowLogs: Repository<TicketWorkflowLog>,
    private readonly categories: CategoriesService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateTicketDto, actor: any, ipAddress?: string) {
    await this.categories.require(dto.categoryId);
    const customerId = actor.role === UserRole.Customer ? actor.id : dto.customerId ?? actor.id;
    await this.users.require(customerId);

    const ticket = await this.tickets.save(
      this.tickets.create({
        ticketNumber: await this.nextTicketNumber(),
        title: dto.title,
        categoryId: dto.categoryId,
        customerId,
        priority: dto.priority ?? TicketPriority.Medium,
        status: TicketStatus.Open,
        description: dto.description,
      }),
    );

    await this.audit.record(actor.id, `Membuat tiket ${ticket.ticketNumber}`, ipAddress);
    await this.notifications.create(customerId, 'Tiket berhasil dibuat', `${ticket.ticketNumber} sedang menunggu support.`, ticket.id);
    return this.requireVisible(ticket.id, actor);
  }

  async list(actor: any) {
    if (actor.role === UserRole.Admin) {
      return this.tickets.find({ order: { updatedAt: 'DESC' } });
    }
    if (actor.role === UserRole.Support) {
      return this.tickets.find({
        where: [{ assignedTo: actor.id }, { assignedTo: IsNull(), status: TicketStatus.Open }],
        order: { updatedAt: 'DESC' },
      });
    }
    return this.tickets.find({ where: { customerId: actor.id }, order: { updatedAt: 'DESC' } });
  }

  async stats(actor: any) {
    const tickets = await this.list(actor);
    const byStatus = (Object.values(TicketStatus) as TicketStatus[]).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<TicketStatus, number>,
    );
    for (const ticket of tickets) {
      byStatus[ticket.status] = (byStatus[ticket.status] ?? 0) + 1;
    }
    return {
      total: tickets.length,
      byStatus,
      latest: tickets.slice(0, 6),
    };
  }

  async requireVisible(id: number, actor: any) {
    const ticket = await this.tickets.findOne({
      where: { id },
      relations: { messages: { attachments: true }, attachments: true, workflowLogs: true },
      order: { messages: { createdAt: 'ASC' }, workflowLogs: { createdAt: 'ASC' } },
    });
    if (!ticket) {
      throw new NotFoundException('Tiket tidak ditemukan');
    }
    if (!this.canAccess(ticket, actor)) {
      throw new ForbiddenException('Anda tidak memiliki akses ke tiket ini');
    }
    return ticket;
  }

  async update(id: number, dto: UpdateTicketDto, actor: any, ipAddress?: string) {
    const ticket = await this.requireVisible(id, actor);
    if (![UserRole.Admin, UserRole.Support].includes(actor.role)) {
      throw new ForbiddenException('Hanya admin atau support yang dapat mengubah tiket');
    }

    const previousStatus = ticket.status;
    const previousAssigneeName = ticket.assignee?.name ?? null;
    let assignedLog: { fromValue?: string | null; toValue?: string | null; message: string } | null = null;

    if (actor.role === UserRole.Support && !ticket.assignedTo) {
      ticket.assignedTo = actor.id;
      if (ticket.status === TicketStatus.Open) {
        ticket.status = TicketStatus.Assigned;
      }
      assignedLog = {
        fromValue: previousAssigneeName,
        toValue: actor.name,
        message: `${actor.name} mengambil tiket ini`,
      };
      await this.notifications.create(ticket.customerId, 'Tiket ditangani', `${ticket.ticketNumber} sedang ditangani support.`, ticket.id);
    }

    if (dto.assignedTo !== undefined) {
      if (actor.role !== UserRole.Admin) {
        throw new ForbiddenException('Hanya admin yang dapat assign support');
      }
      const assignee = await this.users.require(dto.assignedTo);
      if (assignee.role !== UserRole.Support) {
        throw new ForbiddenException('PIC harus user support');
      }
      ticket.assignedTo = dto.assignedTo;
      ticket.status = ticket.status === TicketStatus.Open ? TicketStatus.Assigned : ticket.status;
      assignedLog = {
        fromValue: previousAssigneeName,
        toValue: assignee.name,
        message: `${actor.name} menugaskan tiket ini kepada ${assignee.name}`,
      };
      await this.notifications.create(dto.assignedTo, 'Tiket ditugaskan', `${ticket.ticketNumber} ditugaskan kepada Anda.`, ticket.id);
    }

    if (dto.status) {
      ticket.status = dto.status;
      if (dto.status === TicketStatus.Solved) {
        await this.notifications.create(ticket.customerId, 'Tiket solved', `${ticket.ticketNumber} sudah ditandai selesai.`, ticket.id);
      }
    }

    const saved = await this.tickets.save(ticket);
    if (assignedLog) {
      await this.logWorkflow(saved.id, actor, 'assigned', assignedLog.message, assignedLog.fromValue, assignedLog.toValue);
    }
    if (previousStatus !== saved.status) {
      await this.logWorkflow(
        saved.id,
        actor,
        'status_changed',
        `${actor.name} mengubah status dari ${statusLabels[previousStatus]} ke ${statusLabels[saved.status]}`,
        previousStatus,
        saved.status,
      );
    }
    await this.audit.record(actor.id, `Mengubah tiket ${ticket.ticketNumber}`, ipAddress);
    return this.requireVisible(saved.id, actor);
  }

  async close(id: number, actor: any, ipAddress?: string) {
    const ticket = await this.requireVisible(id, actor);
    const ownerOrAdmin = actor.role === UserRole.Admin || actor.id === ticket.customerId;
    if (!ownerOrAdmin || ticket.status !== TicketStatus.Solved) {
      throw new ForbiddenException('Tiket hanya bisa ditutup oleh customer saat status solved');
    }
    const previousStatus = ticket.status;
    ticket.status = TicketStatus.Closed;
    ticket.closedAt = new Date();
    const saved = await this.tickets.save(ticket);
    await this.logWorkflow(
      saved.id,
      actor,
      'closed',
      `${actor.name} menutup tiket ini dari status ${statusLabels[previousStatus]} ke ${statusLabels[saved.status]}`,
      previousStatus,
      saved.status,
    );
    await this.audit.record(actor.id, `Menutup tiket ${ticket.ticketNumber}`, ipAddress);
    if (ticket.assignedTo) {
      await this.notifications.create(ticket.assignedTo, 'Tiket closed', `${ticket.ticketNumber} sudah ditutup customer.`, ticket.id);
    }
    return this.requireVisible(saved.id, actor);
  }

  canAccess(ticket: Ticket, actor: any) {
    if (actor.role === UserRole.Admin) return true;
    if (actor.role === UserRole.Customer) return ticket.customerId === actor.id;
    return ticket.assignedTo === actor.id || (!ticket.assignedTo && ticket.status === TicketStatus.Open);
  }

  private async nextTicketNumber() {
    const today = new Date();
    const date = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.tickets.count();
    return `TCK-${date}-${String(count + 1).padStart(5, '0')}`;
  }

  private async logWorkflow(
    ticketId: number,
    actor: any,
    type: string,
    message: string,
    fromValue?: string | null,
    toValue?: string | null,
  ) {
    await this.workflowLogs.save(
      this.workflowLogs.create({
        ticketId,
        actorId: actor?.id ?? null,
        type,
        message,
        fromValue,
        toValue,
      }),
    );
  }
}
