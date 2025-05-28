import { Coord } from "../model/coord";
import { Link } from "../model/link";
import { Joint } from "../model/joint";
import { Mechanism } from "../model/mechanism";
import { InteractionService } from "../services/interaction.service";
import { StateService } from "../services/state.service";
import { CreateLinkFromLinkCapture } from "./click-capture/create-link-from-link-capture";
import { CreateForceFromLinkCapture } from "./click-capture/create-force-from-link-capture";
import { ContextMenuOption, Interactor } from "./interactor";
import type {JointSnapshot, LinkSnapshot} from "../components/ToolBar/undo-redo-panel/action";


/*
This interactor defines the following behaviors:
- Dragging the Link moves it
*/

export class LinkInteractor extends Interactor {
  private activePanel = "Edit";
  private linkStartPositions = new Map<number, Coord>();

  constructor(public link: Link, private stateService: StateService,
              private interactionService: InteractionService) {
    super(true, true);

    this.onDragStart$.subscribe(() => {
      this.link.joints.forEach((joint: Joint, id: number) => {
        this.linkStartPositions.set(id, joint.coords.clone());
      })


    });
    this.onDrag$.subscribe(() => {
      this.linkStartPositions.forEach((startPos, jointID) => {
        const newPos = startPos.clone().add(this.dragOffsetInModel!);
        this.stateService.getMechanism().setJointCoord(jointID, newPos);
      });
    });

    // On drag end, inside LinkInteractor:
    this.onDragEnd$.subscribe(() => {
      //Snapshot the old positions from your Map<number,Coord>
      const oldPositions = Array.from(this.linkStartPositions.entries()).map(
        ([jointId, coords]) => ({jointId, coords: {x: coords.x, y: coords.y}})
      );

      //Snapshot the *new* positions by converting link.joints into an Array
      const newPositions = Array.from(this.link.joints.values()).map(j => ({
        jointId: j.id,
        coords: {x: j.coords.x, y: j.coords.y}
      }));

      const moved = oldPositions.some(oldP => {
        const newP = newPositions.find(n => n.jointId === oldP.jointId)!;
        return oldP.coords.x !== newP.coords.x || oldP.coords.y !== newP.coords.y;
      });

      if (moved) {
        this.stateService.recordAction({
          type: 'moveLink',
          linkId: this.link.id,
          oldJointPositions: oldPositions,
          newJointPositions: newPositions
        });
      }

      this.linkStartPositions.clear();
      this.stateService.getMechanism().notifyChange();
    });


  }


    /**
     * Determines what options should be shown for the context menu when right clicking on a Link
     *
     * @returns
     */
    public override specifyContextMenu(): ContextMenuOption[] {

        let availableContext: ContextMenuOption[] = [];
        const mechanism: Mechanism = this.stateService.getMechanism();
        let modelPosAtRightClick = this.getMousePos().model;
        if (this.activePanel === "Edit") {
          availableContext.push(
            {
              icon: "assets/contextMenuIcons/addLink.svg",
              label: "Attach Link",
              action: () => {
                const start = modelPosAtRightClick;
                const capture = new CreateLinkFromLinkCapture(this.link, start, this.interactionService);

                capture.onClick$.subscribe(end => {
                  const mech = this.stateService.getMechanism();

                  // 1) before splitting, snapshot IDs
                  const beforeLinkIds  = mech.getArrayOfLinks().map(l => l.id);
                  const beforeJointIds = mech.getArrayOfJoints().map(j => j.id);


                  mech.addLinkToLink(this.link.id, start, end);


                  const allLinks  = mech.getArrayOfLinks().map(l => l.id);
                  const newLinkId = allLinks.find(id => !beforeLinkIds.includes(id))!;

                  const allJoints   = mech.getArrayOfJoints().map(j => j.id);
                  const newJointIds = allJoints.filter(id => !beforeJointIds.includes(id));

                  this.stateService.recordAction({
                    type:          'addLinkToLink',
                    parentLinkId:  this.link.id,
                    start,
                    end,
                    newLinkId,
                    newJointIds
                  });

                  const extraJointsData = newJointIds.map(id => {
                    const j = mech.getJoint(id)!;
                    return {
                      id:          j.id,
                      coords:      { x: j.coords.x, y: j.coords.y },
                      name:        j.name,
                      type:        j.type,
                      angle:       j.angle,
                      isGrounded:  j.isGrounded,
                      isWelded:    j.isWelded,
                      isInput:     j.isInput,
                      inputSpeed:  j.speed,
                      locked:      j.locked,
                      isHidden:      j.hidden,
                      isReference: j.reference
                    };
                  });

                  const attachJointId = extraJointsData.find(js =>
                    js.coords.x === start.x && js.coords.y === start.y
                  )!.id;

                  this.stateService.recordAction({
                    type:             'addLinkToLink',
                    parentLinkId:   this.link.id,
                    start:          start,
                    end:            end,
                    attachJointId:  attachJointId
                  });

                  mech.notifyChange();
                });

                this.interactionService.enterClickCapture(capture);
              },
              disabled: false
            },

            {
              icon: "assets/contextMenuIcons/addTracer.svg",
              label: "Attach Tracer Point",
              action: () => {
                // snapshot existing joint‐IDs
                const beforeIds = Array.from(this.link.joints.keys());

                // add the tracer
                this.stateService.getMechanism().addJointToLink(
                  this.link.id,
                  modelPosAtRightClick
                );

                // find exactly which joint is new
                const afterIds = Array.from(this.link.joints.keys());
                const newId    = afterIds.find(id => !beforeIds.includes(id))!;
                const newJoint = this.link.joints.get(newId)!;

                // recordAction with a real jointId
                this.stateService.recordAction({
                  type: 'addTracer',
                  linkTracerData: {
                    linkId: this.link.id,
                    jointId: newId,
                    coords: { x: newJoint.coords.x, y: newJoint.coords.y }
                  }
                });

                this.stateService.getMechanism().notifyChange();
              },

              disabled: false
            },


            {
              icon: "assets/contextMenuIcons/addForce.svg",
              label: "Attach Force",
              action: () => {


                this.enterAddForceCaptureMode(modelPosAtRightClick)
              },
              disabled: false
            },
            {
              icon: this.link.locked ? "assets/contextMenuIcons/unlock.svg" : "assets/contextMenuIcons/lock.svg",
              label: this.link.locked ? "Unlock Link" : "Lock Link",
              action: () => {
                this.link.locked = (!this.link.locked)
              },
              disabled: false
            },
            {
              icon: "assets/contextMenuIcons/trash.svg",
              label: "Delete Link",
              action: () => {
                this.stateService.getMechanism();
                const linkData: LinkSnapshot = {
                  id:       this.link.id,
                  jointIds: Array.from(this.link.joints.values()).map(j => j.id),
                  name:     this.link.name,
                  mass:     this.link.mass,
                  angle:    this.link.angle,
                  locked:   this.link.locked,
                  color:    this.link.color
                };


                const extraJointsData: JointSnapshot[] =
                  Array.from(this.link.joints.values()).map(j => ({
                    id:         j.id,
                    coords:     { x: j.coords.x, y: j.coords.y },
                    name:       j.name,
                    type:       j.type,
                    angle:      j.angle,
                    isGrounded: j.isGrounded,
                    isWelded:   j.isWelded,
                    isInput:    j.isInput,
                    inputSpeed: j.speed,
                    locked:     j.locked,
                    isHidden:   j.hidden,
                    isReference:j.reference
                  }));

                this.stateService.recordAction({
                  type:            "deleteLink",
                  linkData,
                  extraJointsData
                });


                mechanism.removeLink(this.link.id);
                this.stateService.getMechanism().notifyChange();
              },
              disabled: false
            },
          );
        }

        return availableContext;

    }

  // Starts the click-capture interaction to add a force to this link
  private enterAddForceCaptureMode(modelPosAtRightClick: Coord): void {
    const capture = new CreateForceFromLinkCapture(this.link, modelPosAtRightClick, this.interactionService);
    capture.onClick$.subscribe((mousePos) => {
      this.stateService.getMechanism().addForceToLink(this.link.id, modelPosAtRightClick, mousePos);
      this.stateService.getMechanism().notifyChange();
    });
    this.interactionService.enterClickCapture(capture);
  }

  // Returns the link associated with this interactor
  public getLink(): Link {
        return this.link;
    }

  // Returns a string representation of this LinkInteractor
  public override toString(): string {
      return "LinkInteractor(" + this.link.name + ")";
  }

  // Returns the type identifier for this interactor
  public override type(): string{
      return "LinkInteractor"
  }

}
