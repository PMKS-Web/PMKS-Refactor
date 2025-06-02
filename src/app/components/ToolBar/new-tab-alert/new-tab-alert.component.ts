import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-new-tab-alert',
  templateUrl: './new-tab-alert.component.html',
  styleUrl: './new-tab-alert.component.scss'
})
export class NewTabAlertComponent {
  constructor(private route: ActivatedRoute) {}
  isNewTab = true;
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.isNewTab = sessionStorage.getItem('isNewTab') === 'true';
    });
    sessionStorage.removeItem('isNewTab');
  }
  
  dismiss(){
    this.isNewTab = false;
  }
}
