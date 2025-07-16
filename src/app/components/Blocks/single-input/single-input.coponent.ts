import { Component, Input, OnInit, OnChanges, Output, EventEmitter } from '@angular/core';
import {Form, FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {Joint} from "../../../model/joint";
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'single-input-block',
  templateUrl: './single-input.component.html',
  styleUrls: ['./single-input.component.scss'],
})
export class SingleInputComponent {
  @Input() disabled: boolean=false;
  @Input() tooltip: string = '';
  @Input() input1Value: number=0;
  @Input() label1: string ="";
  @Input() unit1: string = "cm";
  @Input() showIcon: boolean = true;
  @Input() iconLabel1: string | undefined;

  @Output() input1Change: EventEmitter<number> = new EventEmitter<number>();
  constructor(private notificationService: NotificationService){}
  // handle the enter key being pressed and updating the values of the input blocks
  onEnterKeyInput1() {this.input1Change.emit(this.input1Value);}

  onBlurInput1() {this.input1Change.emit(this.input1Value);}
  onInputClick(){
    if(this.disabled) this.notificationService.showNotification("Clear Current Four-bar so that change link length and positions and regenerate a new four-bar");
  }
}
