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

  constructor(
    public override interactionService: InteractionService,
    private stateService: StateService,
    private colorService: ColorService,
    private svgPathService: SVGPathService,
    private unitConversionService: UnitConversionService
  ) {
    super(interactionService);
  }

  override registerInteractor(): Interactor {
    return new PositionInteractor(this.position, this.stateService);
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
    super.ngOnInit();
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

  getBCoord(): Coord {
    let b = this.unitConversionService.modelCoordToSVGCoord(
      this.position.getJoints()[1].coords
    );
    if (
      (this.position.angle >= 0 && this.position.angle < 90) ||
      this.position.angle > 270
    ) {
      b.x = b.x + 150;
    } else if (this.position.angle >= 90 && this.position.angle < 270) {
      b.x = b.x - 150;
    }
    return b;
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

  //Following two functions are used to set the X and Y coordinates of the lock SVG to be between the center and the rightmost joint
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

    return this.position.color; // Default color
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

  getLengthSVG(): string {
    const joints = this.position.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length - 1; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    return this.svgPathService.calculateLengthSVGPath(
      allCoords[0],
      allCoords[1],
      this.position.angle
    );
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

  getLeftLineSVG(): string {
    const joints = this.position.getJoints();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[0]._coords
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[1]._coords
    );

    const startOffset = 25;
    const endOffset = 25; // Added end offset for symmetry

    const dx = endCoord.x - startCoord.x;
    const dy = endCoord.y - startCoord.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return '';

    const midX = (startCoord.x + endCoord.x) / 2;
    const midY = (startCoord.y + endCoord.y) / 2;

    const unitX = dx / length;
    const unitY = dy / length;

    // First half: from shortened start to middle
    const shortenedStartX = startCoord.x + startOffset * unitX;
    const shortenedStartY = startCoord.y + startOffset * unitY;
    const leftX = startCoord.x + (midX - startCoord.x) * 0.9;
    const leftY = startCoord.y + (midY - startCoord.y) * 0.9;

    // Second half: from middle to shortened end
    const rightX = endCoord.x + (midX - endCoord.x) * 0.9;
    const rightY = endCoord.y + (midY - endCoord.y) * 0.9;
    const shortenedEndX = endCoord.x - endOffset * unitX;
    const shortenedEndY = endCoord.y - endOffset * unitY;

    // Return both line segments
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

    // Calculate the vector direction from start to end
    const dx = endCoord.x - startCoord.x;
    const dy = endCoord.y - startCoord.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return '';

    // Normalize the vector
    const unitX = dx / length;
    const unitY = dy / length;

    // Arrowhead size
    const arrowLength = 24;
    const arrowWidth = 12;
    const offsetFromJoint = 18;

    // First arrowhead at end joint
    const arrowTip1X = endCoord.x - offsetFromJoint * unitX;
    const arrowTip1Y = endCoord.y - offsetFromJoint * unitY;
    const arrow1X1 = arrowTip1X - arrowLength * unitX - arrowWidth * unitY;
    const arrow1Y1 = arrowTip1Y - arrowLength * unitY + arrowWidth * unitX;
    const arrow1X2 = arrowTip1X - arrowLength * unitX + arrowWidth * unitY;
    const arrow1Y2 = arrowTip1Y - arrowLength * unitY - arrowWidth * unitX;

    // Second arrowhead at start joint (pointing in opposite direction)
    const arrowTip2X = startCoord.x + offsetFromJoint * unitX;
    const arrowTip2Y = startCoord.y + offsetFromJoint * unitY;
    const arrow2X1 = arrowTip2X + arrowLength * unitX - arrowWidth * unitY;
    const arrow2Y1 = arrowTip2Y + arrowLength * unitY + arrowWidth * unitX;
    const arrow2X2 = arrowTip2X + arrowLength * unitX + arrowWidth * unitY;
    const arrow2Y2 = arrowTip2Y + arrowLength * unitY - arrowWidth * unitX;

    // Return both arrowheads as separate paths
    return `M${arrowTip1X},${arrowTip1Y} L${arrow1X1},${arrow1Y1} L${arrow1X2},${arrow1Y2} Z M${arrowTip2X},${arrowTip2Y} L${arrow2X1},${arrow2Y1} L${arrow2X2},${arrow2Y2} Z`;
  }

  getMaxY(): number {
    const joints = this.position.getJoints();
    let maxHeight = Number.MIN_SAFE_INTEGER;

    for (let i = 0; i < joints.length; i++) {
      if (joints[i].coords.y > maxHeight) {
        maxHeight = joints[i].coords.y;
      }
    }

    return this.unitConversionService.modelCoordToSVGCoord(
      new Coord(this.getCOMX(), maxHeight)
    ).y;
  }

  getLowestY(): number {
    let joints = this.position.getJoints();
    let y;
    //need to expand into loop to search all possible joints when moving to compound links
    if (joints[0].coords.y < joints[1].coords.y) {
      y = joints[0].coords.y;
    } else y = joints[1].coords.y;

    return this.unitConversionService.modelCoordToSVGCoord(
      new Coord(this.getCOMX(), y)
    ).y;
  }
}
