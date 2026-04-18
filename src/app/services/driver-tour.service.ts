import { Injectable } from '@angular/core';
import { buildTourSteps } from '../components/Tours/driver-tour';
import { driver } from 'driver.js';
import { StateService } from '../services/state.service';
import { InteractionService } from '../services/interaction.service';
import { NotificationService } from '../services/notification.service';
import { UndoRedoService } from '../services/undo-redo.service';
import {PositionSolverService} from "./kinematic-solver.service";

@Injectable({ providedIn: 'root' })
export class DriverTourService {
  private driverInstance = driver({
    opacity: 0.7,
    padding: 3,
    showButtons: true,
    nextBtnText: 'Next ➔',
    prevBtnText: '⟵ Back',
    doneBtnText: 'Got it!',
    showProgress: true,
    popoverClass: 'drive-tour',
  });

  constructor(
    private stateService: StateService,
    private interactionService: InteractionService,
    private notificationService: NotificationService,
    private undoRedoService: UndoRedoService,
    private positionSolverService: PositionSolverService
  ) {}

  public start(): void {
    const steps = buildTourSteps(
      this.stateService,
      this.interactionService,
      this.notificationService,
      this.undoRedoService,
      this.positionSolverService
    );
    this.driverInstance.setSteps(steps as any[]);
    this.driverInstance.drive();
  }
}
