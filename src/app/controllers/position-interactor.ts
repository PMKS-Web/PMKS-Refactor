import { Coord } from "../model/coord";
import { Position } from "../model/position";
import { Joint } from "../model/joint";
import { StateService } from "../services/state.service";
import { ContextMenuOption, Interactor } from "./interactor";

/*
This interactor defines the following behaviors:
- Dragging the Position moves it
*/

export class PositionInteractor extends Interactor {

  public jointsStartPosModel: Map<number, Coord> = new Map();

  constructor(public position: Position, private stateService: StateService) {
    super(true, true);

    this.onDragStart$.subscribe(() => {

      this.position.joints.forEach((joint: Joint, id: number) => {
        this.jointsStartPosModel.set(id, joint._coords);
      });
    });

    this.onDrag$.subscribe(() => {
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

    this.onDragEnd$.subscribe(() => {
      this.jointsStartPosModel.clear();
    });

  }

  /**
   * Determines what options should be shown for the context menu when right-clicking on a Position
   *
   * @returns
   */
  public override specifyContextMenu(): ContextMenuOption[] {
    let availableContext: ContextMenuOption[] = [];
    this.stateService.getMechanism();
    this.getMousePos().model;
    return availableContext;
  }

  // Returns a string representation of this PositionInteractor
  public override toString(): string {
    return "PositionInteractor(" + this.position.name + ")";
  }

  // Returns the type identifier for this interactor
  public override type(): string {
    return "PositionInteractor";
  }
}
