import { Component} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'

@Component({
  selector: 'app-analysis-panel',
  templateUrl: './analysis-panel.component.html',
  styleUrls: ['./analysis-panel.component.scss'],

})
export class AnalysisPanelComponent {
  constructor(private interactionService: InteractionService){}
  getSelectedObjectType(): string{
    let obj = this.interactionService.getSelectedObject();
    if(obj == undefined){
      return '';
    } else{
      return obj.type();
    }
  }
}
