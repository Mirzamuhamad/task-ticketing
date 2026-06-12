import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(userId: number, title: string, body: string, ticketId?: number | null) {
    const notification = await this.notifications.save(this.notifications.create({ userId, title, body, ticketId }));
    this.gateway.emitToUser(userId, 'notification:new', notification);
    return notification;
  }

  list(userId: number) {
    return this.notifications.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 30 });
  }

  async markRead(userId: number, id: number) {
    await this.notifications.update({ id, userId }, { isRead: true });
    return { success: true };
  }
}
