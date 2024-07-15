import { Component} from '@angular/core'
import { InteractionService } from 'src/app/services/interaction.service'
import { JointInteractor } from 'src/app/controllers/joint-interactor';
import {GridLinesComponent} from 'src/app/components/Grid/gridlines/gridlines.component'

@Component({
    selector: 'app-settings-panel',
    templateUrl: './settings-panel.component.html',
    styleUrls: ['./settings-panel.component.scss'],

})
export class SettingsPanelComponent{

    sectionExpanded: { [key: string]: boolean } = {
        LBasic: true,
        LVisual: true,
      };

    gridEnabled: boolean= true;
    minorGridEnabled: boolean = true;

    constructor(private interactionService: InteractionService){

    }

    handleToggleGridChange(stateChange: boolean){
        this.gridEnabled=stateChange;
        if(stateChange){
        }
    }

    getGridEnabled(): boolean{
        return this.gridEnabled;
    }

    handleToggleMinorGridChange(stateChange: boolean){
        this.minorGridEnabled=stateChange;
    }

    getMinorGridEnabled(): boolean{
        return this.minorGridEnabled;
    }
}
