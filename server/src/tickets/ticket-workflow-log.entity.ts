import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Ticket } from './ticket.entity';

@Entity('ticket_workflow_logs')
export class TicketWorkflowLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.workflowLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ name: 'ticket_id' })
  ticketId: number;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: User | null;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId?: number | null;

  @Column({ length: 80 })
  type: string;

  @Column({ name: 'from_value', type: 'varchar', length: 120, nullable: true })
  fromValue?: string | null;

  @Column({ name: 'to_value', type: 'varchar', length: 120, nullable: true })
  toValue?: string | null;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
