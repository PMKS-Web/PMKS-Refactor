import { Component} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
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
        this.interactionService._selectionChange$.subscribe(() => {
            this.selectedObj = this.interactionService.getSelectedObject();
        });

    }

    // Returns the type name of the currently selected object
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
