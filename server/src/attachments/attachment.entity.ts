import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TicketMessage } from '../messages/ticket-message.entity';
import { Ticket } from '../tickets/ticket.entity';
import { User } from '../users/user.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ name: 'ticket_id' })
  ticketId: number;

  @ManyToOne(() => TicketMessage, (message) => message.attachments, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message?: TicketMessage | null;

  @Column({ name: 'message_id', type: 'int', nullable: true })
  messageId?: number | null;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'mime_type', length: 120 })
  mimeType: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedByUser: User;

  @Column({ name: 'uploaded_by' })
  uploadedBy: number;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
