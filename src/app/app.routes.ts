import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { VideoCallComponent } from './components/video-call/video-call.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'call', component: VideoCallComponent },
  { path: '**', redirectTo: '' }
];