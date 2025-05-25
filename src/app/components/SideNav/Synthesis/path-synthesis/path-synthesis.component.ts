import { Component} from '@angular/core'


@Component({
    selector: 'path-synthesis',
    templateUrl: './path-synthesis.component.html',
    styleUrls: ['./path-synthesis.component.scss'],

})

export class PathSynthesis{

    sectionExpanded: { [key: string]: boolean } = {
        LBasic: false,
      };

    constructor(){

    }
}
