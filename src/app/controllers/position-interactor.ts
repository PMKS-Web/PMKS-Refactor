import { Coord } from "../model/coord";
import { Position } from "../model/position";
import { Joint } from "../model/joint";
import { StateService } from "../services/state.service";
import { ContextMenuOption, Interactor } from "./interactor";

/**
 * This interactor defines the following behaviors:
 * - Dragging the Position moves it
 */
export class PositionInteractor extends Interactor {
  public jointsStartPosModel: Map<number, Coord> = new Map();
  private positionStartPositions = new Map<number, Coord>();

  constructor(public position: Position, private stateService: StateService) {
    super(true, true);

    this.onDragStart$.subscribe(() => {
      this.jointsStartPosModel.clear();
      this.positionStartPositions.clear();

      this.position.joints.forEach((joint: Joint, id: number) => {
        const startCoord = joint._coords.clone();
        this.jointsStartPosModel.set(id, startCoord);
        this.positionStartPositions.set(id, startCoord);
      });
    });

    this.onDrag$.subscribe(() => {
      this.jointsStartPosModel.forEach((coord: Coord, jointID: number) => {
        const joint = this.position.joints.get(jointID);
        if (this.position.locked) {
          this.stateService.getMechanism().setJointCoord(jointID, coord.add(this.dragOffsetInModel!));
        } else if (joint) {
          const wasLocked = joint.locked;
          joint.locked = false;
          this.stateService.getMechanism().setJointCoord(jointID, coord.add(this.dragOffsetInModel!));
          joint.locked = wasLocked;
        }
      });
    });

    this.onDragEnd$.subscribe(() => {
      const oldPositions = Array.from(this.positionStartPositions.entries()).map(
        ([jointId, coords]) => ({
          jointId,
          coords: { x: coords.x, y: coords.y },
        })
      );

      const newPositions = Array.from(this.position.joints.values()).map((j) => ({
        jointId: j.id,
        coords: { x: j._coords.x, y: j._coords.y },
      }));

      const moved = oldPositions.some((oldP) => {
        const newP = newPositions.find((n) => n.jointId === oldP.jointId)!;
        return (
          oldP.coords.x !== newP.coords.x || oldP.coords.y !== newP.coords.y
        );
      });

      if (moved) {
        this.stateService.recordAction({
          type: 'movePosition',
          linkId: this.position.id,
          oldJointPositions: oldPositions,
          newJointPositions: newPositions,
        });
      }

      this.jointsStartPosModel.clear();
      this.positionStartPositions.clear();
      this.stateService.getMechanism().notifyChange();
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