import { Component, HostListener } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { InteractionService } from 'src/app/services/interaction.service';
import { Mechanism } from '../../../model/mechanism';
import { NotificationService } from 'src/app/services/notification.service';
import { UndoRedoService } from 'src/app/services/undo-redo.service';
import { AnimationService } from 'src/app/services/animation.service';
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
    private NotificationService: NotificationService,

    // Included to handle changes to animation
    public animationService: AnimationService
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
    let animationBarRef: AnimationBarComponent = this.stateService.getAnimationBarComponent();
    let animationWasPlaying: boolean = false;

    // testing code for stopping animation
    if(animationBarRef.getIsAnimating()){
      // internal flag to replay animation later
      if(!animationBarRef.getIsPausedAnimating()){
        animationWasPlaying = true;
      }

      // stops animation
      animationBarRef.controlAnimation('stop');

      // clears trajectories from previous animation
      this.stateService.getMechanism().clearTrajectories();
    }
    // end of test code

    // Call the undo function from UndoRedoService.
    this.undoRedoService.undo();
    this.mechanism.clearTrajectories();
    this.mechanism.notifyChange();
    this.NotificationService.showNotification('Undo Called');

    // If an animation was playing before, start animation again.
    if (animationWasPlaying){
      // start animation
      animationBarRef.controlAnimation('play');
    }
  }

  //WHEN USER CLICKS REDO
  onRedo(): void {
    console.log('Redo button clicked');
    let animationBarRef: AnimationBarComponent = this.stateService.getAnimationBarComponent();
    let animationWasPlaying: boolean = false;

    // testing code for stopping animation
    if(animationBarRef.getIsAnimating()){
      // internal flag to replay animation later
      if(!animationBarRef.getIsPausedAnimating()){
        animationWasPlaying = true;
      }

      // stops animation
      animationBarRef.controlAnimation('stop');

      // clears trajectories from previous animation
      this.stateService.getMechanism().clearTrajectories();
    }
    // end of test code

    this.undoRedoService.redo();
    this.mechanism.clearTrajectories();
    this.mechanism.notifyChange();
    this.NotificationService.showNotification('Redo Called');

    // If an animation was playing before, start animation again.
    if (animationWasPlaying){
      // start animation
      animationBarRef.controlAnimation('play');
    }
  }

  protected readonly StateService = StateService;
}
