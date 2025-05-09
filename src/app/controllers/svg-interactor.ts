import { Coord } from "../model/coord";
import { InteractionService } from "../services/interaction.service";
import { StateService } from "../services/state.service";
import { ContextMenuOption, Interactor } from "./interactor";
import { Mechanism } from "../model/mechanism";
import { CreateLinkFromGridCapture} from "./click-capture/create-link-from-grid-capture"
import { PanZoomService } from "../services/pan-zoom.service";
import {Subscription} from "rxjs";
import type { JointSnapshot, LinkSnapshot } from "../components/ToolBar/undo-redo-panel/action";


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
        let modelPosAtRightClick = this.interactionService.getMousePos().model;
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
      const mech = this.stateService.getMechanism();

      const beforeLinkIds  = mech.getArrayOfLinks().map(l => l.id);
      const beforeJointIds = mech.getArrayOfJoints().map(j => j.id);

      mech.addLink(modelPosAtRightClick, mousePos);

      const createdLink = mech.getArrayOfLinks().find(l => !beforeLinkIds.includes(l.id))!;

      const allJoints    = mech.getArrayOfJoints();
      const newJointIds  = allJoints.map(j => j.id)
        .filter(id => !beforeJointIds.includes(id));
      const extraJointsData: JointSnapshot[] = newJointIds.map(id => {
        const j = mech.getJoint(id)!;
        return {
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
        };
      });

      // snapshot the link
      const linkData: LinkSnapshot = {
        id:       createdLink.id,
        jointIds: createdLink.getJoints().map(j => j.id),
        name:     createdLink.name,
        mass:     createdLink.mass,
        angle:    createdLink.angle,
        locked:   createdLink.locked,
        color:    createdLink.color
      };

      this.stateService.recordAction({
        type:             'addLink',
        linkData,
        extraJointsData:  extraJointsData.length ? extraJointsData : undefined
      });

      mech.notifyChange();
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
