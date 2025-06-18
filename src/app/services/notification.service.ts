import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface Notification {
  id: string;
  message: string;
  timestamp: number;
  fadingOut?: boolean;
}

export interface WarningNotification {
  id: string;
  message: string;
  timestamp: number;
  fadingOut?: boolean;
  onClose?: Subject<string>; // Subject to emit when closed
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private warningNotificationSubject =
    new BehaviorSubject<WarningNotification | null>(null);
  public warningNotification$ = this.warningNotificationSubject.asObservable();

  showNotification(message: string): void {
    const notification: Notification = {
      id: this.generateId(),
      message,
      timestamp: Date.now(),
      fadingOut: false,
    };

    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([...currentNotifications, notification]);

    const fadeOutDurationMS = 2500;
    setTimeout(() => {
      this.startFadeOut(notification.id);
    }, fadeOutDurationMS - 400);

    setTimeout(() => {
      this.removeNotification(notification.id);
    }, fadeOutDurationMS);
  }

  showWarning(message: string): Subject<string> {
    // Close existing warning if any
    this.closeWarning();

    const onCloseSubject = new Subject<string>();

    const warningNotification: WarningNotification = {
      id: this.generateId(),
      message,
      timestamp: Date.now(),
      onClose: onCloseSubject,
    };

    this.warningNotificationSubject.next(warningNotification);

    return onCloseSubject;
  }

  closeWarning(): void {
    const currentWarning = this.warningNotificationSubject.value;
    if (currentWarning) {
      // Emit the close event
      if (currentWarning.onClose) {
        currentWarning.onClose.next(currentWarning.id);
        currentWarning.onClose.complete();
      }

      this.warningNotificationSubject.next(null);
    }
  }

  private startFadeOut(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.map((n) =>
      n.id === id ? { ...n, fadingOut: true } : n
    );
    this.notificationsSubject.next(updatedNotifications);
  }

  removeNotification(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    const filteredNotifications = currentNotifications.filter(
      (n) => n.id !== id
    );
    this.notificationsSubject.next(filteredNotifications);
  }

  private generateId(): string {
    return (
      Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9)
    );
  }
}
