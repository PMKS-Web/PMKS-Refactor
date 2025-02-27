import { Component, inject, OnInit } from '@angular/core';
//import { Analytics, logEvent } from '@angular/fire/analytics';
import { UrlGenerationService } from 'src/app/services/url-generation.service';
import { StateService } from "../../../services/state.service";
import { EncoderService } from "../../../services/encoder.service";

//import { MechanismService} from "../../../services/mechanism.service";

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
    private stateService: StateService,
  ) {
    console.log("SavePanelComponent initialized");
    SavePanelComponent.instance = this;
  }
  ngOnInit(){
    this.download()
  }
  download() {
    let encoderService = new EncoderService(this.stateService);
    let csv:string = encoderService.exportMechanismDataToCSV();

  }
}
