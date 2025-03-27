import { Component} from '@angular/core'
import { StateService } from "../../../services/state.service";
import { UrlGenerationService } from "../../../services/url-generation.service";
import {EncoderService} from "../../../services/encoder.service";

@Component({
    selector: 'app-toolbar',
    templateUrl: './toolbar.component.html',
    styleUrls: ['./toolbar.component.scss'],
})
export class ToolbarComponent {

  constructor(private stateService: StateService) {

  }

selectedPanel: string = '';

setCurrentTab(clickedPanel: string){
    console.log(clickedPanel);
    if(clickedPanel==this.selectedPanel) {
      this.selectedPanel = '';
    }else{
        this.selectedPanel= clickedPanel;}

    console.log("Current Selected: " + this.selectedPanel);
}

getSelected(): string {
    return this.selectedPanel;
}
  handleShare(tab:string) {
    //this.setCurrentTab("Share");
    let urlService = new UrlGenerationService(this.stateService);
    urlService.copyURL();
  }
  handleSave(tab:string) {
    //this.setCurrentTab("Save");
    let encoderService = new EncoderService(this.stateService);
    let csv:string = encoderService.exportMechanismDataToCSV();

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.csv";
    a.click();
    URL.revokeObjectURL(url);

  }
}
