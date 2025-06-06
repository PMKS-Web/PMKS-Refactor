import { Coord } from "../model/coord";
import { Link } from "../model/link";
import { Joint } from "../model/joint";
import { CompoundLink } from "../model/compound-link";
import { Mechanism } from "../model/mechanism";
import { StateService } from "../services/state.service";
import { ContextMenuOption, Interactor } from "./interactor";
import { NotificationService } from "../services/notification.service";

/*
This interactor defines the following behaviors:
- Dragging the Link moves it
*/

export class CompoundLinkInteractor extends Interactor {

    private jointsStartPosModel: Map<number, Coord> = new Map();


    constructor(public compoundLink: CompoundLink, private stateService: StateService, private notificationService: NotificationService) {
        super(true, true);

        this.onDragStart$.subscribe(() => {
            this.compoundLink.links.forEach((link: Link) => {
                link.joints.forEach((joint: Joint, id: number) => {
                    this.jointsStartPosModel.set(id, joint._coords);
                });
            });
        });

        this.onDrag$.subscribe(() => {
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
        const mechanism: Mechanism = this.stateService.getMechanism();
        let modelPosAtRightClick = this.getMousePos().model;
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
                action: () => { mechanism.addJointToLink(this.compoundLink.id, modelPosAtRightClick) },
                disabled: false
            },
            {
                icon: "assets/contextMenuIcons/addForce.svg",
                label: "Attach Force",
                action: () => { this.enterAddForceCaptureMode() },
                disabled: false
            },
            {
                label: this.compoundLink.lock ? "Unlock Compound Link" : "Lock Compound Link",
                icon: this.compoundLink.lock ? "assets/contextMenuIcons/unlock.svg" : "assets/contextMenuIcons/lock.svg",
                action: () => { this.compoundLink.lock = (!this.compoundLink.lock) },
                disabled: false
            },
            {
                icon: "assets/contextMenuIcons/trash.svg",
                label: "Delete Link",
                action: () => { mechanism.removeLink(this.compoundLink.id) },
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
