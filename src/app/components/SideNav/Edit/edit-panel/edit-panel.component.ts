import { Component} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
import { JointInteractor } from 'src/app/controllers/joint-interactor';
import { Interactor } from 'src/app/controllers/interactor';


@Component({
    selector: 'app-edit-panel',
    templateUrl: './edit-panel.component.html',
    styleUrls: ['./edit-panel.component.scss'],

})
export class EditPanelComponent {

    private selectedObj: Interactor | undefined
    constructor(private interactionService: InteractionService){
        this.selectedObj = this.interactionService.getSelectedObject();
        this.interactionService._selectionChange$.subscribe(selection => {
            this.selectedObj = this.interactionService.getSelectedObject();
        });

    }

    getSelectedObjectType(): string{
        if(this.selectedObj == undefined){
            //console.log("selected obj is undefined");
            return '';
        } else{
            //console.log(`selected obj is ${this.selectedObj.type()}`);
            return this.selectedObj.type();
        }
    }
}
