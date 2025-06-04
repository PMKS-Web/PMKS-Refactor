import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Notification {
  id: string;
  message: string;
  timestamp: number;
  fadingOut?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  showNotification(message: string): void {
    const notification: Notification = {
      id: this.generateId(),
      message,
      timestamp: Date.now(),
      fadingOut: false
    };

    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([...currentNotifications, notification]);
    const fadeOutDurationMS = 5000;
    // Start fade out after 9.7 seconds, then remove after 10 seconds
    setTimeout(() => {
      this.startFadeOut(notification.id);
    }, fadeOutDurationMS - 400);

    setTimeout(() => {
      this.removeNotification(notification.id);
    }, fadeOutDurationMS);
  }

  private startFadeOut(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.map(n => 
      n.id === id ? { ...n, fadingOut: true } : n
    );
    this.notificationsSubject.next(updatedNotifications);
  }

  removeNotification(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    const filteredNotifications = currentNotifications.filter(n => n.id !== id);
    this.notificationsSubject.next(filteredNotifications);
  }

  private generateId(): string {
    return Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9);
  }
}