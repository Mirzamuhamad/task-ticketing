import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Attachment } from '../attachments/attachment.entity';
import { Category } from '../categories/category.entity';
import { TicketPriority, TicketStatus } from '../common/enums';
import { TicketMessage } from '../messages/ticket-message.entity';
import { User } from '../users/user.entity';
import { TicketWorkflowLog } from './ticket-workflow-log.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ticket_number', unique: true, length: 32 })
  ticketNumber: string;

  @Column({ length: 180 })
  title: string;

  @ManyToOne(() => Category, (category) => category.tickets, { eager: true })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => User, (user) => user.tickets, { eager: true })
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @Column({ name: 'customer_id' })
  customerId: number;

  @ManyToOne(() => User, (user) => user.assignedTickets, { nullable: true, eager: true })
  @JoinColumn({ name: 'assigned_to' })
  assignee?: User | null;

  @Column({ name: 'assigned_to', type: 'int', nullable: true })
  assignedTo?: number | null;

  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.Medium })
  priority: TicketPriority;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.Open })
  status: TicketStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt?: Date | null;

  @OneToMany(() => TicketMessage, (message) => message.ticket)
  messages: TicketMessage[];

  @OneToMany(() => Attachment, (attachment) => attachment.ticket)
  attachments: Attachment[];

  @OneToMany(() => TicketWorkflowLog, (log) => log.ticket)
  workflowLogs: TicketWorkflowLog[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
