import {Component, Input, OnInit, OnChanges, Output, EventEmitter, numberAttribute} from '@angular/core';
import {Form, FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {Joint} from "../../../model/joint";
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'dual-input-block',
  templateUrl: './dual-input.component.html',
  styleUrls: ['./dual-input.component.scss'],
})
export class DualInputComponent {
  @Input() disabled: boolean = false;
  @Input() tooltip: string = '';
  @Input() input1Value: number = 0;
  @Input() input2Value: number = 0;
  @Input() label1: string ="";
  @Input() label2: string ="";
  @Input() unit1: string ="";
  @Input() unit2: string ="";
  @Input() showIcon: boolean = true;
  @Input() iconLabel1: string | undefined;
  @Input() iconLabel2: string | undefined;


  @Output() input1Change: EventEmitter<number> = new EventEmitter<number>();
  @Output() input2Change: EventEmitter<number> = new EventEmitter<number>();
  constructor(private notificationService: NotificationService){}
  // handle the enter key being pressed and updating the values of the input blocks
  onEnterKeyInput1() {
    this.input1Change.emit(this.input1Value as number);
  }

  onEnterKeyInput2() {
    this.input2Change.emit(this.input2Value as number);
  }

  onBlurInput1() {
    this.input1Change.emit(this.input1Value as number);
  }

  onBlurInput2() {
    this.input2Change.emit(this.input2Value as number);
  }

  onInputClick(){
    if(this.disabled) this.notificationService.showNotification("Clear Current Four-bar so that change link length and positions and regenerate a new four-bar");
  }

}
