import { Coord } from "../model/coord";
import { Joint, JointType } from "../model/joint";
import { Mechanism } from "../model/mechanism";
import { InteractionService } from "../services/interaction.service";
import { StateService } from "../services/state.service";
import { ClickCapture, ClickCaptureID } from "./click-capture/click-capture";
import { CreateLinkFromJointCapture } from "./click-capture/create-link-from-joint-capture";
import { ContextMenuOption, Interactor } from "./interactor";
import {Subscription} from "rxjs";
import { PositionInteractor } from "./position-interactor";
import {Action} from "../components/ToolBar/undo-redo-panel/action"
import {cloneDeep} from "lodash";
/*
This interactor defines the following behaviors:
- Dragging the joint moves it
*/



export class JointInteractor extends Interactor {
    private jointStart: Coord = new Coord(0,0);
    private activePanelSub = new Subscription();
    private activePanel = "Edit";
    private _isDraggable: boolean = true;

    constructor(public joint: Joint,
                private stateService: StateService,
                private interactionService: InteractionService) {

      super(true, true);









        this.onDragStart$.subscribe((event) => {
            if ((!this.joint.locked || this.activePanel === "Edit") && this._isDraggable) {
              this.jointStart = this.joint._coords;
            }
        });

        this.onDrag$.subscribe((event) => {
            if ((!this.joint.locked || this.activePanel === "Edit") && this._isDraggable) {
              this.stateService.getMechanism().setJointCoord(this.joint.id, this.jointStart.add(this.dragOffsetInModel!))
            }
        });

        this.onDragEnd$.subscribe((event) => {
          console.log("Drag ended for joint", this.joint.id);

          const mech = this.stateService.getMechanism();
          mech.notifyChange();

        });
      this.activePanelSub = this.stateService.globalActivePanelCurrent.subscribe((panel) => {this.activePanel = panel});
        /*
        // if backspace, delete
        this.onKeyDown$.subscribe((event) => {
            if (event.key === "Backspace") {
                this.stateService.getMechanism().removeJoint(this.joint.id);
            }
        });*/

    }

    public setDraggable(value: boolean): void {
        this._isDraggable = value;
    }

    public canDrag(): boolean {
        return this._isDraggable && !this.joint.locked;
    }

    /**
     * Determines what options should be shown for the context menu when right clicking on a joint
     *
     * @returns
     */
    public override specifyContextMenu(): ContextMenuOption[] {

        let availableContext: ContextMenuOption[] = [];
        let mechanism: Mechanism = this.stateService.getMechanism();
        if (this.activePanel === "Edit") {
          availableContext.push(
            {
              icon: "assets/contextMenuIcons/addLink.svg",
              label: "Attach Link",
              action: () => {
                this.enterAddLinkCaptureMode()
              },
              disabled: false
            });
          //logic for Input option
          if (this.joint.isInput) {
            availableContext.push(
              {
                icon: "assets/contextMenuIcons/removeInput.svg",
                label: "Remove Input",
                action: () => {

                  const actionObj: Action = {
                    type: 'removeInput',
                    jointId: this.joint.id,
                  };

                  this.stateService.recordAction(actionObj);

                  mechanism.removeInput(this.joint.id)
                },
                disabled: !mechanism.canRemoveInput(this.joint)
              });
          } else {
            availableContext.push(
              {
                icon: "assets/contextMenuIcons/addInput.svg",
                label: "Add Input",
                action: () => {

                  const actionObj: Action = {
                    type: 'addInput',
                    jointId: this.joint.id,
                  };

                  this.stateService.recordAction(actionObj);

                  mechanism.addInput(this.joint.id)
                },
                disabled: !mechanism.canAddInput(this.joint)
              });
          }
          //Logic for Grounding option
          if (this.joint.isGrounded) {
            availableContext.push(
              {
                icon: "assets/contextMenuIcons/removeGround.svg",
                label: "Remove Ground",
                action: () => {
                  const actionObj: Action = {
                    type: 'removeGround',
                    jointId: this.joint.id,
                  };
                  this.stateService.recordAction(actionObj);
                  mechanism.removeGround(this.joint.id)
                },
                disabled: !mechanism.canRemoveGround(this.joint)
              });
          } else {
            availableContext.push(
              {
                icon: "assets/contextMenuIcons/addGround.svg",
                label: "Add Ground",
                action: () => {

                  const actionObj: Action = {
                    type: 'addGround',
                    jointId: this.joint.id,
                  };

                  this.stateService.recordAction(actionObj);


                  mechanism.addGround(this.joint.id);

                },
                disabled: !mechanism.canAddGround(this.joint)});
          }
          //Logic for Slider option
          if (this.joint.type == JointType.Prismatic) {
            availableContext.push(
              {
                icon: "assets/contextMenuIcons/removeSlider.svg",
                label: "Remove Slider",
                action: () => {

                  const actionObj: Action = {
                    type: 'removeSlider',
                    jointId: this.joint.id,
                  };
                  this.stateService.recordAction(actionObj);


                  mechanism.removeSlider(this.joint.id)
                },
                disabled: !mechanism.canRemoveSlider(this.joint)
              });
          } else {
            availableContext.push(
              {
                icon: "assets/contextMenuIcons/addSlider.svg",
                label: "Add Slider",
                action: () => {

                  const actionObj: Action = {
                    type: 'addSlider',
                    jointId: this.joint.id,
                  };
                  this.stateService.recordAction(actionObj);

                  mechanism.addSlider(this.joint.id)
                },
                disabled: !mechanism.canAddSlider(this.joint) || !this.joint.isGrounded
              });
          }
          //Logic for Welding option
          if (this.joint.isWelded) {
            availableContext.push(
              {
                icon: "assets/contextMenuIcons/removeWeld.svg",
                label: "Remove Weld",
                action: () => {
                  const actionObj: Action = {
                    type: 'removeWeld',
                    jointId: this.joint.id,
                  };
                  this.stateService.recordAction(actionObj);
                  mechanism.removeWeld(this.joint.id)
                },
                disabled: !mechanism.canRemoveWeld(this.joint)
              });
          } else {
            availableContext.push(
              {
                icon: "assets/contextMenuIcons/addWeld.svg",
                label: "Add Weld",
                action: () => {
                  const actionObj: Action = {
                    type: 'addWeld',
                    jointId: this.joint.id,
                  };
                  this.stateService.recordAction(actionObj);
                  mechanism.addWeld(this.joint.id)
                },
                disabled: !mechanism.canAddWeld(this.joint)
              });
          }
          availableContext.push(
            {
              icon: "assets/contextMenuIcons/trash.svg",
              label: "Delete Joint",
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
                  isReference: jointToDelete.isReference
                };

                const connectedLinks = mechanism.getConnectedLinksForJoint(jointToDelete);
                const linksData = connectedLinks.map(link => {
                  // If link.joints is a Map, convert to Array first
                  const jointIdsArray = Array.from(link.joints.values()).map(j => j.id);
                  return {
                    id: link.id,
                    jointIds: jointIdsArray,
                    name: link.name,
                    mass: link.mass,
                    angle: link.angle,
                    locked: link.locked,
                    color: link.color
                  };
                });

                const allJointsSnapshot = mechanism.getArrayOfJoints()
                  .filter(j => j.id !== jointToDelete.id)
                  .map(j => ({
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
                    isReference: j.isReference
                  }));

                const preDeletionIds = new Set(mechanism.getArrayOfJoints().map(j => j.id));
                mechanism.removeJoint(this.joint.id);
                const postDeletionIds = new Set(mechanism.getArrayOfJoints().map(j => j.id));
                const extraJointsSnapshots = allJointsSnapshot.filter(jSnap => !postDeletionIds.has(jSnap.id));



                const actionObj: Action = {
                  type: 'deleteJoint',
                  jointId: jointToDelete.id,
                  jointData,
                  linksData,
                  extraJointsData: extraJointsSnapshots
                };


                this.stateService.recordAction(actionObj);


              },
              disabled: false
            });
        }
        return availableContext;

    }

    private enterAddLinkCaptureMode(): void {
        const capture = new CreateLinkFromJointCapture(this.joint, this.interactionService);
        capture.onClick$.subscribe((mousePos) => {

            if (capture.getHoveringJoint() === undefined) { // if not hovering over a joint, create a new joint to attach to
                this.stateService.getMechanism().addLinkToJoint(this.joint.id, mousePos);
            } else { // if hovering over a joint, create a link to that joint
                this.stateService.getMechanism().addLinkToJoint(this.joint.id, capture.getHoveringJoint()!.id);
            }
        });
        this.interactionService.enterClickCapture(capture);
    }

    public override toString(): string {
        return "jointInteractor(" + this.joint.name + ")";
    }

    public getJoint(): Joint {
      return this.joint ;
    }

    public override type(): string{
        return "JointInteractor"
    }

    private isDraggingPosition(): boolean {
        const selectedObject = this.interactionService.getSelectedObject();
        return selectedObject instanceof PositionInteractor;
    }
}
