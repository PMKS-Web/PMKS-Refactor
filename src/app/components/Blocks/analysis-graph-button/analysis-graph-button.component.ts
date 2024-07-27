import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {Link} from "../../../model/link";


@Component({
  selector: 'analysis-graph-button',
  templateUrl: './analysis-graph-button.component.html',
  styleUrls: ['./analysis-graph-button.component.scss'],
})
export class AnalysisGraphButtonComponent {
  @Input() dynamicText: string = '';
  @Input() graphText: string = '';
  @Input() btn1Action!: () => void;

  executeAction() {
    if (this.btn1Action) {
      this.btn1Action();
      if(this.graphText == 'Show Graph'){
      this.graphText = 'Hide Graph'} else{
        this.graphText = 'Show Graph'
      }
    }
  }

  setAction(action: () => void): void {
    this.btn1Action = action;
  }



  constructor() {}
}
