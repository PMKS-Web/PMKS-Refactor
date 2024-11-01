import {Component, EventEmitter, Output} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
import { JointInteractor } from 'src/app/controllers/joint-interactor';


@Component({
    selector: 'app-synthesis-panel',
    templateUrl: './synthesis-panel.component.html',
    styleUrls: ['./synthesis-panel.component.scss'],

})

export class SynthesisPanelComponent {
    sectionExpanded: { [key: string]: boolean } = {
        threePos: false,
        path: false,
      };
    @Output() passGenerated = new EventEmitter<boolean>();
    constructor(private interactionService: InteractionService){}
  changeGeneratedCheck(changeTo: boolean): void {
    this.passGenerated.emit(changeTo);
  }
}
