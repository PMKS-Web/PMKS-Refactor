import { Component} from '@angular/core'
import { StateService } from "../../../services/state.service";
import { UrlGenerationService } from "../../../services/url-generation.service";

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
    this.setCurrentTab("Share");
    let urlService = new UrlGenerationService(this.stateService);
    urlService.copyURL();
  }
}
