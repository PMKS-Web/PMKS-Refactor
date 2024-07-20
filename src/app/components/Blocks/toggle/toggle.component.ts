import { Component, Input, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-toggle',
  templateUrl: './toggle.component.html',
  styleUrls: ['./toggle.component.scss']
})
export class ToggleComponent {
  @Input() tooltip: string = '';
  @Input() label: string = '';
  @Input() initialValue: boolean = false;
  @Input() iconClass: string = ''; // Add this line
  @Output() valueChanged: EventEmitter<boolean> = new EventEmitter<boolean>();

  public value: boolean = this.initialValue;

  toggle() {
    this.value = !this.value;
    this.valueChanged.emit(this.value);
  }
}

/*
@Component({
  selector: 'toggle-block',
  templateUrl: './toggle.component.html',
  styleUrls: ['./toggle.component.scss'],
})
export class ToggleComponent implements OnInit {
  @Input() tooltip: string | undefined;
  @Input() formGroup!: FormGroup;
  @Input() formControlGround!: FormControl;
  @Input() _formControl!: string;

  @Input() addInput: boolean = false;
  @Input() _formControlForInput!: string;
  @Input() disableInput: boolean = false;

  @Output() toggleStateChanged: EventEmitter<boolean> = new EventEmitter<boolean>();


  @ViewChild('field', { static: false }) field!: ElementRef;

  ngOnInit() {
    console.log("We ran on init and has value of ");
    this.formControlGround.valueChanges.subscribe(newValue => {
      console.log("Trasmitting event now.");
      this.toggleStateChanged.emit(newValue);
      console.log("Event transmitted and state of toggle changed.");
      this.cdr.detectChanges();
    });
  }
  constructor(private cdr: ChangeDetectorRef) {}

  // ngOnChanges() {
  //   //Get the #field input element
  //   // const field = document.getElementById('field');
  //   console.log(this.field.nativeElement);
  //   (this.field.nativeElement as HTMLInputElement).select();
  //   (this.field.nativeElement as HTMLInputElement).blur();
  // }
}

<!--
<div id='toggle-block'>
  <div [formGroup]='this.formGroup' class='row'>
    <span class='label'><ng-content></ng-content></span>
    <mat-icon *ngIf='!addInput' matTooltip='{{ this.tooltip }}' [matTooltipShowDelay]='1000' class='label-help'
    >help_outline
    </mat-icon>
    <div class='spacer'></div>
    <span class='label {{disableInput ? "disabled":""}}' *ngIf='addInput' style='font-size: 25px; padding-bottom: 5px;'>⊾</span>
    <mat-form-field *ngIf='addInput' class='customInputForm' (click)='disableInput ? null :field.select()'>
      <input class='customInput' matInput type='text' #field (keyup.enter)='field.blur()'>
    </mat-form-field>
    <div class='spacer'></div>
    <div class="right-aligned">
      <mat-slide-toggle color='primary' [formControl]='formControlGround'></mat-slide-toggle>
    </div>
  </div>
</div>


 */
