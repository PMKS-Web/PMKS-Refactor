import { Coord } from "../model/coord";
import { Link } from "../model/link";
import { Joint } from "../model/joint";
import { CompoundLink } from "../model/compound-link";
import { Mechanism } from "../model/mechanism";
import { StateService } from "../services/state.service";
import { ContextMenuOption, Interactor } from "./interactor";
import { NotificationService } from "../services/notification.service";
import type {CompoundLinkSnapshot, JointSnapshot, LinkSnapshot} from "../components/ToolBar/undo-redo-panel/action";
import {UndoRedoService} from "../services/undo-redo.service";

/*
This interactor defines the following behaviors:
- Dragging the Link moves it
*/

export class CompoundLinkInteractor extends Interactor {

    private jointsStartPosModel: Map<number, Coord> = new Map();
    private lastNotificationTime = 0;

    constructor(public compoundLink: CompoundLink, private stateService: StateService, private notificationService: NotificationService, private undoRedoService: UndoRedoService) {
        super(true, true);

        this.onDragStart$.subscribe(() => {
            if(this.stateService.getCurrentActivePanel === "Synthesis"){
                this.notificationService.showNotification("Cannot edit in the Synthesis mode! Switch to Edit mode to edit.");
                return;
              }
            this.compoundLink.links.forEach((link: Link) => {
                link.joints.forEach((joint: Joint, id: number) => {
                    this.jointsStartPosModel.set(id, joint._coords);
                });
            });
        });

        this.onDrag$.subscribe(() => {
            if (this.stateService.getCurrentActivePanel === "Analysis") {
                const now = Date.now();
                if (now - this.lastNotificationTime >= 3000) { // 3 seconds = 3000ms
                  this.notificationService.showNotification("Cannot edit in the Analysis mode! Switch to Edit mode to edit.");
                  this.lastNotificationTime = now;
                }
                return;
              }
            this.jointsStartPosModel.forEach((coord: Coord, jointID: number) => {
                this.stateService.getMechanism().setJointCoord(jointID, coord.add(this.dragOffsetInModel!))
            });
        });
        this.onDragEnd$.subscribe(() => {
            this.jointsStartPosModel.clear();
        });

        // if backspace, delete
        this.onKeyDown$.subscribe((event) => {
            if (event.key === "Backspace") {
                this.stateService.getMechanism().removeLink(this.compoundLink.id);
            }
        });

    }


    /**
     * Determines what options should be shown for the context menu when right clicking on a Link
     *
     * @returns
     */
    public override specifyContextMenu(): ContextMenuOption[] {

        let availableContext: ContextMenuOption[] = [];
        if (this.stateService.getCurrentActivePanel === "Synthesis"){
          this.notificationService.showNotification("Cannot edit in the Synthesis mode! Switch to Edit mode to edit.");
          return availableContext;
        }
        if (this.stateService.getCurrentActivePanel === "Analysis"){
            this.notificationService.showNotification("Cannot edit in the Analysis mode! Switch to Edit mode to edit.");
            return availableContext;
          }
        const mechanism: Mechanism = this.stateService.getMechanism();
        let modelPosAtRightClick = this.getMousePos().model;
        let svgPosAtRightClick = this.getMousePos().svg;
        availableContext.push(
            {
                icon: "assets/contextMenuIcons/addLink.svg",
                label: "Attach Link",
                action: () => { this.enterAddLinkCaptureMode() },
                disabled: false
            },
            {
                icon: "assets/contextMenuIcons/addTracer.svg",
                label: "Attach Tracer Point",
                action: () => {
                  // snapshot existing joint‐IDs
                  let beforeIds: number[] = [];
                  Array.from(this.compoundLink.links.values()).forEach((l) => {
                    Array.from(l.joints.keys()).forEach((jID) => {
                      beforeIds.push(jID);
                    })
                  });

                  mechanism.addTracerPointWelded(this.compoundLink.id, modelPosAtRightClick, svgPosAtRightClick)

                  // find exactly which joint is new
                  let afterIds: number[] = [];
                  Array.from(this.compoundLink.links.values()).forEach((l) => {
                    Array.from(l.joints.keys()).forEach((jID) => {
                      afterIds.push(jID);
                    })
                  });
                  const newId = afterIds.find((id) => !beforeIds.includes(id))!;
                  const newJoint = mechanism.getJoint(newId);
                  newJoint.isTracer = true;

                  // recordAction with a real jointId
                  this.undoRedoService.recordAction({
                    type: 'addTracerCompound',
                    linkTracerData: {
                      linkId: this.compoundLink.id,
                      jointId: newId,
                      coords: { x: newJoint.coords.x, y: newJoint.coords.y },
                      tracerModelPos: modelPosAtRightClick,
                      tracerSVGPos: svgPosAtRightClick,
                    }
                  });
                },
                disabled: false
            },
            {
                icon: "assets/contextMenuIcons/addForce.svg",
                label: "Attach Force",
                action: () => { this.enterAddForceCaptureMode() },
                disabled: false
            },
            {
                label: this.compoundLink.lock ? "Unlock Welded Link" : "Lock Welded Link",
                icon: this.compoundLink.lock ? "assets/contextMenuIcons/unlock.svg" : "assets/contextMenuIcons/lock.svg",
                action: () => { this.compoundLink.lock = (!this.compoundLink.lock) },
                disabled: false
            },
            {
                icon: "assets/contextMenuIcons/trash.svg",
                label: "Delete Welded Link",
                action: () => {

                  const compoundLinkData: CompoundLinkSnapshot = {
                    id: this.compoundLink.id,
                    linkIds: Array.from(this.compoundLink.links.values()).map((l) => l.id),
                    name: this.compoundLink.name,
                    mass: this.compoundLink.mass,
                    locked: this.compoundLink.lock,
                    color: this.compoundLink.color,
                  }

                  const linkData: LinkSnapshot[] = Array.from(
                    this.compoundLink.links.values()
                  ).map((l) => ({
                    id: l.id,
                    jointIds: Array.from(l.joints.values()).map((j) => j.id),
                    name: l.name,
                    mass: l.mass,
                    angle: l.angle,
                    locked: l.locked,
                    color: l.color,
                    isCircle: l.isCircle,
                  }));

                  let extraJointsData: JointSnapshot[][] = Array.from(
                    this.compoundLink.links.values()).map((l, index) => (
                    Array.from(
                      l.joints.values()
                    ).map((j) => ({
                      id: j.id,
                      coords: { x: j.coords.x, y: j.coords.y },
                      name: j.name,
                      type: j.type,
                      angle: j.angle,
                      isGrounded: j.isGrounded,
                      isWelded: j.isWelded,
                      isInput: j.isInput,
                      inputSpeed: j.speed,
                      locked: j.locked,
                      isHidden: j.hidden,
                      isReference: j.reference,
                      isTracer: j.isTracer,
                    }))
                  ));

                  this.undoRedoService.recordAction({
                    type:            "deleteCompoundLink",
                    compoundLinkData,
                    compoundExtraLinkData: linkData,
                    compoundExtraJointsData: extraJointsData,
                  });


                  mechanism.removeCompoundLinkByID(this.compoundLink.id)
                  this.stateService.getMechanism().notifyChange();

                },
                disabled: false
            },
        );

        return availableContext;

    }

    // Placeholder for logic to handle adding a link to this compound link
    private enterAddLinkCaptureMode(): void {}

    // Placeholder for logic to handle adding a force to this compound link
    private enterAddForceCaptureMode(): void {}

    // Returns a string representation for debugging
    public override toString(): string {
        return "CompoundLinkInteractor(" + this.compoundLink.name + ")";
    }

    // Returns the type identifier of this interactor
    public override type(): string{
        return "CompoundLinkInteractor"
    }

  // Returns the compound link associated with this interactor
    public getCompoundLink(): CompoundLink {
        return this.compoundLink;
    }

}
