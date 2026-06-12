import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Category } from '../categories/category.entity';
import { UserRole, UserStatus } from '../common/enums';
import { User } from '../users/user.entity';

@Injectable()
export class DatabaseSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeeder.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedCategories();
    await this.seedUsers();
  }

  private async seedCategories() {
    const names = ['Aplikasi', 'Jaringan', 'Hardware', 'Akses User', 'Lainnya'];
    for (const name of names) {
      const exists = await this.categories.findOne({ where: { name } });
      if (!exists) {
        await this.categories.save(this.categories.create({ name }));
      }
    }
  }

  private async seedUsers() {
    const passwordHash = await bcrypt.hash('password123', 12);
    const users = [
      { name: 'Admin Demo', email: 'admin@demo.test', role: UserRole.Admin },
      { name: 'Support Demo', email: 'support@demo.test', role: UserRole.Support },
      { name: 'Customer Demo', email: 'customer@demo.test', role: UserRole.Customer },
    ];

    for (const user of users) {
      const exists = await this.users.findOne({ where: { email: user.email } });
      if (!exists) {
        await this.users.save(this.users.create({ ...user, passwordHash, status: UserStatus.Active }));
        this.logger.log(`Seeded ${user.email}`);
      }
    }
  }
}
