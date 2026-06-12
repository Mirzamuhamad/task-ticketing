import { UnauthorizedException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { UserStatus } from '../common/enums';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.users.findByEmail(dto.email);
    const valid = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;

    if (!user || !valid || user.status !== UserStatus.Active) {
      await this.audit.record(user?.id ?? null, `Login gagal untuk ${dto.email}`, ipAddress);
      throw new UnauthorizedException('Email atau password salah');
    }

    const publicUser = this.users.toPublic(user);
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role, name: user.name });
    await this.audit.record(user.id, 'Login berhasil', ipAddress);
    return { user: publicUser, accessToken: token };
  }

  async changePassword(userId: number, dto: ChangePasswordDto, ipAddress?: string) {
    const user = await this.users.require(userId);
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      await this.audit.record(user.id, 'Gagal mengganti password', ipAddress);
      throw new UnauthorizedException('Password saat ini salah');
    }
    await this.users.updatePassword(user.id, dto.newPassword);
    await this.audit.record(user.id, 'Mengganti password', ipAddress);
    return { ok: true };
  }
}
