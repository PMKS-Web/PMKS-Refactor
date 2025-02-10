import { Component, inject, OnInit } from '@angular/core';
//import { Analytics, logEvent } from '@angular/fire/analytics';
import { UrlGenerationService } from 'src/app/services/url-generation.service';
import {EncoderService} from "../../../services/encoder.service";
import { MechanismService} from "../../../services/mechanism.service";

@Component({
  selector: 'app-save-panel',
  templateUrl: './save-panel.component.html',
  styleUrl: './save-panel.component.css'
})
export class SavePanelComponent implements OnInit{

 // private analytics: Analytics = inject(Analytics);

  static instance: SavePanelComponent;

  constructor(
    private UrlGenerationService: UrlGenerationService,

  ) {
    SavePanelComponent.instance = this;
  }
  ngOnInit(){
    this.download()
  }
  download() {
    //let mech = new MechanismService(PARAMS).mechanisms[0] TODO
    //const csv = EncoderService.exportMechanismDataToCSV(mechanism) todo get mechanism connected

  }
}
