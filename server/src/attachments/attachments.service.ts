import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { MessagesService } from '../messages/messages.service';
import { TicketsService } from '../tickets/tickets.service';
import { Attachment } from './attachment.entity';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment) private readonly attachments: Repository<Attachment>,
    private readonly tickets: TicketsService,
    private readonly messages: MessagesService,
    private readonly audit: AuditService,
  ) {}

  async attachToTicket(ticketId: number, file: Express.Multer.File, actor: any, ipAddress?: string) {
    if (!file) {
      throw new BadRequestException('File wajib diunggah');
    }
    const ticket = await this.tickets.requireVisible(ticketId, actor);
    const attachment = await this.attachments.save(
      this.attachments.create({
        ticketId: ticket.id,
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: actor.id,
      }),
    );
    await this.audit.record(actor.id, `Upload lampiran pada ${ticket.ticketNumber}`, ipAddress);
    return attachment;
  }

  async attachToMessage(ticketId: number, messageId: number, file: Express.Multer.File, actor: any, ipAddress?: string) {
    if (!file) {
      throw new BadRequestException('File wajib diunggah');
    }
    await this.messages.requireMessage(ticketId, messageId, actor);
    const attachment = await this.attachments.save(
      this.attachments.create({
        ticketId,
        messageId,
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: actor.id,
      }),
    );
    await this.audit.record(actor.id, `Upload lampiran pesan ${messageId}`, ipAddress);
    return attachment;
  }
}
