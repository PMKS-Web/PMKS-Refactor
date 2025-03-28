import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input} from '@angular/core';
import { Link } from 'src/app/model/link';
import { Joint } from 'src/app/model/joint';
import { Coord } from 'src/app/model/coord';
import { Mechanism } from 'src/app/model/mechanism';
import { StateService } from 'src/app/services/state.service';
import { Interactor } from 'src/app/controllers/interactor';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { InteractionService } from 'src/app/services/interaction.service';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { ColorService } from 'src/app/services/color.service';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { UnitConversionService } from "src/app/services/unit-conversion.service";
import {Subscription} from "rxjs";

@Component({
  selector: '[app-link]',
  templateUrl: './link.component.html',
  styleUrls: ['./link.component.css'],
})
export class LinkComponent extends AbstractInteractiveComponent {
  @Input() link!: Link;
  unitSubscription: Subscription = new Subscription();
  angleSubscription: Subscription = new Subscription();
  showIDLabelsSubscription: Subscription = new Subscription();
  showIDLabels: boolean = false;
  units: string = "cm";
  unitsAngle: string = "º";
  angle: string = "0";

  constructor(
    public override interactionService: InteractionService,
    private stateService: StateService,
    private colorService: ColorService,
    private svgPathService: SVGPathService,
    private unitConversionService: UnitConversionService,
    private cdr: ChangeDetectorRef
  ) {
    super(interactionService);
  }

  override registerInteractor(): Interactor {
    return new LinkInteractor(this.link, this.stateService, this.interactionService);
  }

  override ngOnInit() {
    this.unitSubscription = this.stateService.globalUSuffixCurrent.subscribe((units) => { this.units = units; });
    this.angleSubscription = this.stateService.globalASuffixCurrent.subscribe((angles) => { this.unitsAngle = angles; });
    this.showIDLabelsSubscription = this.stateService.showIDLabels$.subscribe((show) => { this.showIDLabels = show; });
    super.ngOnInit();
  }

  override ngOnDestroy() {
    this.unitSubscription.unsubscribe();
    this.angleSubscription.unsubscribe();
    this.showIDLabelsSubscription.unsubscribe();
  }

  ngAfterContentChecked(): void {
    this.angle = this.link.angle.toFixed(3);
    this.cdr.detectChanges();
  }

  getColor():string{
	return this.link.color;
  }
  getLocked(): boolean{
    return this.link.locked;
  }

  getCOMX(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.link.centerOfMass).x;
  }
  getCOMY(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.link.centerOfMass).y;
  }

  getMaxY(): number {
    const joints = this.link.getJoints();
    let maxHeight = Number.MIN_SAFE_INTEGER;

    for (let i = 0; i < joints.length; i++){
      if (joints[i].coords.y > maxHeight) {
        maxHeight = joints[i].coords.y;
      }
    }

    return this.unitConversionService.modelCoordToSVGCoord(new Coord(this.getCOMX(), maxHeight)).y;
  }

  getBCoord(): Coord {
    let b = this.unitConversionService.modelCoordToSVGCoord(this.link.getJoints()[1].coords);
    if ((this.link.angle >= 0 && this.link.angle < 90) || this.link.angle > 270) {
      b.x = b.x + 150;
    }
    else if (this.link.angle >= 90 && this.link.angle < 270) {
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
    }
    else y = joints[1].coords.y;

    return this.unitConversionService.modelCoordToSVGCoord(new Coord(this.getCOMX(),y)).y;
  }

  //find way to position text so that it's next to the middle of the arc?
  getAngleTextPosX(): number {
    let joints: IterableIterator<Joint> = this.link.joints.values();
    let allCoords: Coord[] = [];
    for(let joint of joints){
      let coord: Coord = joint._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }
    let ang = (this.link.angle/2) * (Math.PI/180);

    let x = allCoords[0].x + 250 * Math.cos(ang);

    return new Coord(x,0).x;
  }

  getAngleTextPosY(): number {
    let joints: IterableIterator<Joint> = this.link.joints.values();
    let allCoords: Coord[] = [];
    for(let joint of joints){
      let coord: Coord = joint._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }
    let ang = (this.link.angle/2) * (Math.PI/180);

    let y = allCoords[0].y - 175 * Math.sin(ang);
    return new Coord(0,y).y;
  }

  //Following two functions are used to set the X and Y coordinates of the lock SVG to be between the center and the rightmost joint
  getLockPositionX(): number {
    let x1 = this.getCOMX();
    let x2 = this.link.getJoints()[1].coords.x;
    let y1 = this.getCOMY();
    let y2 = this.link.getJoints()[1].coords.y;
    let x = (x1 + x2)/2;
    let y = (y1 + y2)/2;

    return this.unitConversionService.modelCoordToSVGCoord(new Coord(x,y)).x;
  }

  getLockPositionY(): number {
    let x1 = this.getCOMX();
    let x2 = this.link.getJoints()[1].coords.x;
    let y1 = this.getCOMY();
    let y2 = this.link.getJoints()[1].coords.y;
    let x = (x1 + x2)/2;
    let y = (y1 + y2)/2;

    return this.unitConversionService.modelCoordToSVGCoord(new Coord(x,y)).y;
  }

  getStrokeColor(): string{
    if (this.getInteractor().isSelected) {
      return '#FFCA28'

    } else if(this.isHovered()){
      return '#FFECB3'
    }

    return this.link.color;

  }

  getLength(): string {
    return this.link.length.toString() + " " + this.units;
  }

  getAngle(): string {
    return this.link.angle.toString();
  }

  getName():string {
    return this.link.name + "\nLength: " + this.link.length + "\nAngle: " + this.link.angle;
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

  getLengthSVG(): string {
    const joints = this.link.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    return this.svgPathService.calculateLengthSVGPath(allCoords[0], allCoords[1], this.link.angle);
  }

  getAngleSVG(): string{
    const joints = this.link.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    return this.svgPathService.calculateAngleSVGPath(allCoords[0], allCoords[1], this.link.angle);
  }
}
