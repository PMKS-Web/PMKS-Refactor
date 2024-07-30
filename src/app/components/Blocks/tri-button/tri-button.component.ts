import { Component, Input } from '@angular/core';
import { Joint } from "../../../model/joint";
import { Mechanism } from "../../../model/mechanism";
import { ChangeDetectorRef } from '@angular/core';

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
  @Input() btn1Visible: boolean = true;
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

  btn1Active: boolean = false;
  btn2Active: boolean = false;
  btn3Active: boolean = false;

  constructor(private cdr: ChangeDetectorRef) {}

  onBtn1Click(): void {
    if (!this.btn1Disabled) {
      console.log('Button 1 (Counter-Clockwise) clicked');
      this.btn1Action?.();
      this.setActiveButton('btn1');
      console.log('btn1Active:', this.btn1Active);
      console.log('btn2Active:', this.btn2Active);
      console.log('btn3Active:', this.btn3Active);
    }
  }

  onBtn2Click(): void {
    if (!this.btn2Disabled) {
      this.btn2Action?.();
      this.setActiveButton('btn2');
      console.log('btn1Active:', this.btn1Active);
      console.log('btn2Active:', this.btn2Active);
      console.log('btn3Active:', this.btn3Active);
    }
  }

  onBtn3Click(): void {
    if (!this.btn3Disabled) {
      this.btn3Action?.();
      this.setActiveButton('btn3');
      console.log('btn1Active:', this.btn1Active);
      console.log('btn2Active:', this.btn2Active);
      console.log('btn3Active:', this.btn3Active);
    }
  }

  private setActiveButton(activeButton: 'btn1' | 'btn2' | 'btn3'): void {
    this.btn1Active = activeButton === 'btn1';
    this.btn2Active = activeButton === 'btn2';
    this.btn3Active = activeButton === 'btn3';
    console.log(`Set active button to ${activeButton}`);
  }

  getCurrentJoint(): Joint {
    return this.joint;
  }

  getMechanism(): Mechanism {
    return this.mechanism;
  }

}
