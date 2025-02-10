import {Component, inject, OnInit} from '@angular/core';
// @ts-ignore
//import { Analytics, logEvent } from '@angular/fire/analytics';
import { UrlGenerationService } from 'src/app/services/url-generation.service';
import { MechanismService} from "../../../services/mechanism.service";

@Component({
  selector: 'app-share-panel',
  templateUrl: './share-panel.component.html',
  styleUrls: ['./share-panel.component.css']
})
export class SharePanelComponent implements OnInit{
  //private analytics: Analytics = inject(Analytics);

  static instance: SharePanelComponent;

  constructor() {
    SharePanelComponent.instance = this;
  }

  ngOnInit(){
    //let mech = new MechanismService(PARAMS).mechanisms[0] TODO
    //let nugs = new UrlGenerationService(mech)
    //nugs.copyURL()
  }
}
