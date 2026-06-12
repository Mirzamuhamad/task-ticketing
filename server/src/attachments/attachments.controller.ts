import { BadRequestException, Controller, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { AttachmentsService } from './attachments.service';

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.docx', '.xlsx']);

function uploadOptions() {
  return {
    storage: diskStorage({
      destination: './uploads',
      filename: (_req, file, callback) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        callback(null, `${Date.now()}-${safeName}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      const ext = extname(file.originalname).toLowerCase();
      if (!allowedExtensions.has(ext)) {
        callback(new BadRequestException('Format file tidak didukung'), false);
        return;
      }
      callback(null, true);
    },
  };
}

@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService, private readonly realtime: NotificationsGateway) {}

  @Post('tickets/:ticketId')
  @UseInterceptors(FileInterceptor('file', uploadOptions()))
  async attachToTicket(
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const attachment = await this.attachments.attachToTicket(Number(ticketId), file, user, req.ip);
    this.realtime.emitToTicket(Number(ticketId), 'attachment:new', attachment);
    return attachment;
  }

  @Post('tickets/:ticketId/messages/:messageId')
  @UseInterceptors(FileInterceptor('file', uploadOptions()))
  async attachToMessage(
    @Param('ticketId') ticketId: string,
    @Param('messageId') messageId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const attachment = await this.attachments.attachToMessage(Number(ticketId), Number(messageId), file, user, req.ip);
    this.realtime.emitToTicket(Number(ticketId), 'attachment:new', attachment);
    return attachment;
  }
}
