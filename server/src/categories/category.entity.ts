import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Ticket } from '../tickets/ticket.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_name', unique: true, length: 120 })
  name: string;

  @OneToMany(() => Ticket, (ticket) => ticket.category)
  tickets: Ticket[];
}
