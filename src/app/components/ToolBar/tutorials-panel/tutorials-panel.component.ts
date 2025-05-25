import { Component} from '@angular/core'


@Component({
    selector: 'app-tutorials-panel',
    templateUrl: './tutorials-panel.component.html',
    styleUrls: ['./tutorials-panel.component.scss'],

})
export class TutorialsPanelComponent {
    sectionExpanded: { [key: string]: boolean } = {
        basic: true
      };

    constructor(){
    }


}
