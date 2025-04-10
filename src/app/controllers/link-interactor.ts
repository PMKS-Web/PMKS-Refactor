import { Coord } from "../model/coord";
import { Link } from "../model/link";
import { Joint } from "../model/joint";
import { Mechanism } from "../model/mechanism";
import { InteractionService } from "../services/interaction.service";
import { StateService } from "../services/state.service";
import { ClickCapture, ClickCaptureID } from "./click-capture/click-capture";
import { CreateLinkFromLinkCapture } from "./click-capture/create-link-from-link-capture";
import { CreateForceFromLinkCapture } from "./click-capture/create-force-from-link-capture";
import { ContextMenuOption, Interactor } from "./interactor";
import {Subscription} from "rxjs";

/*
This interactor defines the following behaviors:
- Dragging the Link moves it
*/

export class LinkInteractor extends Interactor {

    public jointsStartPosModel: Map<number, Coord> = new Map();
    private activePanelSub = new Subscription();
    private activePanel = "Edit";

    constructor(public link: Link, private stateService: StateService,
        private interactionService: InteractionService) {
        super(true, true);

        this.onDragStart$.subscribe((event) => {
            this.link.joints.forEach((joint: Joint,id: number) =>{
                this.jointsStartPosModel.set(id, joint._coords);
            })


        });
        this.onDrag$.subscribe((event) => {
            this.jointsStartPosModel.forEach((coord: Coord, jointID: number)=>{
                this.stateService.getMechanism().setJointCoord(jointID, coord.add(this.dragOffsetInModel!))
            });
        });
        this.onDragEnd$.subscribe((event) => {
            this.jointsStartPosModel.clear();
        });
        this.activePanelSub = this.stateService.globalActivePanelCurrent.subscribe((panel) => {this.activePanel = panel});
        /*
        // if backspace, delete
        this.onKeyDown$.subscribe((event) => {
            if (event.key === "Backspace") {
                this.stateService.getMechanism().removeLink(this.link.id);
            }
        });*/

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
                this.enterAddLinkCaptureMode(modelPosAtRightClick)
              },
              disabled: false
            },
            {
              icon: "assets/contextMenuIcons/addTracer.svg",
              label: "Attach Tracer Point",
              action: () => {
                mechanism.addJointToLink(this.link.id, modelPosAtRightClick)
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
                mechanism.removeLink(this.link.id)
              },
              disabled: false
            },
          );
        }

        return availableContext;

    }

    private enterAddLinkCaptureMode(modelPosAtRightClick: Coord): void {
        const capture = new CreateLinkFromLinkCapture(this.link, modelPosAtRightClick, this.interactionService);
        capture.onClick$.subscribe((mousePos) => {
            this.stateService.getMechanism().addLinkToLink(this.link.id,modelPosAtRightClick, mousePos);
        });
        this.interactionService.enterClickCapture(capture);
    }
    private enterAddForceCaptureMode(modelPosAtRightClick: Coord): void {
        const capture = new CreateForceFromLinkCapture(this.link, modelPosAtRightClick, this.interactionService);
        capture.onClick$.subscribe((mousePos) => {
            this.stateService.getMechanism().addForceToLink(this.link.id,modelPosAtRightClick, mousePos);
        });
        this.interactionService.enterClickCapture(capture);
    }

    public getLink(): Link {
        return this.link;
    }

    public override toString(): string {
        return "LinkInteractor(" + this.link.name + ")";
    }
    public override type(): string{
        return "LinkInteractor"
    }

}
