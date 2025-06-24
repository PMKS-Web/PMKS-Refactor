import { Coord } from '../model/coord';
import { Force } from '../model/force';
import { Mechanism } from '../model/mechanism';
import { InteractionService } from '../services/interaction.service';
import { StateService } from '../services/state.service';
import { ContextMenuOption, Interactor } from './interactor';
// import type { ForceSnapshot } from '../components/ToolBar/undo-redo-panel/action';
import { NotificationService } from '../services/notification.service';

/*
This interactor defines the following behaviors:
- Dragging the Force moves it
*/

export class ForceInteractor extends Interactor {
  private activePanel = 'Edit';
  private forceStartPositions: { start: Coord; end: Coord } | null = null;
  private lastNotificationTime = 0;

  constructor(
    public force: Force,
    private stateService: StateService,
    private interactionService: InteractionService,
    private notificationService: NotificationService
  ) {
    super(true, true);

    this.onDragStart$.subscribe(() => {
      // Remove the isGenerated check since Force class doesn't have this property
      if (this.stateService.getCurrentActivePanel === 'Synthesis') {
        this.notificationService.showNotification(
          'Cannot edit in the Synthesis mode! Switch to Edit mode to edit.'
        );
        return;
      }

      this.forceStartPositions = {
        start: this.force.start.clone(),
        end: this.force.end.clone(),
      };
    });

    this.onDrag$.subscribe(() => {
      if (this.stateService.getCurrentActivePanel === 'Analysis') {
        const now = Date.now();
        if (now - this.lastNotificationTime >= 3000) {
          // 3 seconds = 3000ms
          this.notificationService.showNotification(
            'Cannot edit in the Analysis mode! Switch to Edit mode to edit.'
          );
          this.lastNotificationTime = now;
        }
        return;
      }

      if (this.forceStartPositions) {
        const dragOffset = this.dragOffsetInModel!;
        this.force.addCoordinates(dragOffset);
      }
    });

    // On drag end, inside ForceInteractor:
    this.onDragEnd$.subscribe(() => {
      if (!this.forceStartPositions) return;

      //Snapshot the old positions
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

      //Snapshot the *new* positions
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
        // this.stateService.recordAction({
        //   type: 'moveForce',
        //   forceId: this.force.id,
        //   oldPositions: oldPositions,
        //   newPositions: newPositions,
        // });
      }

      this.forceStartPositions = null;
      this.stateService.getMechanism().notifyChange();
    });
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
            //TODO Force Snapshot
            // const forceData: ForceSnapshot = {
            //   id: this.force.id,
            //   name: this.force.name,
            //   start: { x: this.force.start.x, y: this.force.start.y },
            //   end: { x: this.force.end.x, y: this.force.end.y },
            //   magnitude: this.force.magnitude,
            //   angle: this.force.angle,
            //   frameOfReference: this.force.frameOfReference,
            //   parentLinkId: this.force.parentLink.id,
            // };

            // this.stateService.recordAction({
            //   type: 'deleteForce',
            //   forceData,
            // });

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
