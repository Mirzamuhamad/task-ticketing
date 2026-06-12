import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Attachment } from '../attachments/attachment.entity';
import { Ticket } from '../tickets/ticket.entity';
import { User } from '../users/user.entity';

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ name: 'ticket_id' })
  ticketId: number;

  @ManyToOne(() => User, (user) => user.messages, { eager: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: number;

  @ManyToOne(() => TicketMessage, { nullable: true })
  @JoinColumn({ name: 'reply_to_id' })
  replyTo?: TicketMessage | null;

  @Column({ name: 'reply_to_id', type: 'int', nullable: true })
  replyToId?: number | null;

  @Column({ type: 'text' })
  message: string;

  @OneToMany(() => Attachment, (attachment) => attachment.message)
  attachments: Attachment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
