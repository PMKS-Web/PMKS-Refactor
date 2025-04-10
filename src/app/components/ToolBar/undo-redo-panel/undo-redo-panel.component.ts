import { Component } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { InteractionService } from 'src/app/services/interaction.service';

@Component({
  selector: 'app-undo-redo-panel',
  templateUrl: './undo-redo-panel.component.html',
  styleUrls: ['./undo-redo-panel.component.scss']
})
export class UndoRedoPanelComponent {
  constructor(
    public stateService: StateService,
    private interactionService: InteractionService,
  ) {}

  onUndo(): void {
    console.log('Undo button clicked');
    // Call the undo function from UndoRedoService.
    this.stateService.undo();
  }

  onRedo(): void {
    console.log('Redo button clicked');
    this.stateService.redo();
  }

  protected readonly StateService = StateService;
}
