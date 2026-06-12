import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    try {
      const payload = await this.jwt.verifyAsync(String(token));
      client.data.user = { id: payload.sub, email: payload.email, role: payload.role, name: payload.name };
      client.join(`user:${payload.sub}`);
      client.join(`role:${payload.role}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitToUser(userId: number, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToTicket(ticketId: number, event: string, payload: unknown) {
    this.server?.to(`ticket:${ticketId}`).emit(event, payload);
  }

  emitToAll(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }

  emitToRole(role: string, event: string, payload: unknown) {
    this.server?.to(`role:${role}`).emit(event, payload);
  }
}
