import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../common/enums';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif']);

function photoUploadOptions() {
  return {
    storage: diskStorage({
      destination: './uploads',
      filename: (_req, file, callback) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        callback(null, `${Date.now()}-${safeName}`);
      },
    }),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      const ext = extname(file.originalname).toLowerCase();
      if (!imageExtensions.has(ext)) {
        callback(new BadRequestException('Foto harus JPG, PNG, atau GIF'), false);
        return;
      }
      callback(null, true);
    },
  };
}

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

  @Patch(':id')
  @Roles(UserRole.Admin)
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    const user = await this.users.update(Number(id), dto);
    await this.audit.record(req.user.id, `Mengubah user ${user.email}`, req.ip);
    return user;
  }

  @Post(':id/photo')
  @Roles(UserRole.Admin)
  @UseInterceptors(FileInterceptor('file', photoUploadOptions()))
  async uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const user = await this.users.updateAvatar(Number(id), file);
    await this.audit.record(req.user.id, `Mengubah foto user ${user.email}`, req.ip);
    return user;
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  async delete(@Param('id') id: string, @Req() req: any) {
    await this.users.delete(Number(id), req.user.id);
    await this.audit.record(req.user.id, `Menghapus user #${id}`, req.ip);
    return { ok: true };
  }
}
