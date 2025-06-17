import { Component } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { InteractionService } from 'src/app/services/interaction.service';
import { Mechanism } from '../../../model/mechanism';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-undo-redo-panel',
  templateUrl: './undo-redo-panel.component.html',
  styleUrls: ['./undo-redo-panel.component.scss'],
})
export class UndoRedoPanelComponent {
  constructor(
    public stateService: StateService,
    public mechanism: Mechanism,
    private NotificationService: NotificationService
  ) {}

  // WHEN USER CLICKS UNDO
  onUndo(): void {
    this.stateService.undo();
    this.mechanism.clearTrajectories();
    this.mechanism.notifyChange();
    this.NotificationService.showNotification('Undo Called');
  }

  //WHEN USER CLICKS REDO
  onRedo(): void {
    this.stateService.redo();
    this.mechanism.clearTrajectories();
    this.mechanism.notifyChange();
    this.NotificationService.showNotification('Redo Called');
  }

  protected readonly StateService = StateService;
}
