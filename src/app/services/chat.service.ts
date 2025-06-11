import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  isOwn: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private currentUsername = '';

  setUsername(username: string) {
    this.currentUsername = username;
  }

  sendMessage(message: string) {
    if (!message.trim()) return;

    const chatMessage: ChatMessage = {
      id: Date.now().toString(),
      username: this.currentUsername,
      message: message.trim(),
      timestamp: new Date(),
      isOwn: true
    };

    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, chatMessage]);

    // Simulate receiving message from other user (for demo purposes)
    // In real implementation, this would come from Agora RTM or WebSocket
    if (Math.random() > 0.7) {
      setTimeout(() => {
        this.receiveMessage('Other User', 'Thanks for the message!');
      }, 1000);
    }
  }

  receiveMessage(username: string, message: string) {
    const chatMessage: ChatMessage = {
      id: Date.now().toString(),
      username,
      message,
      timestamp: new Date(),
      isOwn: false
    };

    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, chatMessage]);
  }

  clearMessages() {
    this.messagesSubject.next([]);
  }
}