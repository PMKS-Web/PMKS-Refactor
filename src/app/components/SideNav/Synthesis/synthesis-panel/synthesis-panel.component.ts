import {Component, EventEmitter, Output} from '@angular/core'


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

    constructor(){}

    // Emits whether the mechanism was successfully synthesized
    changeGeneratedCheck(changeTo: boolean): void {
      this.passGenerated.emit(changeTo);
    }
}
