import {Component, Input, EventEmitter, Output, SimpleChanges} from '@angular/core';

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
  @Input() disabled: boolean = false; // if this is true, will disable the toggle
  @Input() canBeInput: boolean = true; // this is for an input toggle, if true, the current joint can be an input and toggle works
  @Input() inputToggle: boolean = false; // this is to see whether the current toggle is an input joint toggle
  @Output() valueChanged: EventEmitter<boolean> = new EventEmitter<boolean>(); // if the toggle's value changes, the new value will be emitted
  @Output() actionPrevented: EventEmitter<number> = new EventEmitter<number>(); // emits when preventing toggle action; used for notifications

  public value: boolean = this.initialValue;

  ngOnInit() {
    this.value = this.initialValue;
  }

  ngOnChanges(changes: SimpleChanges) {
    // checks for any changes in these input values
    if (changes['initialValue']) {
      this.value = changes['initialValue'].currentValue;
    }
    if (changes['disabled']) {
      this.disabled = changes['disabled'].currentValue;
    }
    if (changes['canBeInput']) {
      this.canBeInput = changes['canBeInput'].currentValue;
    }
    if (changes['inputToggle']) {
      this.inputToggle = changes['inputToggle'].currentValue;
    }
  }

  toggle() {
    // this is for a delay when showing disabled input
    /*if (this.aboutToDisable) {
      return;
    }*/

    if (this.inputToggle && !this.canBeInput && !this.value) {
      // checks if this current toggle is an input toggle
      // if input toggle, then checks if current joint can become an input joint
      // if it cannot become an input joint and is not already an input joint, will prevent action
      this.value = true;
      setTimeout(() => { // this timeout makes sure that the switch flips back and forth
        this.value = false;
        this.disabled = true;
      }, 200);
      this.actionPrevented.emit(1);
      return;
    }
    if (this.disabled) {
      // for when toggle is disabled (probably due to animation running)
      this.actionPrevented.emit(0);
      return;
    }
    // if not prevented, change value
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
