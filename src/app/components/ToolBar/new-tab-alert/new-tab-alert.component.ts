import { Component } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-new-tab-alert',
  template: '',
  styles: ''
})
export class NewTabAlertComponent {
  constructor(private notificationService: NotificationService) {}
  isNewTab = true;
  ngOnInit() {
    this.isNewTab = sessionStorage.getItem('isNewTab') === 'true';
    sessionStorage.removeItem('isNewTab');
    if(this.isNewTab) this.notificationService.showNotification("Example loaded successfully. To navigate back to the previous workspace, click on the previous browser tab.");
  }
}
