import { AfterViewInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { animate, AUTO_STYLE, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'collapsible-subsection',
  animations: [
    trigger('openClose', [
      state(
        'open',
        style({
          visibility: AUTO_STYLE,
          height: AUTO_STYLE,
          opacity: '1',
        })
      ),
      state(
        'closed',
        style({
          display: 'none',
          opacity: '0',
          height: '0px',
          padding: '0px',
        })
      ),
      transition(':enter', []),
      transition('* => *', [animate('0.15s ease-in-out')]),
    ]),
  ],
  templateUrl: './collapsible-subsection.component.html',
  styleUrls: ['./collapsible-subsection.component.scss'],
})
export class CollapsibleSubsectionComponent {
  @Input() hideHeader: boolean = false; //If this is true the content cannot be expanded

  @Input() expanded: boolean = false;
  @Input() titleLabel: string = '';

  @Output() closed: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() opened: EventEmitter<boolean> = new EventEmitter<boolean>();

  toggleExpand() {
    this.expanded = !this.expanded;

    if (this.expanded) {
      this.opened.emit(true);
    } else {
      this.closed.emit(true);
    }
  }

    open() {
      this.expanded = true;
      this.opened.emit();
    }

    // Method to programmatically close the subsection
    close() {
      this.expanded = false;
      this.closed.emit();
    }
  }
