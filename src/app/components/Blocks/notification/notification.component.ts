import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService, Notification } from 'src/app/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification',
  templateUrl: "./notification.component.html",
  styleUrls: ['./notification.component.scss']
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription: Subscription = new Subscription();

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.notifications$.subscribe(
      notifications => this.notifications = notifications
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  closeNotification(id: string): void {
    this.notificationService.removeNotification(id);
  }

  trackByFn(index: number, item: Notification): string {
    return item.id;
  }
}