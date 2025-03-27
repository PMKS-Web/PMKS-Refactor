import { Component } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
@Component({
  selector: 'app-undo-redo-panel',
  templateUrl: './undo-redo-panel.component.html',
  styleUrls: ['./undo-redo-panel.component.scss']
})
export class UndoRedoPanelComponent {

  constructor(private stateService: StateService) {}

  onUndo() {
    this.stateService.undo();
  }

  onRedo() {
    this.stateService.redo();
  }
}
