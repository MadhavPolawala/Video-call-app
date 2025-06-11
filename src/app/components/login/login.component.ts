import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h1 class="text-3xl font-bold text-gray-800 mb-2">Video Call App</h1>
          <p class="text-gray-600">Enter your details to join a video call</p>
        </div>

        <form (ngSubmit)="joinCall()" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              [(ngModel)]="username"
              name="username"
              required
              class="outline-none w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-300 focus:border-blue-500 transition-all duration-300"
              placeholder="Enter your username"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Channel Name
            </label>
            <input
              type="text"
              id="channelName"
              [(ngModel)]="channelName"
              name="channelName"
              required
              class="outline-none w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-300 focus:border-blue-500 transition-all duration-300"
              placeholder="Enter channel name"
            >
          </div>

          <button
            type="submit"
            [disabled]="!username || !channelName"
            class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            Join Video Call
          </button>
        </form>

        <div class="mt-8 text-center">
          <p class="text-sm text-gray-500">
            Users with the same channel name will join the same video call
          </p>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  username = '';
  channelName = '';

  constructor(
    private router: Router,
    private chatService: ChatService
  ) {}

  joinCall() {
    if (this.username && this.channelName) {
      this.chatService.setUsername(this.username);
      this.router.navigate(['/call'], { 
        queryParams: { 
          username: this.username, 
          channel: this.channelName 
        } 
      });
    }
  }
}
