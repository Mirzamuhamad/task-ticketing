import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../common/enums';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService, private readonly audit: AuditService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  @Roles(UserRole.Admin)
  async create(@Body() dto: CreateCategoryDto, @Req() req: any) {
    const category = await this.categories.create(dto);
    await this.audit.record(req.user.id, `Membuat kategori ${dto.name}`, req.ip);
    return category;
  }
}
