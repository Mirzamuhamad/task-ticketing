import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../common/enums';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService, private readonly audit: AuditService) {}

  @Get()
  @Roles(UserRole.Admin)
  list() {
    return this.users.list();
  }

  @Post()
  @Roles(UserRole.Admin)
  async create(@Body() dto: CreateUserDto, @Req() req: any) {
    const user = await this.users.create(dto);
    await this.audit.record(req.user.id, `Membuat user ${dto.email}`, req.ip);
    return user;
  }
}
