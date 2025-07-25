import { Coord } from '../model/coord';
import { Force } from '../model/force';
import { Mechanism } from '../model/mechanism';
import { InteractionService } from '../services/interaction.service';
import { StateService } from '../services/state.service';
import { ContextMenuOption, Interactor } from './interactor';
// import type { ForceSnapshot } from '../components/ToolBar/undo-redo-panel/action';
import { NotificationService } from '../services/notification.service';
import { UndoRedoService } from '../services/undo-redo.service';

/*
This interactor defines the following behaviors:
- Dragging the Force moves it
*/

export class ForceInteractor extends Interactor {
  private activePanel = 'Edit';
  private forceStartPositions: { start: Coord; end: Coord } | null = null;
  private lastNotificationTime = 0;

  // Add these new properties for handle dragging
  public isDraggingHandle: boolean = false;
  public handleDragType: 'start' | 'end' | null = null;
  private originalHandlePosition: Coord | null = null;

  constructor(
    public force: Force,
    private stateService: StateService,
    private interactionService: InteractionService,
    private notificationService: NotificationService,
    private undoRedoService: UndoRedoService
  ) {
    super(true, true);

    this.onDragStart$.subscribe(() => {
      if (this.stateService.getCurrentActivePanel === 'Synthesis') {
        this.notificationService.showNotification(
          'Cannot edit in the Synthesis mode! Switch to Edit mode to edit.'
        );
        return;
      }
      // Store original positions for both whole-force and handle dragging
      this.forceStartPositions = {
        start: new Coord(this.force.start.x, this.force.start.y),
        end: this.force.end.clone(),
      };

      // If dragging a handle, store the original handle position
      if (this.isDraggingHandle && this.handleDragType) {
        this.originalHandlePosition =
          this.handleDragType === 'start'
            ? new Coord(this.force.start.x, this.force.start.y)
            : this.force.end.clone();
      }
    });

    this.onDrag$.subscribe(() => {
      if (this.stateService.getCurrentActivePanel === 'Analysis') {
        const now = Date.now();
        if (now - this.lastNotificationTime >= 3000) {
          this.notificationService.showNotification(
            'Cannot edit in the Analysis mode! Switch to Edit mode to edit.'
          );
          this.lastNotificationTime = now;
        }
        return;
      }

      // Handle dragging logic
      if (this.isDraggingHandle && this.handleDragType) {
        this.handleHandleDrag();
      }
    });

    this.onDragEnd$.subscribe(() => {
      if (!this.forceStartPositions) return;

      const oldPositions = {
        start: {
          x: this.forceStartPositions.start.x,
          y: this.forceStartPositions.start.y,
        },
        end: {
          x: this.forceStartPositions.end.x,
          y: this.forceStartPositions.end.y,
        },
      };

      const newPositions = {
        start: { x: this.force.start.x, y: this.force.start.y },
        end: { x: this.force.end.x, y: this.force.end.y },
      };

      const moved =
        oldPositions.start.x !== newPositions.start.x ||
        oldPositions.start.y !== newPositions.start.y ||
        oldPositions.end.x !== newPositions.end.x ||
        oldPositions.end.y !== newPositions.end.y;

      if (moved) {
        // Record action for undo/redo
        // this.stateService.recordAction({
        //   type: this.isDraggingHandle ? 'moveForceHandle' : 'moveForce',
        //   forceId: this.force.id,
        //   oldPositions: oldPositions,
        //   newPositions: newPositions,
        //   handleType: this.handleDragType
        // });
      }

      // Clean up dragging state
      this.forceStartPositions = null;
      this.isDraggingHandle = false;
      this.handleDragType = null;
      this.originalHandlePosition = null;

      this.stateService.getMechanism().notifyChange();
    });
  }

  private handleHandleDrag(): void {
    if (!this.handleDragType || !this.originalHandlePosition) return;

    const mousePos = this.interactionService.getMousePos();

    if (this.handleDragType === 'start') {
      // Move only the start point
      this.force.start = mousePos.model;
    } else if (this.handleDragType === 'end') {
      // Move only the end point
      this.force.end.x = mousePos.model.x;
      this.force.end.y = mousePos.model.y;
    }

    // Update force properties that depend on start/end positions
    this.force.updateFromEndpoints();
  }

  // Method to initiate handle dragging
  public startHandleDragging(type: 'start' | 'end'): void {
    this.isDraggingHandle = true;
    this.handleDragType = type;
  }

  /**
   * Determines what options should be shown for the context menu when right clicking on a Force
   *
   * @returns
   */
  public override specifyContextMenu(): ContextMenuOption[] {
    let availableContext: ContextMenuOption[] = [];
    if (this.stateService.getCurrentActivePanel === 'Synthesis') {
      this.notificationService.showNotification(
        'Cannot edit in the Synthesis mode! Switch to Edit mode to edit.'
      );
      return availableContext;
    }
    if (this.stateService.getCurrentActivePanel === 'Analysis') {
      this.notificationService.showNotification(
        'Cannot edit in the Analysis mode! Switch to Edit mode to edit.'
      );
      return availableContext;
    }

    const mechanism: Mechanism = this.stateService.getMechanism();

    if (this.activePanel === 'Edit') {
      availableContext.push(
        {
          icon: 'assets/contextMenuIcons/lock.svg', // Forces don't appear to have a locked property
          label: 'Lock Force',
          action: () => {
            // Note: Force class doesn't have a locked property in the provided definition
            // You may need to add this property to the Force class
            console.log(
              'Lock/unlock functionality not implemented - no locked property on Force'
            );
          },
          disabled: true, // Disabled since locked property doesn't exist
        },
        {
          icon: 'assets/contextMenuIcons/trash.svg',
          label: 'Delete Force',
          action: () => {


            this.undoRedoService.recordAction({
              type: 'deleteForce',
              oldForce: this.getForce(),
            });

            mechanism.removeForce(this.force.id);
            this.stateService.getMechanism().notifyChange();
          },
          disabled: false,
        }
      );
    }

    return availableContext;
  }

  // Returns the force associated with this interactor
  public getForce(): Force {
    return this.force;
  }

  // Returns a string representation of this ForceInteractor
  public override toString(): string {
    return 'ForceInteractor(' + this.force.name + ')';
  }

  // Returns the type identifier for this interactor
  public override type(): string {
    return 'ForceInteractor';
  }
}
