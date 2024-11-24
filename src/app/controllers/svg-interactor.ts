import { Coord } from "../model/coord";
import { InteractionService } from "../services/interaction.service";
import { StateService } from "../services/state.service";
import { ContextMenuOption, Interactor } from "./interactor";
import { Mechanism } from "../model/mechanism";
import { CreateLinkFromGridCapture} from "./click-capture/create-link-from-grid-capture"
import { PanZoomService } from "../services/pan-zoom.service";
import {Subscription} from "rxjs";

/*
This handles any interaction with the SVG canvas.
*/

export class SvgInteractor extends Interactor {

    private lastSVGPosition: Coord | undefined;
    private activePanelSub = new Subscription();
    private activePanel = "Edit";
    constructor(private stateService: StateService,
        private interactionService: InteractionService, private panZoomService: PanZoomService) {
        super(true, true);

        this.onDragStart$.subscribe((event) => {
            this.lastSVGPosition = this.getMousePos().screen;
        });
        this.onDrag$.subscribe((event) => {
            let currentSVGPosition = this.getMousePos().screen;
            this.panZoomService._onSVGDrag(currentSVGPosition.subtract(this.lastSVGPosition!));
            this.lastSVGPosition = currentSVGPosition;
        });
        this.onDragEnd$.subscribe((event) => {
        });
      this.activePanelSub = this.stateService.globalActivePanelCurrent.subscribe((panel) => {this.activePanel = panel});
    }


    public override specifyContextMenu(): ContextMenuOption[] {
        const mechanism: Mechanism = this.stateService.getMechanism();
        let modelPosAtRightClick = this.getMousePos().model;
        let availableContext: ContextMenuOption[] = [];
        if (this.activePanel === "Edit") {
          availableContext.push({
            icon: "assets/contextMenuIcons/addLink.svg",
            label: "Create Link",
            action: () => {
              this.enterAddLinkCaptureMode(modelPosAtRightClick)
            },
            disabled: false
          });
        }

        return availableContext;
    }
    private enterAddLinkCaptureMode(modelPosAtRightClick: Coord): void {
        const capture = new CreateLinkFromGridCapture(modelPosAtRightClick, this.interactionService);
        capture.onClick$.subscribe((mousePos) => {
            this.stateService.getMechanism().addLink(modelPosAtRightClick, mousePos);
        });
        this.interactionService.enterClickCapture(capture);
    }

    public override toString(): string {
        return "SvgInteractor()";
    }
    public override type(): string{
        return "SVGInteractor"
    }

}
