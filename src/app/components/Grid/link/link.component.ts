import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
} from '@angular/core';
import { Link } from 'src/app/model/link';
import { Joint } from 'src/app/model/joint';
import { Coord } from 'src/app/model/coord';
import { StateService } from 'src/app/services/state.service';
import { Interactor } from 'src/app/controllers/interactor';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { InteractionService } from 'src/app/services/interaction.service';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { ColorService } from 'src/app/services/color.service';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import { Subscription } from 'rxjs';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: '[app-link]',
  templateUrl: './link.component.html',
  styleUrls: ['./link.component.css'],
})
export class LinkComponent
  extends AbstractInteractiveComponent
  implements AfterViewInit
{
  @Input() link!: Link;
  unitSubscription: Subscription = new Subscription();
  angleSubscription: Subscription = new Subscription();
  showIDLabelsSubscription: Subscription = new Subscription();
  showIDLabels: boolean = false;
  units: string = 'cm';
  unitsAngle: string = 'º';
  angle: string = '0';

  @HostListener('click')
  onClick() {
    this.stateService.hideIDLabels();
  }

  constructor(
    public override interactionService: InteractionService,
    private stateService: StateService,
    private notificationService: NotificationService,
    private svgPathService: SVGPathService,
    private unitConversionService: UnitConversionService,
    private cdr: ChangeDetectorRef
  ) {
    super(interactionService);
  }

  override registerInteractor(): Interactor {
    return new LinkInteractor(
      this.link,
      this.stateService,
      this.interactionService,
      this.notificationService
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
    this.showIDLabelsSubscription = this.stateService.showIDLabels$.subscribe(
      (show) => {
        this.showIDLabels = show;
      }
    );
    super.ngOnInit();
  }

  override ngOnDestroy() {
    this.unitSubscription.unsubscribe();
    this.angleSubscription.unsubscribe();
    this.showIDLabelsSubscription.unsubscribe();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.cdr.detectChanges();
    });
  }

  getColor(): string {
    return this.link.color;
  }
  getLocked(): boolean {
    return this.link.locked;
  }

  getCOMX(): number {
    return this.unitConversionService.modelCoordToSVGCoord(
      this.link.centerOfMass
    ).x;
  }
  getCOMY(): number {
    return this.unitConversionService.modelCoordToSVGCoord(
      this.link.centerOfMass
    ).y;
  }

  getMaxY(): number {
    const joints = this.link.getJoints();
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

  getBCoord(): Coord {
    let b = this.unitConversionService.modelCoordToSVGCoord(
      this.link.getJoints()[1].coords
    );
    if (
      (this.link.angle >= 0 && this.link.angle < 90) ||
      this.link.angle > 270
    ) {
      b.x = b.x + 150;
    } else if (this.link.angle >= 90 && this.link.angle < 270) {
      b.x = b.x - 150;
    }
    return b;
  }

  getLowestY(): number {
    let joints = this.link.getJoints();
    let y;
    //need to expand into loop to search all possible joints when moving to compound links
    if (joints[0].coords.y < joints[1].coords.y) {
      y = joints[0].coords.y;
    } else y = joints[1].coords.y;

    return this.unitConversionService.modelCoordToSVGCoord(
      new Coord(this.getCOMX(), y)
    ).y;
  }

  //find way to position text so that it's next to the middle of the arc?
  getAngleTextPosX(): number {
    let joints: IterableIterator<Joint> = this.link.joints.values();
    let allCoords: Coord[] = [];
    for (let joint of joints) {
      let coord: Coord = joint._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }
    let ang = (this.link.angle / 2) * (Math.PI / 180);

    let x = allCoords[0].x + 250 * Math.cos(ang);

    return new Coord(x, 0).x;
  }

  getAngleTextPosY(): number {
    let joints: IterableIterator<Joint> = this.link.joints.values();
    let allCoords: Coord[] = [];
    for (let joint of joints) {
      let coord: Coord = joint._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }
    let ang = (this.link.angle / 2) * (Math.PI / 180);

    let y = allCoords[0].y - 175 * Math.sin(ang);
    return new Coord(0, y).y;
  }

  //Following two functions are used to set the X and Y coordinates of the lock SVG to be between the center and the rightmost joint
  getLockPositionX(): number {
    let x1 = this.getCOMX();
    let x2 = this.link.getJoints()[1].coords.x;
    let y1 = this.getCOMY();
    let y2 = this.link.getJoints()[1].coords.y;
    let x = (x1 + x2) / 2;
    let y = (y1 + y2) / 2;

    return this.unitConversionService.modelCoordToSVGCoord(new Coord(x, y)).x;
  }

  getLockPositionY(): number {
    let x1 = this.getCOMX();
    let x2 = this.link.getJoints()[1].coords.x;
    let y1 = this.getCOMY();
    let y2 = this.link.getJoints()[1].coords.y;
    let x = (x1 + x2) / 2;
    let y = (y1 + y2) / 2;

    return this.unitConversionService.modelCoordToSVGCoord(new Coord(x, y)).y;
  }

  getMidPointX(): number {
    const joints = this.link.getJoints();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[0]._coords
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[1]._coords
    );

    return (startCoord.x + endCoord.x) / 2;
  }

  getMidPointY(): number {
    const joints = this.link.getJoints();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[0]._coords
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[1]._coords
    );

    return (startCoord.y + endCoord.y) / 2;
  }

  getLeftLineSVG(): string {
    const joints = this.link.getJoints();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[0]._coords
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[1]._coords
    );

    // Calculate midpoint
    const midX = (startCoord.x + endCoord.x) / 2;
    const midY = (startCoord.y + endCoord.y) / 2;

    // Shorten the line towards the middle by a fixed amount (e.g., 10 pixels or 10% of the total length)
    const offset = 10; // Adjust this value as needed

    const leftX = startCoord.x + (midX - startCoord.x) * 0.9; // Shorten the distance towards the middle
    const leftY = startCoord.y + (midY - startCoord.y) * 0.9;

    // Draw line from start to the shortened midpoint
    return `M${startCoord.x},${startCoord.y} L${leftX},${leftY}`;
  }

  getRightLineSVG(): string {
    const joints = this.link.getJoints();
    const startCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[0]._coords
    );
    const endCoord = this.unitConversionService.modelCoordToSVGCoord(
      joints[1]._coords
    );

    // Calculate midpoint
    const midX = (startCoord.x + endCoord.x) / 2;
    const midY = (startCoord.y + endCoord.y) / 2;

    // Shorten the line towards the middle by a fixed amount (e.g., 10 pixels or 10% of the total length)
    const offset = 10; // Adjust this value as needed

    const rightX = endCoord.x - (endCoord.x - midX) * 0.9; // Shorten the distance towards the middle
    const rightY = endCoord.y - (endCoord.y - midY) * 0.9;

    // Draw line from shortened midpoint to end
    return `M${rightX},${rightY} L${endCoord.x},${endCoord.y}`;
  }

  getUpperBoundSVG(): string {
    const joints = this.link.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    return `M ${allCoords[0].x}, ${allCoords[1].y} H ${allCoords[0].x + 300} `;
  }

  getLowerBoundSVG(): string {
    const joints = this.link.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    return `M ${allCoords[0].x}, ${allCoords[1].y} L ${allCoords[0].x}, ${allCoords[1].y} `;
  }

  getCurvedPathSVG(): string {
    const joints = this.link.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    const coord1 = allCoords[0];
    const coord2 = allCoords[1];

    let pathData = '';
    let d = Math.sqrt(
      (allCoords[1].x - allCoords[0].x) * (allCoords[1].x - allCoords[0].x) +
        (allCoords[1].y - allCoords[0].y) * (allCoords[1].y - allCoords[0].y)
    );
    let r = 150 / d;
    let angle = this.link.angle;

    if (angle < 180) {
      pathData += `M ${coord1.x + 150}, ${coord1.y} `; //Move to first coord
      //pathData += `M ${coord1.x}, ${coord1.y} `; //Move to first coord
      pathData += `A ${150} ${150} 0 0 0 ${(1 - r) * coord1.x + r * coord2.x} ${
        (1 - r) * coord1.y + r * coord2.y
      }`;
    } else if (angle >= 180) {
      pathData += `M ${coord1.x + 150}, ${coord1.y} `; //Move to first coord
      // pathData += `H ${coord1.x + 150} `; //Draw horizontal 25 units right
      pathData += `A ${150} ${150} 0 1 0 ${(1 - r) * coord1.x + r * coord2.x} ${
        (1 - r) * coord1.y * 0.9 + r * coord2.y * 0.9
      } `;
    }

    return pathData;
  }

  getStrokeColor(): string {
    if (this.getInteractor().isSelected) {
      return '#FFCA28';
    } else if (this.isHovered()) {
      return '#FFECB3';
    }

    return this.link.color;
  }

  getLength(): string {
    return this.link.length.toString() + ' ' + this.units;
  }

  getAngle(): string {
    return this.link.angle.toString();
  }

  getName(): string {
    return (
      this.link.name +
      '\nLength: ' +
      this.link.length +
      '\nAngle: ' +
      this.link.angle
    );
  }

  getDrawnPath(): string {
    let radius: number = 30;
    let joints: IterableIterator<Joint> = this.link.joints.values();
    let allCoords: Coord[] = [];
    for (let joint of joints) {
      let coord: Coord = joint._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }
    return this.svgPathService.getSingleLinkDrawnPath(allCoords, radius);
  }

  getLengthSVG() {
    const joints = this.link.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    document
      .getElementById('L')!
      .setAttribute(
        'd',
        this.svgPathService.calculateLengthSVGPath(
          allCoords[0],
          allCoords[1],
          this.link.angle
        )
      );
    //Hopefully deals with the Angular checking error

    //return this.svgPathService.calculateLengthSVGPath(allCoords[0], allCoords[1], this.link.angle);
  }

  getAngleSVG(): string {
    const joints = this.link.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    return this.svgPathService.calculateAngleSVGPath(
      allCoords[0],
      allCoords[1],
      this.link.angle
    );
  }
}
