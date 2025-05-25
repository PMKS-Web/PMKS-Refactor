import { Component } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { InteractionService } from 'src/app/services/interaction.service';
import {Mechanism} from "../../../model/mechanism";

@Component({
  selector: 'app-undo-redo-panel',
  templateUrl: './undo-redo-panel.component.html',
  styleUrls: ['./undo-redo-panel.component.scss']
})
export class UndoRedoPanelComponent {
  constructor(
    public stateService: StateService,
    public mechanism: Mechanism,
  ) {}

  // WHEN USER CLICKS UNDO
  onUndo(): void {
    console.log('Undo button clicked');
    // Call the undo function from UndoRedoService.
    this.stateService.undo();
    this.mechanism.clearTrajectories();
    this.mechanism.notifyChange();

  }

  //WHEN USER CLICKS REDO
  onRedo(): void {
    console.log('Redo button clicked');
    this.stateService.redo();
    this.mechanism.clearTrajectories();
    this.mechanism.notifyChange();

  }

  protected readonly StateService = StateService;
}
