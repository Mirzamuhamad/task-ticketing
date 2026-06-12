import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  async record(userId: number | null, activity: string, ipAddress?: string | null) {
    await this.logs.save(this.logs.create({ userId, activity, ipAddress }));
  }

  listLatest(limit = 50) {
    return this.logs.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
