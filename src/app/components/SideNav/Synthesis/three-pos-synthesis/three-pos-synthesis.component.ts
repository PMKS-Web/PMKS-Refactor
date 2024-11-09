import {Component, Input, OnInit, OnChanges, Output, EventEmitter, numberAttribute, HostListener} from '@angular/core';
import { Interactor } from 'src/app/controllers/interactor';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { Link } from 'src/app/model/link';
import { Mechanism } from 'src/app/model/mechanism';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';
import { Joint } from 'src/app/model/joint';
import { ColorService } from 'src/app/services/color.service';
import { FormControl, FormGroup } from "@angular/forms";
import { LinkComponent } from 'src/app/components/Grid/link/link.component';
import { Coord } from 'src/app/model/coord';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChangeDetectorRef } from '@angular/core';
import {PositionSolverService} from "../../../../services/kinematic-solver.service";
import { DoCheck } from '@angular/core';
import {Position} from "../../../../model/position";
import {Subscription} from "rxjs";



interface CoordinatePosition {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  defined: boolean;
}
export class AppModule { }

@Component({
    selector: 'three-pos-synthesis',
    templateUrl: './three-pos-synthesis.component.html',
    styleUrls: ['./three-pos-synthesis.component.scss'],

})



export class ThreePosSynthesis{

  @Input() disabled: boolean = false;
  @Input() tooltip: string = '';
  @Input() input1Value: number = 0;
  @Input() label1: string = "Length";
  @Output() input1Change: EventEmitter<number> = new EventEmitter<number>();
  @Output() Generated: EventEmitter<boolean> = new EventEmitter<boolean>();

  sectionExpanded: { [key: string]: boolean } = { Basic: false };
  buttonLabel: string = 'Generate Four-Bar';
  reference: string = "Center";
  positions: number[] = [];
  couplerLength: number = 2;
  pos1X: number = 0;
  pos1Y: number = 0;
  pos1Angle: number = 0;
  pos1Specified: boolean = false;
  pos2X: number = -2.5;
  pos2Y: number = 0;
  pos2Angle: number = 0;
  pos2Specified: boolean = false;
  pos3X: number = 2.5;
  pos3Y: number = 0;
  pos3Angle: number = 0;
  pos3Specified: boolean = false;
  position1: Position | null = null;
  position2: Position | null = null;
  position3: Position | null = null;
  fourBarGenerated: boolean = false;
  sixBarGenerated: boolean = false;
  coord1A = new Coord(this.pos1X - this.couplerLength / 2, this.pos1Y);
  coord2A = new Coord(this.pos1X + this.couplerLength / 2, this.pos1Y);
  coord1B = new Coord(this.pos2X - this.couplerLength / 2, this.pos2Y);
  coord2B = new Coord(this.pos2X + this.couplerLength / 2, this.pos2Y);
  coord1C = new Coord(this.pos3X - this.couplerLength / 2, this.pos3Y);
  coord2C = new Coord(this.pos3X + this.couplerLength / 2, this.pos3Y);
  private mechanism: Mechanism;
  unitSubscription: Subscription = new Subscription();
  angleSubscription: Subscription = new Subscription();
  units: string = "cm";
  angles: string = "º";
  panelVisible = false;
  selectedOption: string = 'xy-angle';
  distance: number = 0;
  angle: number = 0;
  // New array for two-point mode, using the Position interface
  twoPointPositions: CoordinatePosition[] = [
    { x0: 0, y0: 0, x1: 0, y1: 0 , defined: false},
    { x0: 0, y0: 0, x1: 0, y1: 0, defined: false },
    { x0: 0, y0: 0, x1: 0, y1: 0,defined: false }
  ];

  constructor(private stateService: StateService, private interactionService: InteractionService, private cdr: ChangeDetectorRef, private positionSolver: PositionSolverService) {
    this.mechanism = this.stateService.getMechanism();
  }

  ngOnInit(){
    this.unitSubscription = this.stateService.globalUSuffixCurrent.subscribe((units) => {this.units = units;});
    this.angleSubscription = this.stateService.globalASuffixCurrent.subscribe((angles) => {this.angles = angles;});
  }

  ngDoCheck() {
    if (this.position1 && this.pos1Specified) {
      const newCoord = this.getNewCoord(this.position1);
      this.updatePositionCoords(1, newCoord);
      const angle = this.calculateAngle(this.position1.getJoints()[0], this.position1.getJoints()[1]);
      this.updatePositionAngle(1, angle);
    }
    if (this.position2 && this.pos2Specified) {
      const newCoord = this.getNewCoord(this.position2);
      this.updatePositionCoords(2, newCoord);
      const angle = this.calculateAngle(this.position2.getJoints()[0], this.position2.getJoints()[1]);
      this.updatePositionAngle(2, angle);
    }
    if (this.position3 && this.pos3Specified) {
      const newCoord = this.getNewCoord(this.position3);
      this.updatePositionCoords(3, newCoord);
      const angle = this.calculateAngle(this.position3.getJoints()[0], this.position3.getJoints()[1]);
      this.updatePositionAngle(3, angle);
    }
  }

setReference(r: string) {
    this.reference = r;
}

  toggleOption(selectedOption: string) {
    this.selectedOption = selectedOption;
  }

getReference(): string{
    return this.reference;
}

  specifyPosition(index: number) {
    if (index === 1) {
      this.pos1Specified = true;
      this.mechanism.addPos(this.coord1A, this.coord2A);
      const positions = this.mechanism.getArrayOfPositions();
      this.position1 = positions[positions.length - 1];
      this.position1.name = "Position 1";
    } else if (index === 2) {
      this.pos2Specified = true;
      this.mechanism.addPos(this.coord1B, this.coord2B);
      const positions = this.mechanism.getArrayOfPositions();
      this.position2 = positions[positions.length - 1];
      this.position2.name = "Position 2";
    } else if (index === 3) {
      this.pos3Specified = true;
      this.mechanism.addPos(this.coord1C, this.coord2C);
      const positions = this.mechanism.getArrayOfPositions();
      this.position3 = positions[positions.length - 1];
      this.position3.name = "Position 3";
    }
  }



  getNewCoord(position: Position): Coord {
    let joint: Joint;
    if (this.reference === "Back") {
      joint = position.getJoints()[0]; // First joint for "Back"
    } else if (this.reference === "Front") {
      joint = position.getJoints()[1]; // Second joint for "Front"
    } else if (this.reference === "Center") {
      const joints = position.getJoints();
      const joint1 = joints[0];
      const joint2 = joints[1];
      const centerX = (joint1.coords.x + joint2.coords.x) / 2;
      const centerY = (joint1.coords.y + joint2.coords.y) / 2;
      return new Coord(centerX, centerY);
    } else {
      // Default to "Back" if reference is not recognized
      joint = position.getJoints()[0];
    }
    return new Coord(joint.coords.x, joint.coords.y);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.position1 && this.pos1Specified) {
      const newCoord = this.getNewCoord(this.position1);
      this.updatePositionCoords(1, newCoord);
    }
    if (this.position2 && this.pos2Specified) {
      const newCoord = this.getNewCoord(this.position2);
      this.updatePositionCoords(2, newCoord);
    }
    if (this.position3 && this.pos3Specified) {
      const newCoord = this.getNewCoord(this.position3);
      this.updatePositionCoords(3, newCoord);
    }
  }

  updatePositionCoords(posNum: number, newCoord: Coord) {
    const roundedX = parseFloat(newCoord.x.toFixed(2));
    const roundedY = parseFloat(newCoord.y.toFixed(2));

    if (posNum === 1) {
      this.pos1X = roundedX;
      this.pos1Y = roundedY;
    } else if (posNum === 2) {
      this.pos2X = roundedX;
      this.pos2Y = roundedY;
    } else if (posNum === 3) {
      this.pos3X = roundedX;
      this.pos3Y = roundedY;
    }
    this.cdr.detectChanges();
  }

  calculateAngle(joint1: Joint, joint2: Joint): number {
    const deltaX = joint2.coords.x - joint1.coords.x;
    const deltaY = joint2.coords.y - joint1.coords.y;
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI); // Convert radians to degrees
    if (angle < 0) {
      angle += 360; // Normalize to 0-360
    }
    return angle;
  }

  updatePositionAngle(posNum: number, angle: number) {
    let normalizedAngle = angle % 360;
    if (normalizedAngle < 0) {
      normalizedAngle += 360;
    }
    const roundedAngle = Math.round(normalizedAngle);

    if (posNum === 1) {
      this.pos1Angle = roundedAngle;
    } else if (posNum === 2) {
      this.pos2Angle = roundedAngle;
    } else if (posNum === 3) {
      this.pos3Angle = roundedAngle;
    }
    this.cdr.detectChanges();
  }

resetPos(pos: number){
    if(pos==1){
        this.pos1Angle=0;
        this.pos1X=0;
        this.pos1Y=0;
    }
    else if(pos==2){
        this.pos2Angle=0;
        this.pos2X=-2.5;
        this.pos2Y=0;
    }
    else {
        this.pos3Angle=0;
        this.pos3X=2.5;
        this.pos3Y=0;
    }
}

isFourBarGenerated(): boolean {
    return this.fourBarGenerated;
}

isSixBarGenerated(): boolean {
    return this.sixBarGenerated;
  }
  getLastJoint(joints: IterableIterator<Joint>): Joint | undefined{
    let lastJoint: Joint | undefined;
    for (const joint of joints) {
      lastJoint = joint;
    }
    if (lastJoint !== undefined) {
      return lastJoint;
    }
    else
      return undefined;
  }


  // updateCords(){
  //   this.coord1A = new Coord(this.pos1X - this.couplerLength / 2, this.pos1Y);
  //   this.coord2A = new Coord(this.pos1X + this.couplerLength / 2, this.pos1Y);
  //   this.coord1B = new Coord(this.pos2X - this.couplerLength / 2, this.pos2Y);
  //   this.coord2B = new Coord(this.pos2X + this.couplerLength / 2, this.pos2Y);
  //   this.coord1C = new Coord(this.pos3X - this.couplerLength / 2, this.pos3Y);
  //   this.coord2C = new Coord(this.pos3X + this.couplerLength / 2, this.pos3Y);
  // }

  generateFourBar() {
    //Button changes to "clear four bar" when already generated, so remove mechanism
    if (this.fourBarGenerated) {
      let listOfLinks = this.mechanism.getArrayOfLinks();
      console.log(listOfLinks);
      let len;
      let i;
      for (i = 0, len = listOfLinks.length; i < len; i++) {
        let linkId = listOfLinks[i].id;
        console.log(linkId);
        this.mechanism.removeLink(linkId);
        console.log("LIST OF LINKS AFTER DELETION:");
        console.log(this.mechanism.getArrayOfLinks());
      }
      this.fourBarGenerated = false;
      this.Generated.emit(false);
    }
    else {
      let firstPoint = this.findIntersectionPoint(this.position1!.getJoints()[0]._coords, this.position2!.getJoints()[0]._coords, this.position3!.getJoints()[0]._coords);
      let secondPoint = this.position1!.getJoints()[0]._coords;
      let thirdPoint = this.position1!.getJoints()[1]._coords;
      let fourthPoint = this.findIntersectionPoint2(this.position1!.getJoints()[1]._coords, this.position2!.getJoints()[1]._coords, this.position3!.getJoints()[1]._coords);

      this.fourBarGenerated = !this.fourBarGenerated;
      this.Generated.emit(this.fourBarGenerated);
      this.cdr.detectChanges();

      this.mechanism.addLink(firstPoint, secondPoint);

      let joints = this.mechanism.getJoints(); //makes a list of all the joints in the mechanism
      let lastJoint = this.getLastJoint(joints);
      if (lastJoint !== undefined) {
        this.mechanism.addLinkToJoint(lastJoint.id, thirdPoint);
      }

      joints = this.mechanism.getJoints(); //updates list of all joints
      lastJoint = this.getLastJoint(joints);
      if (lastJoint !== undefined) {
        this.mechanism.addLinkToJoint(lastJoint.id, fourthPoint);
      }

      //adds the grounded joints and input

      //TO-DO get the location of the last joint in the joints array ans start th eindex from there because now we have joints in this array fromn the positions.!
      joints = this.mechanism.getJoints(); //instead of using it hard coded just do first and last on the list, we could do a getter for this.
      let index = 0;
      for (const joint of joints) {
        if (index === 6) { //using index so we arent dependent on ID of the joints
          joint.addGround();
          joint.addInput();
        }
        if (index === 9) {
          joint.addGround();
        }
        index++
      }
      this.positionSolver.solvePositions();
      this.verifyMechanismPath();
      console.log(this.positionSolver.getAnimationPositions());
      console.log(this.mechanism);
    }
  }

generateSixBar() {
  this.sixBarGenerated = !this.sixBarGenerated;
  /*if (this.buttonLabel === 'Generate Four-Bar') {
    this.buttonLabel = 'Clear Four-Bar';
  } else {
    this.buttonLabel = 'Generate Four-Bar';
  }
  */
  this.cdr.detectChanges();
}

//clearSixBar() {
    //this.sixBarGenerated = false;
  //}

setCouplerLength(x: number){
    if (x > 0) {

      this.couplerLength = x;
      if (this.reference === "Center") {
        if (this.position1) {
          const centerCoord = this.getNewCoord(this.position1);
          this.position1.setLength(this.couplerLength, this.position1.getJoints()[0]);
          this.setPosXCoord(centerCoord.x, 1);
          this.setPosYCoord(centerCoord.y, 1);
        }
        if (this.position2) {
          const centerCoord = this.getNewCoord(this.position2);
          this.position2.setLength(this.couplerLength, this.position2.getJoints()[0]);
          this.setPosXCoord(centerCoord.x, 2);
          this.setPosYCoord(centerCoord.y, 2);
        }
        if (this.position3) {
          const centerCoord = this.getNewCoord(this.position3);
          this.position3.setLength(this.couplerLength, this.position3.getJoints()[0]);
          this.setPosXCoord(centerCoord.x, 3);
          this.setPosYCoord(centerCoord.y, 3);
        }
      } else if (this.reference === "Back") {
        if (this.position1) {
          this.position1.setLength(this.couplerLength, this.position1.getJoints()[0]);
        }
        if (this.position2) {
          this.position2.setLength(this.couplerLength, this.position2.getJoints()[0]);
        }
        if (this.position3) {
          this.position3.setLength(this.couplerLength, this.position3.getJoints()[0]);
        }
      } else {
        if (this.position1) {
          this.position1.setLength(this.couplerLength, this.position1.getJoints()[1]);
        }
        if (this.position2) {
          this.position2.setLength(this.couplerLength, this.position2.getJoints()[1]);
        }
        if (this.position3) {
          this.position3.setLength(this.couplerLength, this.position3.getJoints()[1]);
        }
      }
    }
}

setPosXCoord(x: number, posNum: number) {
  if (posNum === 1) {
    this.pos1X = x;
    const backJoint = this.position1!.getJoints()[0];
    const frontJoint = this.position1!.getJoints()[1];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position1!);
      const distanceMoved = Math.abs(centerCoord.x - x);
      if (centerCoord.x < x){
        backJoint.setCoordinates(new Coord (backJoint.coords.x + distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x + distanceMoved, frontJoint.coords.y))
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x - distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x - distanceMoved, frontJoint.coords.y));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.x - x); //Find offset amt
      if (backJoint.coords.x < x){ //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x + distanceMoved, frontJoint.coords.y));
      }
      else {
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x - distanceMoved , frontJoint.coords.y));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.x - x);
      if (frontJoint.coords.x < x){
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x + distanceMoved, backJoint.coords.y));
      }
      else {
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x - distanceMoved, backJoint.coords.y));
      }
    }
  }

  else if (posNum === 2) {
    this.pos2X = x;
    const backJoint = this.position2!.getJoints()[0];
    const frontJoint = this.position2!.getJoints()[1];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position2!);
      const distanceMoved = Math.abs(centerCoord.x - x);
      if (centerCoord.x < x){
        backJoint.setCoordinates(new Coord (backJoint.coords.x + distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x + distanceMoved, frontJoint.coords.y))
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x - distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x - distanceMoved, frontJoint.coords.y));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.x - x); //Find offset amt
      if (backJoint.coords.x < x){ //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x + distanceMoved, frontJoint.coords.y));
      }
      else {
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x - distanceMoved , frontJoint.coords.y));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.x - x);
      if (frontJoint.coords.x < x){
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x + distanceMoved, backJoint.coords.y));
      }
      else {
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x - distanceMoved, backJoint.coords.y));
      }
    }
  }

  else if (posNum === 3) {
      this.pos3X = x;
    const backJoint = this.position3!.getJoints()[0];
    const frontJoint = this.position3!.getJoints()[1];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position3!);
      const distanceMoved = Math.abs(centerCoord.x - x);
      if (centerCoord.x < x){
        backJoint.setCoordinates(new Coord (backJoint.coords.x + distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x + distanceMoved, frontJoint.coords.y))
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x - distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x - distanceMoved, frontJoint.coords.y));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.x - x); //Find offset amt
      if (backJoint.coords.x < x){ //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x + distanceMoved, frontJoint.coords.y));
      }

      else {
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x - distanceMoved , frontJoint.coords.y));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.x - x);
      if (frontJoint.coords.x < x){
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x + distanceMoved, backJoint.coords.y));
      }
      else {
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x - distanceMoved, backJoint.coords.y));
      }
    }
  }
}

setPosYCoord(y: number, posNum: number){

  if(posNum === 1){
    this.pos1Y = y;
    const backJoint = this.position1!.getJoints()[0];
    const frontJoint = this.position1!.getJoints()[1];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position1!);
      const distanceMoved = Math.abs(centerCoord.y - y);
      if (centerCoord.y < y){
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y + distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y + distanceMoved))
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y - distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.y - y); //Find offset amt
      if (backJoint.coords.y < y){ //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y + distanceMoved));
      }

      else {
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.y - y);
      if (frontJoint.coords.y < y){
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y + distanceMoved));
      }
      else {
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y - distanceMoved));
      }
    }
  }

  else if(posNum === 2){
    const backJoint = this.position2!.getJoints()[0];
    const frontJoint = this.position2!.getJoints()[1];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position2!);
      const distanceMoved = Math.abs(centerCoord.y - y);
      if (centerCoord.y < y){
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y + distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y + distanceMoved))
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y - distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.y - y); //Find offset amt
      if (backJoint.coords.y < y){ //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y + distanceMoved));
      }
      else {
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.y - y);
      if (frontJoint.coords.y < y){
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y + distanceMoved));
      }
      else {
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y - distanceMoved));
      }
    }
  }

  else if (posNum === 3) {
    this.pos3Y = y;
    const backJoint = this.position3!.getJoints()[0];
    const frontJoint = this.position3!.getJoints()[1];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position3!);
      const distanceMoved = Math.abs(centerCoord.y - y);
      if (centerCoord.y < y){
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y + distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y + distanceMoved))
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y - distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.y - y); //Find offset amt
      if (backJoint.coords.y < y) { //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y + distanceMoved));
      } else {
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.y - y);
      if (frontJoint.coords.y < y) {
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y + distanceMoved));
      }
      else {
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y - distanceMoved));
      }
    }
  }
}

  setPositionAngle(angle: number, posNum: number) {
    const radians = angle * (Math.PI / 180); // Convert angle to radians

    if (posNum === 1 && this.position1) {
      this.pos1Angle = angle;
      const backJoint = this.position1.getJoints()[0];
      const frontJoint = this.position1.getJoints()[1];
      const referenceJoint = this.getReferenceJoint(this.position1);
      const centerX = referenceJoint.coords.x;
      const centerY = referenceJoint.coords.y;
      const halfLength = this.couplerLength / 2;

      if (this.reference === "Center") {
        backJoint.setCoordinates(new Coord(
          centerX - halfLength * Math.cos(radians),
          centerY - halfLength * Math.sin(radians)
        ));
        frontJoint.setCoordinates(new Coord(
          centerX + halfLength * Math.cos(radians),
          centerY + halfLength * Math.sin(radians)
        ));
      } else if (this.reference === "Back") {
        frontJoint.setCoordinates(new Coord(
          centerX + this.couplerLength * Math.cos(radians),
          centerY + this.couplerLength * Math.sin(radians)
        ));
      } else if (this.reference === "Front") {
        backJoint.setCoordinates(new Coord(
          centerX - this.couplerLength * Math.cos(radians),
          centerY - this.couplerLength * Math.sin(radians)
        ));
      }
    } else if (posNum === 2 && this.position2) {
      this.pos2Angle = angle;
      const backJoint = this.position2.getJoints()[0];
      const frontJoint = this.position2.getJoints()[1];
      const referenceJoint = this.getReferenceJoint(this.position2);
      const centerX = referenceJoint.coords.x;
      const centerY = referenceJoint.coords.y;
      const halfLength = this.couplerLength / 2;

      if (this.reference === "Center") {
        backJoint.setCoordinates(new Coord(
          centerX - halfLength * Math.cos(radians),
          centerY - halfLength * Math.sin(radians)
        ));
        frontJoint.setCoordinates(new Coord(
          centerX + halfLength * Math.cos(radians),
          centerY + halfLength * Math.sin(radians)
        ));
      } else if (this.reference === "Back") {
        frontJoint.setCoordinates(new Coord(
          centerX + this.couplerLength * Math.cos(radians),
          centerY + this.couplerLength * Math.sin(radians)
        ));
      } else if (this.reference === "Front") {
        backJoint.setCoordinates(new Coord(
          centerX - this.couplerLength * Math.cos(radians),
          centerY - this.couplerLength * Math.sin(radians)
        ));
      }
    } else if (posNum === 3 && this.position3) {
      this.pos3Angle = angle;
      const backJoint = this.position3.getJoints()[0];
      const frontJoint = this.position3.getJoints()[1];
      const referenceJoint = this.getReferenceJoint(this.position3);
      const centerX = referenceJoint.coords.x;
      const centerY = referenceJoint.coords.y;
      const halfLength = this.couplerLength / 2;

      if (this.reference === "Center") {
        backJoint.setCoordinates(new Coord(
          centerX - halfLength * Math.cos(radians),
          centerY - halfLength * Math.sin(radians)
        ));
        frontJoint.setCoordinates(new Coord(
          centerX + halfLength * Math.cos(radians),
          centerY + halfLength * Math.sin(radians)
        ));
      } else if (this.reference === "Back") {
        frontJoint.setCoordinates(new Coord(
          centerX + this.couplerLength * Math.cos(radians),
          centerY + this.couplerLength * Math.sin(radians)
        ));
      } else if (this.reference === "Front") {
        backJoint.setCoordinates(new Coord(
          centerX - this.couplerLength * Math.cos(radians),
          centerY - this.couplerLength * Math.sin(radians)
        ));
      }
    }
    this.cdr.detectChanges();
  }

  getReferenceJoint(position: Position): Joint {
    if (this.reference === "Back") {
      return position.getJoints()[0];
    } else if (this.reference === "Front") {
      return position.getJoints()[1];
    } else {
      const joints = position.getJoints();
      const joint1 = joints[0];
      const joint2 = joints[1];
      const centerX = (joint1.coords.x + joint2.coords.x) / 2;
      const centerY = (joint1.coords.y + joint2.coords.y) / 2;
      return new Joint(-1 /*Jav here, put this as placeholder id, idk if it needs to be something specific but we will see if something breaks */, new Coord(centerX, centerY));
    }
  }

getPosXCoord(posNum: number): number{
    if(posNum==1)
        return this.pos1X;
    else if(posNum==2)
        return this.pos2X;
    else
        return this.pos3X;
}

getPosYCoord(posNum: number): number{
    if(posNum==1)
        return this.pos1Y;
    else if(posNum==2)
        return this.pos2Y;
    else
        return this.pos3Y;
}

getPosAngle(posNum: number): number{
    if(posNum==1)
        return this.pos1Angle;
    else if(posNum==2)
        return this.pos2Angle;
    else
        return this.pos3Angle;
}


isPositionDefined(index: number): boolean {
    if(index==1){
        return this.pos1Specified;
    }
    if(index==2)
        return this.pos2Specified
    if(index==3)
        return this.pos3Specified;
    return false;
}

getFirstUndefinedPosition(): number{
    if(!this.pos1Specified){
        return 1;
    }
    if(!this.pos2Specified){
        return 2;}
    if(!this.pos3Specified){
        return 3;}
    return 0;
}



  deletePosition(index: number) {
    // Remove all links if the four-bar has been generated
    if (this.fourBarGenerated) {
      if (window.confirm("This action will delete the entire mechanism and all other coupler positions. Are you sure?")){
        this.removeAllPositions();
      }
    }

    else if (index === 1) {
      this.pos1Specified = false;
      this.mechanism.removePosition(this.position1!.id);
      this.resetPos(1);
    } else if (index === 2) {
      this.pos2Specified = false;
      this.mechanism.removePosition(this.position2!.id);
      this.resetPos(2);
    } else if (index === 3) {
      this.pos3Specified = false;
      this.mechanism.removePosition(this.position3!.id);
      this.resetPos(3);
    }
  }

allPositionsDefined(): boolean {
    if(this.pos1Specified && this.pos2Specified && this.pos3Specified)
        return true;
    else
        return false;
}

  removeAllPositions() {
    // Remove all links regardless of whether the four-bar has been generated
    let listOfLinks = this.mechanism.getArrayOfLinks();
    console.log(listOfLinks);
    let len;
    let i;
    for (i = 0, len = listOfLinks.length; i < len; i++) {
      let linkId = listOfLinks[i].id;
      console.log(linkId);
      this.mechanism.removeLink(linkId);
      console.log("LIST OF LINKS AFTER DELETION:");
      console.log(this.mechanism.getArrayOfLinks());
    }

    this.pos1Specified = false;
    this.mechanism.removePosition(this.position1!.id);
    this.resetPos(1);
    this.pos2Specified = false;
    this.mechanism.removePosition(this.position2!.id);
    this.resetPos(2);
    this.pos3Specified = false;
    this.mechanism.removePosition(this.position3!.id);
    this.resetPos(3);

    // Reset flags
    this.fourBarGenerated = false;
    this.sixBarGenerated = false;
    this.Generated.emit(false);
  }
  findIntersectionPoint(pose1_coord1: Coord, pose2_coord1: Coord, pose3_coord1: Coord) {
    //slope of Line 1
    let slope1 = 1 / ((pose2_coord1.y - pose1_coord1.y) / (pose2_coord1.x - pose1_coord1.x));
    //slope of line 2
    let slope2 = 1 / ((pose3_coord1.y - pose2_coord1.y) / (pose3_coord1.x - pose2_coord1.x));

    //midpoints of the above two lines
    let midpoint_line1 = new Coord(
      (pose1_coord1.x + pose2_coord1.x) / 2,
      (pose1_coord1.y + pose2_coord1.y) / 2
    );
    let midpoint_line2 = new Coord(
      (pose3_coord1.x + pose2_coord1.x) / 2,
      (pose3_coord1.y + pose2_coord1.y) / 2
    );

    //intercept
    let c1 = midpoint_line1.y + slope1 * midpoint_line1.x;
    let c2 = midpoint_line2.y + slope2 * midpoint_line2.x;

    //intersection point
    let x1 = (c1 - c2) / (-slope2 + slope1);
    let y1 = -slope1 * x1 + c1;

    return new Coord(x1, y1);
  }

  findIntersectionPoint2(pose1_coord2: Coord, pose2_coord2: Coord, pose3_coord2: Coord) {
    let slope1 = 1 / ((pose2_coord2.y - pose1_coord2.y) / (pose2_coord2.x - pose1_coord2.x));
    //slope of line 2
    let slope2 = 1 / ((pose3_coord2.y - pose2_coord2.y) / (pose3_coord2.x - pose2_coord2.x));

    //midpoints of the above two lines
    let midpoint_line1 = new Coord(
      (pose1_coord2.x + pose2_coord2.x) / 2,
      (pose1_coord2.y + pose2_coord2.y) / 2
    );
    let midpoint_line2 = new Coord(
      (pose3_coord2.x + pose2_coord2.x) / 2,
      (pose3_coord2.y + pose2_coord2.y) / 2
    );

    //intercept
    let c1 = midpoint_line1.y + slope1 * midpoint_line1.x;
    let c2 = midpoint_line2.y + slope2 * midpoint_line2.x;

    //intersection point
    let x1 = (c1 - c2) / (-slope2 + slope1);
    let y1 = -slope1 * x1 + c1;

    return new Coord(x1, y1);
  }
  verifyMechanismPath() {
    const threshold = 0.09;
    const userPositions = [this.position1, this.position2, this.position3];
    const animationPaths = this.positionSolver.getAnimationPositions();

    userPositions.forEach(position => {
      const positionCoords = position!.getJoints().map(joint => joint._coords);//converts positions joints into cords in a array
      let allMatched = true;

      for (const coord of positionCoords) {
        let jointMatched = false; //to check if both left and right joint pass throughh

        for (const path of animationPaths) {
          for (const pathPoint of path) {
            const distance = this.calculateDistance(coord, pathPoint);
            if (distance <= threshold) {
              jointMatched = true;
              break;
            }
          }
          if (jointMatched){
            break;
          }
        }

        if (!jointMatched) {
          allMatched = false;
          break;
        }
      }


      if (allMatched) {
        position!.setColor('green');
      } else {
        position!.setColor('red');
      }
    });
  }

  calculateDistance(coord1: Coord, coord2: Coord): number {
    const dx = coord1.x - coord2.x;
    const dy = coord1.y - coord2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getFirstUndefinedPositionEndPoints() :number {
      return this.twoPointPositions.findIndex(position => !position.defined )
      }

  specifyPositionEndPoints(index: number){
    console.log(index);
    if (index >= 0 && index < this.twoPointPositions.length) {
      this.twoPointPositions[index].defined = true;
    }
  }

  deletePositionTwoPoints(index:number){
    console.log("Delete Positions");
    if (index >= 0 && index < this.twoPointPositions.length) {
      this.twoPointPositions[index] = { x0: 0, y0: 0, x1: 0, y1: 0, defined: false };
    }
  }
  generateFourBarFromTwoPoints(): void {
    // Logic to generate a Four-Bar mechanism based on two points
    console.log(`Generating Four-Bar with distance: ${this.distance} cm and angle: ${this.angle}°`);

  }

  removeAllPositionsTwoPoints(): void {
    this.twoPointPositions.forEach(pos => {
      pos.defined = false;
      pos.x0 = 0;
      pos.y0 = 0;
      pos.x1 = 0;
      pos.y1 = 0;
    });
    console.log("All positions removed");
  }

  generateSixBarFromTwoPoints(): void {
    // Logic to generate a Four-Bar mechanism based on two points
    console.log(`Generating Six-Bar with distance: ${this.distance} cm and angle: ${this.angle}°`);

  }

}
