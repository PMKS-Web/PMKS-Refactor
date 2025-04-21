import { Coord } from "../model/coord";
import { Position } from "../model/position";
import { Joint } from "../model/joint";
import { Mechanism } from "../model/mechanism";
import { InteractionService } from "../services/interaction.service";
import { StateService } from "../services/state.service";
import { ContextMenuOption, Interactor } from "./interactor";

/*
This interactor defines the following behaviors:
- Dragging the Position moves it
*/

export class PositionInteractor extends Interactor {

  public jointsStartPosModel: Map<number, Coord> = new Map();

  constructor(public position: Position, private stateService: StateService,
              private interactionService: InteractionService) {
    super(true, true);

    this.onDragStart$.subscribe((event) => {

      this.position.joints.forEach((joint: Joint, id: number) => {
        this.jointsStartPosModel.set(id, joint._coords);
      });
    });

    this.onDrag$.subscribe((event) => {
      this.jointsStartPosModel.forEach((coord: Coord, jointID: number) => {
        const joint = this.position.joints.get(jointID);
        if (this.position.locked){
          this.stateService.getMechanism().setJointCoord(jointID, coord.add(this.dragOffsetInModel!));
        }
        else if (joint) {
          const wasLocked = joint.locked;
          joint.locked = false;
          this.stateService.getMechanism().setJointCoord(jointID, coord.add(this.dragOffsetInModel!));
          joint.locked = wasLocked;
        }
      });
    });

    this.onDragEnd$.subscribe((event) => {
      this.jointsStartPosModel.clear();
    });

    // this.onRightClick$.subscribe((event) => {
    //   this.showContextMenu(event);
    // });
  }

  /**
   * Determines what options should be shown for the context menu when right-clicking on a Position
   *
   * @returns
   */
  public override specifyContextMenu(): ContextMenuOption[] {
    let availableContext: ContextMenuOption[] = [];
    const mechanism: Mechanism = this.stateService.getMechanism();
    let modelPosAtRightClick = this.getMousePos().model;

    /*availableContext.push(
      {
        icon: this.position.locked ? "assets/contextMenuIcons/unlock.svg" : "assets/contextMenuIcons/lock.svg",
        label: this.position.locked ? "Unlock Position" : "Lock Position",
        action: () => { this.position.locked = !this.position.locked },
        disabled: false
      },
      {
        icon: "assets/contextMenuIcons/trash.svg",
        label: "Delete Position",
        action: () => { mechanism.removePosition(this.position.id) }, // Assuming removePosition exists
        disabled: false
      }
    );*/

    return availableContext;
  }

  public getPosition(): Position {
    return this.position;
  }

  public override toString(): string {
    return "PositionInteractor(" + this.position.name + ")";
  }

  public override type(): string {
    return "PositionInteractor";
  }
}
