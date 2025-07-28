import { Component, Input } from '@angular/core';
import { Position } from 'src/app/model/position';
import { Joint } from 'src/app/model/joint';
import { Coord } from 'src/app/model/coord';
import { StateService } from 'src/app/services/state.service';
import { Interactor } from 'src/app/controllers/interactor';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { InteractionService } from 'src/app/services/interaction.service';
import { PositionInteractor } from 'src/app/controllers/position-interactor';
import { ColorService } from 'src/app/services/color.service';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import { Subscription } from 'rxjs';
import { AnimationService } from 'src/app/services/animation.service';
import { UndoRedoService } from 'src/app/services/undo-redo.service';
import { LinkHoverState } from 'src/app/services/link-edit-hover.service';
import {
  PositionEditHoverService,
  PositionHoverState,
} from 'src/app/services/position-edit-hover.service';

@Component({
  selector: '[app-position]',
  templateUrl: './position.component.html',
  styleUrls: ['./position.component.css'],
})
export class PositionComponent extends AbstractInteractiveComponent {
  @Input() position!: Position;
  @Input() isHidden: boolean = false;
  unitSubscription: Subscription = new Subscription();
  angleSubscription: Subscription = new Subscription();
  units: string = 'cm';
  unitsAngle: string = 'º';
  hoverState: PositionHoverState = {
    isHoveringLength: false,
    isHoveringAngle: false,
  };

  constructor(
    public override interactionService: InteractionService,
    private stateService: StateService,
    private svgPathService: SVGPathService,
    private unitConversionService: UnitConversionService,
    public override animationService: AnimationService,
    private undoRedoService: UndoRedoService,
    private positionHoverService: PositionEditHoverService
  ) {
    super(interactionService, animationService);
  }

  override registerInteractor(): Interactor {
    return new PositionInteractor(
      this.position,
      this.stateService,
      this.undoRedoService
    );
  }

  override ngOnInit() {
    this.unitSubscription = this.stateService.globalUSuffixCurrent.subscribe(
      (units) => {
        this.units = units;
      }
    );
    this.angleSubscription = this.stateService.globalASuffixCurrent.subscribe(
      (angles) => {
        this.unitsAngle = angles;
      }
    );
    this.positionHoverService.hoverState$.subscribe((state) => {
      this.hoverState = state;
    });
    super.ngOnInit();
  }
  override ngOnDestroy(): void {
    this.positionHoverService.clearHover();
  }

  getColor(): string {
    return this.position.color;
  }

  getLocked(): boolean {
    return (
      this.position.locked &&
      this.stateService.getCurrentActivePanel === 'Synthesis'
    );
  }

  getCOMX(): number {
    return this.unitConversionService.modelCoordToSVGCoord(
      this.position.centerOfMass
    ).x;
  }

  getCOMY(): number {
    return this.unitConversionService.modelCoordToSVGCoord(
      this.position.centerOfMass
    ).y;
  }

  getAngleTextPosX(): number {
    let joints: IterableIterator<Joint> = this.position.joints.values();
    let allCoords: Coord[] = [];
    for (let joint of joints) {
      let coord: Coord = joint._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }
    let ang = (this.position.angle / 2) * (Math.PI / 180);
    let x = allCoords[0].x + 250 * Math.cos(ang);
    return new Coord(x, 0).x;
  }

  getAngleTextPosY(): number {
    let joints: IterableIterator<Joint> = this.position.joints.values();
    let allCoords: Coord[] = [];
    for (let joint of joints) {
      let coord: Coord = joint._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }
    let ang = (this.position.angle / 2) * (Math.PI / 180);
    let y = allCoords[0].y - 175 * Math.sin(ang);
    return new Coord(0, y).y;
  }

  getLockPositionX(): number {
    let x1 = this.position.getJoints()[2].coords.x;
    let x2 = this.position.getJoints()[1].coords.x;
    let y1 = this.position.getJoints()[2].coords.y;
    let y2 = this.position.getJoints()[1].coords.y;
    let x = (x1 + x2) / 2;
    let y = (y1 + y2) / 2;
    return this.unitConversionService.modelCoordToSVGCoord(new Coord(x, y)).x;
  }

  getLockPositionY(): number {
    let x1 = this.position.getJoints()[2].coords.x;
    let x2 = this.position.getJoints()[1].coords.x;
    let y1 = this.position.getJoints()[2].coords.y;
    let y2 = this.position.getJoints()[1].coords.y;
    let x = (x1 + x2) / 2;
    let y = (y1 + y2) / 2;
    return this.unitConversionService.modelCoordToSVGCoord(new Coord(x, y)).y;
  }

  getStrokeColor(): string {
    if (this.getInteractor().isSelected) {
      return '#FFCA28';
    } else if (this.isHovered()) {
      return '#FFECB3';
    }
    return this.position.color;
  }

  getLength(): string {
    if (this.isHidden) return '';
    else return this.position.length.toString() + ' ' + this.units;
  }

  getAngle(): string {
    return this.position.angle.toString();
  }

  getName(): string {
    if (this.isHidden) return '';
    else return this.position.name + '\n Angle: ' + this.position.angle;
  }

  getDrawnPath(): string {
    if (this.isHidden) {
      const hiddenJoints = this.position.joints.values();
      for (let joint of hiddenJoints) {
        joint.hidden = true;
      }
      return '';
    } else {
      const unhiddenJoints = this.position.getJoints();
      for (let i = 0; i < unhiddenJoints.length - 1; i++) {
        unhiddenJoints[i].hidden = false;
      }
      if (this.position.refPoint === 'Center') {
        unhiddenJoints[unhiddenJoints.length - 1].hidden = false;
      }
    }
    const radius: number = 30;
    const joints = this.position.getJoints();
    const allCoords: Coord[] = [];
    for (let i = 0; i < joints.length - 1; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }
    return this.svgPathService.getSinglePosDrawnPath(allCoords, radius);
  }

  getAngleSVG(): string {
    const joints = this.position.getJoints();
    const allCoords: Coord[] = [];
    for (let i = 0; i < joints.length; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }
    return this.svgPathService.calculateAngleSVGPath(
      allCoords[0],
      allCoords[1],
      this.position.angle
    );
  }

  getMidPointX(): number {
    const joints = this.position.getJoints();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[0]._coords
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[1]._coords
    );
    return (startCoord.x + endCoord.x) / 2;
  }

  getMidPointY(): number {
    const joints = this.position.getJoints();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[0]._coords
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[1]._coords
    );
    return (startCoord.y + endCoord.y) / 2;
  }

  getLeftLineSVG(): string {
    const joints = this.position.getJoints();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[0]._coords
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[1]._coords
    );
    const startOffset = 25;
    const endOffset = 25;
    const dx = endCoord.x - startCoord.x;
    const dy = endCoord.y - startCoord.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return '';
    const midX = (startCoord.x + endCoord.x) / 2;
    const midY = (startCoord.y + endCoord.y) / 2;
    const unitX = dx / length;
    const unitY = dy / length;
    const shortenedStartX = startCoord.x + startOffset * unitX;
    const shortenedStartY = startCoord.y + startOffset * unitY;
    const leftX = startCoord.x + (midX - startCoord.x) * 0.8;
    const leftY = startCoord.y + (midY - startCoord.y) * 0.8;
    const rightX = endCoord.x + (midX - endCoord.x) * 0.8;
    const rightY = endCoord.y + (midY - endCoord.y) * 0.8;
    const shortenedEndX = endCoord.x - endOffset * unitX;
    const shortenedEndY = endCoord.y - endOffset * unitY;
    return `M${shortenedStartX},${shortenedStartY} L${leftX},${leftY} M${rightX},${rightY} L${shortenedEndX},${shortenedEndY}`;
  }

  getDoubleArrowheadSVG(): string {
    const joints = this.position.getJoints();
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[1]._coords
    );
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[0]._coords
    );
    const dx = endCoord.x - startCoord.x;
    const dy = endCoord.y - startCoord.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return '';
    const unitX = dx / length;
    const unitY = dy / length;
    const arrowLength = 24;
    const arrowWidth = 12;
    const offsetFromJoint = 18;
    const arrowTip1X = endCoord.x - offsetFromJoint * unitX;
    const arrowTip1Y = endCoord.y - offsetFromJoint * unitY;
    const arrow1X1 = arrowTip1X - arrowLength * unitX - arrowWidth * unitY;
    const arrow1Y1 = arrowTip1Y - arrowLength * unitY + arrowWidth * unitX;
    const arrow1X2 = arrowTip1X - arrowLength * unitX + arrowWidth * unitY;
    const arrow1Y2 = arrowTip1Y - arrowLength * unitY - arrowWidth * unitX;
    const arrowTip2X = startCoord.x + offsetFromJoint * unitX;
    const arrowTip2Y = startCoord.y + offsetFromJoint * unitY;
    const arrow2X1 = arrowTip2X + arrowLength * unitX - arrowWidth * unitY;
    const arrow2Y1 = arrowTip2Y + arrowLength * unitY + arrowWidth * unitX;
    const arrow2X2 = arrowTip2X + arrowLength * unitX + arrowWidth * unitY;
    const arrow2Y2 = arrowTip2Y + arrowLength * unitY - arrowWidth * unitX;
    return `M${arrowTip1X},${arrowTip1Y} L${arrow1X1},${arrow1Y1} L${arrow1X2},${arrow1Y2} Z M${arrowTip2X},${arrowTip2Y} L${arrow2X1},${arrow2Y1} L${arrow2X2},${arrow2Y2} Z`;
  }

  getLowestY(): number {
    let joints = this.position.getJoints();
    let y;
    if (joints[0].coords.y < joints[1].coords.y) {
      y = joints[0].coords.y;
    } else y = joints[1].coords.y;
    return this.unitConversionService.modelCoordToSVGCoord(
      new Coord(this.getCOMX(), y)
    ).y;
  }
}
