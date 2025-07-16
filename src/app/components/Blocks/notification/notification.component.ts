import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  NotificationService,
  Notification,
  WarningNotification,
} from 'src/app/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  warningNotification: WarningNotification | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.notificationService.notifications$.subscribe(
        (notifications) => (this.notifications = notifications)
      )
    );

    this.subscription.add(
      this.notificationService.warningNotification$.subscribe(
        (warningNotification) =>
          (this.warningNotification = warningNotification)
      )
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  trackByFn(index: number, item: Notification): string {
    return item.id;
  }
  onCloseNotification(id: string) {
    this.notificationService.removeNotification(id);
  }
  onCloseWarning(): void {
    this.notificationService.closeWarning();
  }
}
