import { Component, Input } from '@angular/core';
import { Joint } from "../../../model/joint";
import { Mechanism } from "../../../model/mechanism";

@Component({
  selector: 'tri-button',
  templateUrl: './tri-button.component.html',
  styleUrls: ['./tri-button.component.scss'],
})
export class TriButtonComponent {
  @Input() joint!: Joint;
  @Input() mechanism!: Mechanism;
  @Input() btn1Disabled: boolean = false;
  @Input() btn2Disabled: boolean = false;
  @Input() btn3Disabled: boolean = false;
  @Input() btn2Visible: boolean = true;
  @Input() btn3Visible: boolean = false;
  @Input() btn1Text: string = '';
  @Input() btn2Text: string = '';
  @Input() btn3Text: string = '';
  @Input() btn3Icon: string = '';
  @Input() btn1Action!: () => void;
  @Input() btn2Action!: () => void;
  @Input() btn3Action!: () => void;
  @Input() btn1SVGPath: string = '';
  @Input() btn2SVGPath: string = '';
  @Input() btn3SVGPath: string = '';

  selectedButton: string = ''; // Add this line to track the selected button

  getCurrentJoint(): Joint {
    return this.joint;
  }

  getMechanism(): Mechanism {
    return this.mechanism;
  }

  // Update button action methods to set the selectedButton variable
  selectButton1() {
    this.selectedButton = 'btn1';
    this.btn1Action();
  }

  selectButton2() {
    this.selectedButton = 'btn2';
    this.btn2Action();
  }

  selectButton3() {
    this.selectedButton = 'btn3';
    this.btn3Action();
  }

  constructor() {}
}
