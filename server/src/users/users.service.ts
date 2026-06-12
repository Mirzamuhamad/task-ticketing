import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findByEmail(email: string) {
    return this.users.findOne({ where: { email } });
  }

  findById(id: number) {
    return this.users.findOne({ where: { id } });
  }

  async list() {
    const users = await this.users.find({ order: { name: 'ASC' } });
    return users.map((user) => this.toPublic(user));
  }

  async create(dto: CreateUserDto) {
    const exists = await this.findByEmail(dto.email);
    if (exists) {
      throw new ConflictException('Email sudah terdaftar');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.save(
      this.users.create({ name: dto.name, email: dto.email, passwordHash, role: dto.role, status: UserStatus.Active }),
    );
    return this.toPublic(user);
  }

  async require(id: number) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    return user;
  }

  toPublic(user: User) {
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }
}
