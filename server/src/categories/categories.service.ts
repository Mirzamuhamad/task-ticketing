import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Category } from './category.entity';

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private readonly categories: Repository<Category>) {}

  list() {
    return this.categories.find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateCategoryDto) {
    const exists = await this.categories.findOne({ where: { name: dto.name } });
    if (exists) {
      throw new ConflictException('Kategori sudah ada');
    }
    return this.categories.save(this.categories.create(dto));
  }

  async require(id: number) {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan');
    }
    return category;
  }
}
