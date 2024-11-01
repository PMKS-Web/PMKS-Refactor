import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'radio-block',
  templateUrl: './radio.component.html',
  styleUrls: ['./radio.component.scss'],
})
export class RadioComponent {
  @Input() tooltip: string | undefined;
  @Input() options: string[] = [];
  @Input() disabled: boolean = false;
  @Input() initialSelection: string | undefined;
  @Output() selectionChanged = new EventEmitter<string>();

  selectedOption: string | undefined;

  constructor() {
    this.initializeSelection();
  }

  private initializeSelection() {
    if (this.initialSelection && this.options.includes(this.initialSelection)) {
      this.selectedOption = this.initialSelection;
      this.emitSelection();
    } else {
      // If no valid initialSelection provided or it's not in options, select the first option
      if (this.options.length > 0) {
        this.selectedOption = this.options[0];
        this.emitSelection();
      }
    }
  }

  selectOption(option: string) {
    this.initialSelection = option;
    this.emitSelection();
  }

  emitSelection() {
    this.selectionChanged.emit(this.initialSelection);
  }
}
