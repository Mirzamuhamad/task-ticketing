import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.require(id);
    if (dto.email && dto.email !== user.email) {
      const exists = await this.findByEmail(dto.email);
      if (exists && exists.id !== id) {
        throw new ConflictException('Email sudah terdaftar');
      }
      user.email = dto.email;
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, 12);
    return this.toPublic(await this.users.save(user));
  }

  async updateAvatar(id: number, file: Express.Multer.File) {
    const user = await this.require(id);
    user.avatarPath = `/uploads/${file.filename}`;
    return this.toPublic(await this.users.save(user));
  }

  async updatePassword(id: number, password: string) {
    const user = await this.require(id);
    user.passwordHash = await bcrypt.hash(password, 12);
    await this.users.save(user);
  }

  async delete(id: number, actorId: number) {
    if (id === actorId) {
      throw new ForbiddenException('Tidak bisa menghapus akun sendiri');
    }
    await this.require(id);
    await this.users.softDelete(id);
  }

  async require(id: number) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    return user;
  }

  toPublic(user: User) {
    const { passwordHash, deletedAt, ...publicUser } = user;
    return publicUser;
  }
}
