// src/notification/notification.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' }, // À sécuriser en prod !
  namespace: '/notifications', // optionnel mais recommandé
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<number, string>(); // userId → socket.id

  handleConnection(client: Socket) {
    const userId = Number(client.handshake.query.userId || client.handshake.auth?.userId);

    if (!userId || isNaN(userId)) {
      client.disconnect();
      return;
    }

    this.connectedUsers.set(userId, client.id);
    client.join(`user_${userId}`);

    console.log(`→ User ${userId} connecté (socket ${client.id})`);
  }

  handleDisconnect(client: Socket) {
    const userId = [...this.connectedUsers.entries()].find(
      ([, sid]) => sid === client.id,
    )?.[0];

    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`← User ${userId} déconnecté`);
    }
  }

  sendToUser(userId: number, payload: any) {
    this.server.to(`user_${userId}`).emit('new_notification', payload);
  }
}