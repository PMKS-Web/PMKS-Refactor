import { Coord } from '../model/coord';
import { Joint, JointType } from '../model/joint';
import { Mechanism } from '../model/mechanism';
import { InteractionService } from '../services/interaction.service';
import { StateService } from '../services/state.service';
import { CreateLinkFromJointCapture } from './click-capture/create-link-from-joint-capture';
import { ContextMenuOption, Interactor } from './interactor';
import { Action } from '../components/ToolBar/undo-redo-panel/action';
import { NotificationService } from '../services/notification.service';
import { UndoRedoService } from '../services/undo-redo.service';
import {PositionSolverService} from "../services/kinematic-solver.service";


/*
This interactor defines the following behaviors:
- Dragging the joint moves it
*/

export class JointInteractor extends Interactor {
  private _isDraggable: boolean = true;
  private jointStartCoords: Coord | null = null;
  private lastNotificationTime = 0;

  constructor(
    public joint: Joint,
    private stateService: StateService,
    private interactionService: InteractionService,
    private notificationService: NotificationService,
    private undoRedoService: UndoRedoService,
    private positionSolver: PositionSolverService
  ) {
    super(true, true);

    this.onDragStart$.subscribe(() => {
      if (this.stateService.getCurrentActivePanel === 'Synthesis') {
        console.log('is generated: ' + this.joint.isGenerated);
        if (this.joint.isGenerated)
          this.notificationService.showNotification(
            'Cannot edit in the Synthesis mode! Switch to Edit mode to edit.'
          );
        else
          this.notificationService.showNotification(
            'Please change the length and angle from the Synthesis Panel.'
          );
        return;
      }

      if (
        (!this.joint.locked ||
          this.stateService.getCurrentActivePanel === 'Edit') &&
        this._isDraggable &&
        this.joint.id >= 0
      ) {
        this.jointStartCoords = this.joint.coords.clone();
      }
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
      if (
        (!this.joint.locked ||
          this.stateService.getCurrentActivePanel === 'Edit') &&
        this._isDraggable &&
        this.jointStartCoords
      ) {
        const newPos = this.jointStartCoords
          .clone()
          .add(this.dragOffsetInModel!);
        this.stateService.getMechanism().setJointCoord(this.joint.id, newPos);

        // Display new joint trajectory when joint is moved
        this.stateService
          .getMechanism()
          .populateTrajectories(this.positionSolver);
      }
    });

    this.onDragEnd$.subscribe(() => {

      this.stateService.getMechanism().clearTrajectories(); // Hide trajectories when not moving joint

      if (this.jointStartCoords) {
        const oldPos = this.jointStartCoords;
        const newPos = this.joint.coords.clone();

        if (oldPos.x !== newPos.x || oldPos.y !== newPos.y) {
          this.undoRedoService.recordAction({
            type: 'moveJoint',
            jointId: this.joint.id,
            oldCoords: { x: oldPos.x, y: oldPos.y },
            newCoords: { x: newPos.x, y: newPos.y },
          });
        }
      }

      this.jointStartCoords = null;
      this.stateService.getMechanism().notifyChange();
    });
  }
  /**
   * Determines what options should be shown for the context menu when right clicking on a joint
   *
   * @returns
   */
  public override specifyContextMenu(): ContextMenuOption[] {
    let availableContext: ContextMenuOption[] = [];

    let mechanism: Mechanism = this.stateService.getMechanism();
    if (this.stateService.getCurrentActivePanel === 'Synthesis') {
      this.notificationService.showNotification(
        'Cannot edit in the Synthesis mode! Switch to Edit mode to edit.'
      );
    }
    if (this.stateService.getCurrentActivePanel === 'Analysis') {
      this.notificationService.showNotification(
        'Cannot edit in the Analysis mode! Switch to Edit mode to edit.'
      );
      return availableContext;
    }
    if (this.stateService.getCurrentActivePanel === 'Edit') {
      availableContext.push({
        icon: 'assets/contextMenuIcons/addLink.svg',
        label: 'Attach Link',
        action: () => {
          this.enterAddLinkCaptureMode();
        },
        disabled: false,
      });
      //logic for Input option
      if (this.joint.isInput) {
        availableContext.push({
          icon: 'assets/contextMenuIcons/removeInput.svg',
          label: 'Remove Input',
          action: () => {
            const actionObj: Action = {
              type: 'removeInput',
              jointId: this.joint.id,
            };

            this.undoRedoService.recordAction(actionObj);

            mechanism.removeInput(this.joint.id);
          },
          disabled: !mechanism.canRemoveInput(this.joint),
        });
      } else {
        availableContext.push({
          icon: 'assets/contextMenuIcons/addInput.svg',
          label: 'Add Input',
          action: () => {
            const actionObj: Action = {
              type: 'addInput',
              jointId: this.joint.id,
            };

            this.undoRedoService.recordAction(actionObj);

            mechanism.addInput(this.joint.id);
          },
          disabled: !mechanism.canAddInput(this.joint),
        });
      }
      //Logic for Grounding option
      if (this.joint.isGrounded) {
        availableContext.push({
          icon: 'assets/contextMenuIcons/removeGround.svg',
          label: 'Remove Ground',
          action: () => {
            const actionObj: Action = {
              type: 'removeGround',
              jointId: this.joint.id,
            };
            this.undoRedoService.recordAction(actionObj);
            mechanism.removeGround(this.joint.id);
          },
          disabled: !mechanism.canRemoveGround(this.joint),
        });
      } else {
        availableContext.push({
          icon: 'assets/contextMenuIcons/addGround.svg',
          label: 'Add Ground',
          action: () => {
            const actionObj: Action = {
              type: 'addGround',
              jointId: this.joint.id,
            };

            this.undoRedoService.recordAction(actionObj);

            mechanism.addGround(this.joint.id);
          },
          disabled: !mechanism.canAddGround(this.joint),
        });
      }
      //Logic for Slider option
      if (this.joint.type == JointType.Prismatic) {
        availableContext.push({
          icon: 'assets/contextMenuIcons/removeSlider.svg',
          label: 'Remove Slider',
          action: () => {
            const actionObj: Action = {
              type: 'removeSlider',
              jointId: this.joint.id,
            };
            this.undoRedoService.recordAction(actionObj);

            mechanism.removeSlider(this.joint.id);
            mechanism.removeGround(this.joint.id);
          },
          disabled: !mechanism.canRemoveSlider(this.joint),
        });
      } else {
        availableContext.push({
          icon: 'assets/contextMenuIcons/addSlider.svg',
          label: 'Add Slider',
          action: () => {
            const actionObj: Action = {
              type: 'addSlider',
              jointId: this.joint.id,
            };
            this.undoRedoService.recordAction(actionObj);

            mechanism.addSlider(this.joint.id);
            mechanism.removeGround(this.joint.id);
          },
          disabled: !mechanism.canAddSlider(this.joint),
        });
      }
      //Logic for Welding option
      if (this.joint.isWelded) {
        availableContext.push({
          icon: 'assets/contextMenuIcons/removeWeld.svg',
          label: 'Remove Weld',
          action: () => {
            const actionObj: Action = {
              type: 'removeWeld',
              jointId: this.joint.id,
            };
            this.undoRedoService.recordAction(actionObj);
            mechanism.removeWeld(this.joint.id);
          },
          disabled: !mechanism.canRemoveWeld(this.joint),
        });
      } else {
        availableContext.push({
          icon: 'assets/contextMenuIcons/addWeld.svg',
          label: 'Add Weld',
          action: () => {
            const actionObj: Action = {
              type: 'addWeld',
              jointId: this.joint.id,
            };
            this.undoRedoService.recordAction(actionObj);
            mechanism.addWeld(this.joint.id);
          },
          disabled: !mechanism.canAddWeld(this.joint),
        });
      }
      availableContext.push({
        icon: 'assets/contextMenuIcons/trash.svg',
        label: 'Delete Joint',
        action: () => {
          const mechanism = this.stateService.getMechanism();
          const jointToDelete = mechanism.getJoint(this.joint.id);

          const jointData = {
            id: jointToDelete.id,
            coords: { x: jointToDelete.coords.x, y: jointToDelete.coords.y },
            name: jointToDelete.name,
            type: jointToDelete.type,
            angle: jointToDelete.angle,
            isGrounded: jointToDelete.isGrounded,
            isInput: jointToDelete.isInput,
            inputSpeed: jointToDelete.inputSpeed,
            isWelded: jointToDelete.isWelded,
            locked: jointToDelete.locked,
            isHidden: jointToDelete.isHidden,
            isReference: jointToDelete.isReference,
          };

          const connectedLinks =
            mechanism.getConnectedLinksForJoint(jointToDelete);
          const linksData = connectedLinks.map((link) => {
            // If link.joints is a Map, convert to Array first
            const jointIdsArray = Array.from(link.joints.values()).map(
              (j) => j.id
            );
            return {
              id: link.id,
              jointIds: jointIdsArray,
              name: link.name,
              mass: link.mass,
              angle: link.angle,
              locked: link.locked,
              color: link.color,
            };
          });

          const allJointsSnapshot = mechanism
            .getArrayOfJoints()
            .filter((j) => j.id !== jointToDelete.id)
            .map((j) => ({
              id: j.id,
              coords: { x: j.coords.x, y: j.coords.y },
              name: j.name,
              type: j.type,
              angle: j.angle,
              isGrounded: j.isGrounded,
              isInput: j.isInput,
              inputSpeed: j.inputSpeed,
              isWelded: j.isWelded,
              locked: j.locked,
              isHidden: j.isHidden,
              isReference: j.isReference,
            }));
          new Set(mechanism.getArrayOfJoints().map((j) => j.id));
          mechanism.removeJoint(this.joint.id);
          const postDeletionIds = new Set(
            mechanism.getArrayOfJoints().map((j) => j.id)
          );
          const extraJointsSnapshots = allJointsSnapshot.filter(
            (jSnap) => !postDeletionIds.has(jSnap.id)
          );

          const actionObj: Action = {
            type: 'deleteJoint',
            jointId: jointToDelete.id,
            jointData,
            linksData,
            extraJointsData: extraJointsSnapshots,
          };

          this.undoRedoService.recordAction(actionObj);
          this.interactionService.deselectObject();
        },
        disabled: false,


      });
    }
    return availableContext;
  }

  private enterAddLinkCaptureMode(): void {
    const capture = new CreateLinkFromJointCapture(
      this.joint,
      this.interactionService
    );
    // ── after ──
    capture.onClick$.subscribe((mousePos) => {
      const mech = this.stateService.getMechanism();

      // make the link (and possibly a new joint)
      const hovered = capture.getHoveringJoint();
      if (!hovered) {
        mech.addLinkToJoint(this.joint.id, mousePos);
      } else {
        mech.addLinkToJoint(this.joint.id, hovered.id);
      }

      // grab the link
      const allLinks = mech.getArrayOfLinks();
      const created = allLinks[allLinks.length - 1];

      // if we just made a brand‑new joint, find it and snapshot it
      let extraJointsData: Action['extraJointsData'] = [];
      if (!hovered) {
        const [a, b] = created.getJoints().map((j) => j.id);
        const newJointId = a === this.joint.id ? b : a;
        const newJoint = mech.getJoint(newJointId)!;

        extraJointsData.push({
          id: newJoint.id,
          coords: { x: newJoint.coords.x, y: newJoint.coords.y },
          name: newJoint.name,
          type: newJoint.type,
          angle: newJoint.angle,
          isGrounded: newJoint.isGrounded,
          isWelded: newJoint.isWelded,
          isInput: newJoint.isInput,
          inputSpeed: newJoint.speed,
          locked: newJoint.locked,
          isHidden: newJoint.hidden,
          isReference: newJoint.reference,
        });
      }

      //record both link + any new joint
      this.undoRedoService.recordAction({
        type: 'addLink',
        linkData: {
          id: created.id,
          jointIds: created.getJoints().map((j) => j.id),
          name: created.name,
          mass: created.mass,
          angle: created.angle,
          locked: created.locked,
          color: created.color,
        },
        extraJointsData: extraJointsData.length ? extraJointsData : undefined,
      });

      mech.notifyChange();
    });

    this.interactionService.enterClickCapture(capture);
  }

  // Returns a string representation of this JointInteractor
  public override toString(): string {
    return 'jointInteractor(' + this.joint.name + ')';
  }

  // Returns the joint associated with this interactor
  public getJoint(): Joint {
    return this.joint;
  }

  // Returns the type identifier for this interactor
  public override type(): string {
    return 'JointInteractor';
  }
}
