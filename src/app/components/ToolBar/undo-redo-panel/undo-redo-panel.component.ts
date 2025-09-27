import {Component, HostListener} from '@angular/core';
import {StateService} from 'src/app/services/state.service';
import {InteractionService} from 'src/app/services/interaction.service';
import {Mechanism} from '../../../model/mechanism';
import {NotificationService} from 'src/app/services/notification.service';
import {UndoRedoService} from 'src/app/services/undo-redo.service';
import {AnimationBarComponent} from "../../AnimationBar/animationbar/animationbar.component";

@Component({
  selector: 'app-undo-redo-panel',
  templateUrl: './undo-redo-panel.component.html',
  styleUrls: ['./undo-redo-panel.component.scss'],
})
export class UndoRedoPanelComponent {
  constructor(
    public stateService: StateService,
    public undoRedoService: UndoRedoService,
    public mechanism: Mechanism,
    private NotificationService: NotificationService
  ) {}

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'z' && this.undoRedoService.canUndo()) {
      event.preventDefault();
      this.onUndo();
    }
    if (event.ctrlKey && event.key === 'y' && this.undoRedoService.canRedo()) {
      event.preventDefault();
      this.onRedo();
    }
  }

  // WHEN USER CLICKS UNDO
  onUndo(): void {
    console.log('Undo button clicked');
    // Access animation to check if playing or paused
    let animationBarRef: AnimationBarComponent = this.stateService.getAnimationBarComponent();

    if (animationBarRef.getIsAnimating()) {
      this.NotificationService.showWarning('Please stop animation before attempting to undo.');
    } else {

      // Clear previous trajectories
      this.stateService.getMechanism().clearTrajectories();

      // Call the undo function from UndoRedoService.
      this.undoRedoService.undo();
      this.mechanism.clearTrajectories();
      this.mechanism.notifyChange();
      this.NotificationService.showNotification('Undo Called');
    }
  }

  //WHEN USER CLICKS REDO
  onRedo(): void {
    console.log('Redo button clicked');
    // Access animation to check if playing or paused
    let animationBarRef: AnimationBarComponent = this.stateService.getAnimationBarComponent();

    if (animationBarRef.getIsAnimating()) {
      this.NotificationService.showWarning('Please stop animation before attempting to redo.');
    } else {
      // Clear previous trajectories
      this.stateService.getMechanism().clearTrajectories();

      // Call the undo function from UndoRedoService.
      this.undoRedoService.redo();
      this.mechanism.clearTrajectories();
      this.mechanism.notifyChange();
      this.NotificationService.showNotification('Redo Called');
    }
  }

  protected readonly StateService = StateService;
  protected readonly AnimationBarComponent = AnimationBarComponent;
}
