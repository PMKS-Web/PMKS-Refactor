import { Component} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
import { JointInteractor } from 'src/app/controllers/joint-interactor';


@Component({
  selector: 'app-tutorials-panel',
  templateUrl: './tutorials-panel.component.html',
  styleUrls: ['./tutorials-panel.component.scss'],

})
export class TutorialsPanelComponent {
  sectionExpanded: { [key: string]: boolean } = {
    basic: true
  };

  constructor(private interactionService: InteractionService){
  }


}
