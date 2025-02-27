import {Component, inject, OnInit} from '@angular/core';
// @ts-ignore
//import { Analytics, logEvent } from '@angular/fire/analytics';
import { UrlGenerationService } from 'src/app/services/url-generation.service';

@Component({
  selector: 'app-share-panel',
  templateUrl: './share-panel.component.html',
  styleUrl: './share-panel.component.css'
})
export class SharePanelComponent implements OnInit{
  //private analytics: Analytics = inject(Analytics);

  static instance: SharePanelComponent;

  constructor() {
    SharePanelComponent.instance = this;
  }

  ngOnInit(){
    //this.copyURL()
  }

  copyURL() {
    // logEvent(this.analytics, 'copyURL');
    //
    // let url = this.urlGenerationService.generateFullUrl();
    //
    // // fake a text area to exec copy
    // const toolman = document.createElement('textarea');
    // document.body.appendChild(toolman);
    // toolman.value = url;
    // toolman.textContent = url;
    // toolman.select();
    // document.execCommand('copy'); //update the command
    // document.body.removeChild(toolman);

    // NewGridComponent.sendNotification(
    //   'Mechanism URL copied. If you make additional changes, copy the URL again.'
    // );

  }
}
