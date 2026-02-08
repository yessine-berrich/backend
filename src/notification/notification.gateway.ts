// src/notification/notification.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // À restreindre en production (ex: 'http://localhost:3000')
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Gère la connexion : on place l'utilisateur dans une "room" unique via son ID
  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId;
    if (userId) {
      client.join(`user_${userId}`);
      console.log(`Client connecté : user_${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Client déconnecté');
  }

  // Méthode appelée depuis ton Service pour envoyer la notification
  sendNotification(recipientId: number, notification: any) {
    this.server.to(`user_${recipientId}`).emit('new_notification', notification);
  }
}