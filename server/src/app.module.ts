import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { Category } from './categories/category.entity';
import { CategoriesModule } from './categories/categories.module';
import { DatabaseSeeder } from './database/database.seeder';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TicketsModule } from './tickets/tickets.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST') ?? 'localhost',
        port: Number(config.get<number>('DB_PORT') ?? 3306),
        username: config.get<string>('DB_USERNAME') ?? 'ticketing',
        password: config.get<string>('DB_PASSWORD') ?? 'ticketing',
        database: config.get<string>('DB_DATABASE') ?? 'task_ticketing',
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([User, Category]),
    UsersModule,
    AuditModule,
    AuthModule,
    CategoriesModule,
    NotificationsModule,
    TicketsModule,
    MessagesModule,
    AttachmentsModule,
  ],
  providers: [DatabaseSeeder],
})
export class AppModule {}
