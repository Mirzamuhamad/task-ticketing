import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.auditLogs, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId?: number | null;

  @Column({ length: 240 })
  activity: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 80, nullable: true })
  ipAddress?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
