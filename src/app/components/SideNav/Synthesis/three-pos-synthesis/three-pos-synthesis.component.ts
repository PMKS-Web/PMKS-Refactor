import {
  Component,
  Input,
  OnInit,
  OnChanges,
  Output,
  EventEmitter,
  numberAttribute,
  HostListener,
  input
} from '@angular/core';
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
import {JointInteractor} from "../../../../controllers/joint-interactor";
import {Position} from "../../../../model/position";
import {Subscription} from "rxjs";


interface CoordinatePosition {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  defined: boolean;
}

interface lengthErrRecentPoint {
  x1: boolean;
  y1: boolean;
  x2: boolean;
  y2: boolean;
}

interface PositionLock {
  lockedLength: number;
  isLocked: boolean;
}

type CoordinateField = 'x0' | 'y0' | 'x1' | 'y1'; // Explicitly define valid keys

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
  reference: string = "Center";
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
  position1LengthErr: lengthErrRecentPoint = {x1: false, y1: false, x2: false, y2: false};
  position2LengthErr: lengthErrRecentPoint = {x1: false, y1: false, x2: false, y2: false};
  position3LengthErr: lengthErrRecentPoint = {x1: false, y1: false, x2: false, y2: false}; //To be used with End Points system, True if position x has a different length than position 1
  fourBarGenerated: boolean = false;
  sixBarGenerated: boolean = false;
  coord1A = new Coord(this.pos1X - this.couplerLength / 2, this.pos1Y);
  coord2A = new Coord(this.pos1X + this.couplerLength / 2, this.pos1Y);
  coord1B = new Coord(this.pos2X - this.couplerLength / 2, this.pos2Y);
  coord2B = new Coord(this.pos2X + this.couplerLength / 2, this.pos2Y);
  coord1C = new Coord(this.pos3X - this.couplerLength / 2, this.pos3Y);
  coord2C = new Coord(this.pos3X + this.couplerLength / 2, this.pos3Y);
  notifNeeded = false;
  recalcNeeded = false;
  unitSubscription: Subscription = new Subscription();
  angleSubscription: Subscription = new Subscription();
  panelSubscription: Subscription = new Subscription();
  units: string = "cm";
  angles: string = "º";
  panel: string = "Synthesis";
  synthedMech:Link[] = [];
  selectedOption: string = 'xy-angle';
  distance: number = 0;
  angle: number = 0;
  // New array for two-point mode, using the Position interface
  twoPointPositions: CoordinatePosition[] = [
    { x0: -1, y0: 0, x1: 1, y1: 0 , defined: false},
    { x0: -3.5, y0: 0, x1: -1.5, y1: 0, defined: false },
    { x0: 1.5, y0: 0, x1: 3.5, y1: 0,defined: false }
  ];
  isLengthLocked: boolean = false;
  showLockMessage: boolean = false;  // Controls the visibility of the message
  positionLocks: PositionLock[] = [
    { isLocked: false, lockedLength: 2 }, // Position 1
    { isLocked: false, lockedLength: 2 }, // Position 2
    { isLocked: false, lockedLength: 2 }  // Position 3
  ];
  // Flags to control placeholder visibility
  placeholderFlags : { [key: number]: { x0: boolean; y0: boolean; x1: boolean; y1: boolean } } = {};
  private mechanism: Mechanism;



  constructor(private stateService: StateService, private interactionService: InteractionService, private cdr: ChangeDetectorRef, private positionSolver: PositionSolverService) {
    this.mechanism = this.stateService.getMechanism();
  }

  ngOnInit(): void {
    this.lockCurrentJoint();
    this.unitSubscription = this.stateService.globalUSuffixCurrent.subscribe((units) => {this.units = units;});
    this.angleSubscription = this.stateService.globalASuffixCurrent.subscribe((angles) => {this.angles = angles;});

    this.twoPointPositions.forEach((_, index) => {
    this.placeholderFlags[index] = { x0: true, y0: true, x1: true, y1: true };
    });
    this.panelSubscription = this.stateService.globalActivePanelCurrent.subscribe((panel) => {
      this.panel = panel;
      this.sendNotif();
      this.changePosLocks();
    });
    this.mechanism._mechanismChange$.subscribe(() => this.checkForChange());
  }

  getMechanism(): Mechanism {
    return this.stateService.getMechanism();
  }

  getCurrentJoint() {
    let currentJointInteractor = this.interactionService.getSelectedObject();

    if (currentJointInteractor instanceof JointInteractor && this.panel === "Synthesis") {
    }
    return (currentJointInteractor as JointInteractor).getJoint();
  }

  lockCurrentJoint(): void {
    let currentJointInteractor = this.interactionService.getSelectedObject();

    if (currentJointInteractor instanceof JointInteractor && this.panel === "Synthesis") {
      currentJointInteractor.getJoint().locked = true;
    }
  }

  lockCurrentLink(): void {
    let currentLinkInteractor = this.interactionService.getSelectedObject();

    if (currentLinkInteractor instanceof LinkInteractor && this.panel === "Synthesis") {
      currentLinkInteractor.draggable = true;
      const joints = this.mechanism.getJoints();
      for (const joint of joints) {
        joint.locked = false;
      }
    }
  }

  ngDoCheck() {
    if (this.panel === "Synthesis") {
      this.lockCurrentJoint();
      this.lockCurrentLink();
    }
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

    // Dynamically update "End Points" panel
    if (this.position1 && this.pos1Specified) {
        this.updateEndPointPanel(1, this.position1);
    }
    if (this.position2 && this.pos2Specified) {
        this.updateEndPointPanel(2, this.position2);
    }
    if (this.position3 && this.pos3Specified) {
        this.updateEndPointPanel(3, this.position3);
    }
}

updateEndPointPanel(positionIndex: number, position: Position): void {
  const index = positionIndex - 1; // Adjust for zero-based indexing

  const backJoint = position.getJoints()[0];
  const frontJoint = position.getJoints()[1];

  // Update `twoPointPositions` with the current joint coordinates rounded to hundredths
  this.twoPointPositions[index].x0 = parseFloat(backJoint.coords.x.toFixed(2));
  this.twoPointPositions[index].y0 = parseFloat(backJoint.coords.y.toFixed(2));
  this.twoPointPositions[index].x1 = parseFloat(frontJoint.coords.x.toFixed(2));
  this.twoPointPositions[index].y1 = parseFloat(frontJoint.coords.y.toFixed(2));

  // Ensure Angular change detection picks up the updates
  this.cdr.detectChanges();
}



  setReference(r: string) {
      this.reference = r;
      if (this.position1){
        this.position1.setReference(this.reference);
        this.setPosXCoord(this.pos1X, 1);
        this.setPosYCoord(this.pos1Y, 1);
      }
      if (this.position2){
        this.position2.setReference(this.reference);
        this.setPosXCoord(this.pos2X, 2);
        this.setPosYCoord(this.pos2Y, 2);
      }
      if (this.position3){
        this.position3.setReference(this.reference);
        this.setPosXCoord(this.pos3X, 3);
        this.setPosYCoord(this.pos3Y, 3);
      }
  }

  toggleOption(selectedOption: string) {
    this.selectedOption = selectedOption;
  }

getReference(): string{
    return this.reference;
}

  checkForChange(): void {
    let found = false;
    for (let i: number = 0; i < this.synthedMech.length; i++){
      for (let j = 0; j < this.mechanism.getArrayOfLinks().length; j++){
        if (this.synthedMech[i].name === this.mechanism.getArrayOfLinks()[j].name){
          found = true
          break;
        }
        else found = false;
      }
      if (!found) {this.reset(); this.notifNeeded = false;}
    }
    if (found) this.notifNeeded = true;
  }

  sendNotif() {
    if (this.notifNeeded && this.panel === "Synthesis"){
      window.alert("Please recalculate position accuracy using the \"Evaluate Positions\" button.");
      this.recalcNeeded = true;
    }
    this.notifNeeded = false;
  }

  reset(): void {
    console.log("CALLED RESET")
    this.removeAllPositions();
    this.reference = "Center";
    this.couplerLength = 2;
  }

  changePosLocks(): void {
    if (this.panel === "Synthesis" && this.fourBarGenerated){
      if (this.position1 instanceof Position) {
        this.position1.locked = true;
      }
      if (this.position2 instanceof Position) {
        this.position2.locked = true;
      }
      if (this.position3 instanceof Position) {
        this.position3.locked = true;
      }
    }
    else {
      if (this.position1 instanceof Position) {
        this.position1.locked = false;
      }
      if (this.position2 instanceof Position) {
        this.position2.locked = false;
      }
      if (this.position3 instanceof Position) {
        this.position3.locked = false;
      }
    }
  }

  specifyPosition(index: number) {
    if (index === 1) {
      this.pos1Specified = true;
      this.mechanism.addPos(this.coord1A, this.coord2A);
      const positions = this.mechanism.getArrayOfPositions();
      this.position1 = positions[positions.length - 1];
      this.position1.name = "Position 1";
      this.setReference(this.reference);
    } else if (index === 2) {
      this.pos2Specified = true;
      this.mechanism.addPos(this.coord1B, this.coord2B);
      const positions = this.mechanism.getArrayOfPositions();
      this.position2 = positions[positions.length - 1];
      this.position2.name = "Position 2";
      this.setReference(this.reference);
      //if (this.position2.length !== this.position1?.length) { this.position2LengthErr = true; }
    } else if (index === 3) {
      this.pos3Specified = true;
      this.mechanism.addPos(this.coord1C, this.coord2C);
      const positions = this.mechanism.getArrayOfPositions();
      this.position3 = positions[positions.length - 1];
      this.position3.name = "Position 3";
      this.setReference(this.reference);
      //if (this.position3.length !== this.position1?.length) { this.position3LengthErr = true; }
    }
  }

  getNewCoord(position: Position): Coord {
    let joint: Joint;
    if (this.reference === "Back") {
      joint = position.getJoints()[0]; // First joint for "Back"
    } else if (this.reference === "Front") {
      joint = position.getJoints()[1]; // Second joint for "Front"
    } else if (this.reference === "Center") {
      joint = position.getJoints()[2];
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
    const roundedX = parseFloat(newCoord.x.toFixed(3));
    const roundedY = parseFloat(newCoord.y.toFixed(3));

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

    const roundedAngle = parseFloat(normalizedAngle.toFixed(3));

    if (posNum === 1) {
      this.pos1Angle = roundedAngle;
      this.position1!.angle = roundedAngle;
    } else if (posNum === 2) {
      this.pos2Angle = roundedAngle;
      this.position2!.angle = roundedAngle
    } else if (posNum === 3) {
      this.pos3Angle = roundedAngle;
      this.position3!.angle = roundedAngle
    }
    this.cdr.detectChanges();
  }

resetPos(pos: number){
    if(pos==1){
        this.pos1Angle=0;
        this.position1!.angle = 0;
        this.pos1X=0;
        this.pos1Y=0;
        this.twoPointPositions[0] = { x0: -1, y0: 0, x1: 1, y1: 0, defined: false };
    }
    else if(pos==2){
        this.pos2Angle=0;
        this.position2!.angle = 0;
        this.pos2X=-2.5;
        this.pos2Y=0;
        this.twoPointPositions[1] = { x0: -3.5, y0: 0, x1: -1.5, y1: 0, defined: false };
        this.position2LengthErr = {x1: false, y1: false, x2: false, y2: false};
    }
    else {
        this.pos3Angle=0;
        this.position3!.angle = 0;
        this.pos3X=2.5;
        this.pos3Y=0;
        this.twoPointPositions[2] = { x0: 1.5, y0: 0, x1: 3.5, y1: 0, defined: false };
        this.position3LengthErr = {x1: false, y1: false, x2: false, y2: false};
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
    //button changes to "clear four bar" when already generated, so remove mechanism
    if (this.fourBarGenerated) {
      let listOfLinks = this.synthedMech;
      console.log(listOfLinks);
      while (this.synthedMech.length > 0) {
        let linkId = this.synthedMech[0].id;
        console.log(linkId);
        this.synthedMech.splice(0, 1);
        this.mechanism.removeLink(linkId);
        this.position1!.locked = false;
        this.position2!.locked = false;
        this.position3!.locked = false;
        console.log("LIST OF LINKS AFTER DELETION:");
        console.log(this.mechanism.getArrayOfLinks());
      }
      /*for (i = 0, len = listOfLinks.length; i < len; i++) {
        let linkId = listOfLinks[i].id;
        console.log(linkId);
        this.synthedMech.splice(i);
        this.mechanism.removeLink(linkId);
        console.log("LIST OF LINKS AFTER DELETION:");
        console.log(this.mechanism.getArrayOfLinks());
      }*/
      this.setPositionsColorToDefault();
      this.mechanism.clearTrajectories();
      this.fourBarGenerated = false;
      this.synthedMech = [];
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

      this.mechanism.addLink(firstPoint, secondPoint, true);
      this.synthedMech.push(this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1]);

      let joints = this.mechanism.getJoints(); //makes a list of all the joints in the mechanism
      let lastJoint = this.getLastJoint(joints);
      if (lastJoint !== undefined) {
        this.mechanism.addLinkToJoint(lastJoint.id, thirdPoint, true);
        this.synthedMech.push(this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1]);
      }

      joints = this.mechanism.getJoints(); //updates list of all joints
      lastJoint = this.getLastJoint(joints);
      if (lastJoint !== undefined) {
        this.mechanism.addLinkToJoint(lastJoint.id, fourthPoint, true);
        this.synthedMech.push(this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1]);
      }

      //adds the grounded joints and input

      //TO-DO get the location of the last joint in the joints array ans start th eindex from there because now we have joints in this array fromn the positions.!
      joints = this.mechanism.getJoints(); //instead of using it hard coded just do first and last on the list, we could do a getter for this.
      let index = 0;
      for (const joint of joints) {
        if (index === 9) { //using index so we arent dependent on ID of the joints
          joint.addGround();
          joint.addInput();
        }
        if (index === 12) {
          joint.addGround();
        }
        index++
      }


      let arrayOfJoints = this.mechanism.getArrayOfJoints();
      arrayOfJoints[9].addGround();
      arrayOfJoints[9].addInput();
      arrayOfJoints[12].addGround();

      this.positionSolver.solvePositions();
      this.verifyMechanismPath();

      let initialGreenCount = this.mechanism.getArrayOfPositions().filter(position => position.color === 'green').length;

      if (initialGreenCount < 3) {//since is not the best we check the other input joint, to see of that gives better result
        arrayOfJoints[9].removeInput();
        arrayOfJoints[12].addInput();
        arrayOfJoints[9].addGround();

        this.positionSolver.solvePositions();
        this.verifyMechanismPath();
        let alternativeGreenCount = this.mechanism.getArrayOfPositions().filter(position => position.color === 'green').length;

        if (initialGreenCount >= alternativeGreenCount) { //go back to initial conf
          arrayOfJoints[12].removeInput();
          arrayOfJoints[9].addInput();
          arrayOfJoints[12].addGround();
        }
      }

      this.positionSolver.solvePositions();
      this.verifyMechanismPath();
      this.position1!.locked = true;
      this.position2!.locked = true;
      this.position3!.locked = true;
      console.log(this.positionSolver.getAnimationPositions());
      console.log(this.mechanism);
    }
  }

  generateSixBar() {
    this.sixBarGenerated = !this.sixBarGenerated;
    //clear the six-bar
    if (!this.sixBarGenerated) {
      let listOfLinks = this.synthedMech;
      console.log(listOfLinks);
      while (this.synthedMech.length > 0) {
        let linkId = this.synthedMech[0].id;
        console.log(linkId);
        this.synthedMech.splice(0, 1);
        this.mechanism.removeLink(linkId);
        this.position1!.locked = false;
        this.position2!.locked = false;
        this.position3!.locked = false;
        console.log("LIST OF LINKS AFTER DELETION:")
        console.log(this.mechanism.getArrayOfLinks());
      }
      this.setPositionsColorToDefault();
      this.mechanism.clearTrajectories();
      console.log("Six-bar has been cleared");
      this.cdr.detectChanges();
      return;
    }

    //change the inputs to ground
    const joints = this.mechanism.getJoints();
    for (const joint of joints) {
      if (joint.isInput) {
        joint.removeInput();
        joint.addGround();
      }
    }

    //find the ground and add a new link to that link
    const links = this.mechanism.getArrayOfLinks();
    let groundedLink: Link | null = null;

    for (const link of links) {
      const linkJoints = link.getJoints();
      let isGroundedLink = true;

      for (const joint of linkJoints) {
        if (joint.isInput) {
          isGroundedLink = false;
          break;
        }
      }
      if (isGroundedLink) {
        groundedLink = link;
        break;
      }
    }
    if (!groundedLink) {
      console.error("no grounded link");
      return;
    }

    const linkJoints = groundedLink.getJoints();
    const firstJoint = linkJoints[0];
    const attachPoint = firstJoint._coords;

    const adjustedAttachPoint = new Coord(attachPoint.x, attachPoint.y + 0.8);
    const newLinkEndCoord = new Coord(adjustedAttachPoint.x - 1.75, adjustedAttachPoint.y);
    this.mechanism.addLinkToLink(groundedLink.id, adjustedAttachPoint, newLinkEndCoord, true);
    this.synthedMech.push(this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1]);

    let newJoints = Array.from(this.mechanism.getJoints());
    let lastJoint = newJoints[newJoints.length - 1];

    const downwardLinkEndCoord = new Coord(lastJoint._coords.x, lastJoint._coords.y - 0.75);
    this.mechanism.addLinkToJoint(lastJoint.id, downwardLinkEndCoord, true);
    this.synthedMech.push(this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1]);

    newJoints = Array.from(this.mechanism.getJoints());
    lastJoint = newJoints[newJoints.length - 1];

    lastJoint.addGround();
    lastJoint.addInput();
    this.cdr.detectChanges();
    this.positionSolver.solvePositions();
    this.verifyMechanismPath();
  }

  setPositionsColorToDefault() {
    const positions = this.mechanism.getPositions();
    for (const position of positions) {
      position.setColor('#5E646D87');
    }
  }

setCouplerLength(x: number){
    if (x > 0) {

      this.couplerLength = x;
      if (this.reference === "Center") {
        if (this.position1) {
          const angle = this.pos1Angle;
          const halfLength = x/2;
          this.setPositionAngle(0, 1); //Make Position flat to perform calculation
          let joint1 = this.position1.getJoints()[0];
          let joint2 = this.position1.getJoints()[1];
          joint1.coords.x = joint1.coords.x - halfLength;
          joint2.coords.x = joint2.coords.x + halfLength; //Space outer two joints equidistant about the center of the position
          this.setPositionAngle(angle, 1); //Give position its original angle back
        }
        if (this.position2) {
          const angle = this.pos2Angle;
          const halfLength = x/2;
          this.setPositionAngle(0, 2); //Make Position flat to perform calculation
          let joint1 = this.position2.getJoints()[0];
          let joint2 = this.position2.getJoints()[1];
          joint1.coords.x = joint1.coords.x - halfLength;
          joint2.coords.x = joint2.coords.x + halfLength; //Space outer two joints equidistant about the center of the position
          this.setPositionAngle(angle, 2); //Give position its original angle back
        }
        if (this.position3) {
          const angle = this.pos1Angle;
          const halfLength = x/2;
          this.setPositionAngle(0, 3); //Make Position flat to perform calculation
          let joint1 = this.position3.getJoints()[0];
          let joint2 = this.position3.getJoints()[1];
          joint1.coords.x = joint1.coords.x - halfLength;
          joint2.coords.x = joint2.coords.x + halfLength; //Space outer two joints equidistant about the center of the position
          this.setPositionAngle(angle, 3); //Give position its original angle back
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
    //This can all be simplified into for loop w/ array for positions
  if (posNum === 1) {
    this.pos1X = x;
    const backJoint = this.position1!.getJoints()[0];
    const frontJoint = this.position1!.getJoints()[1];
    const midJoint = this.position1!.getJoints()[2]; //For reference point
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position1!);
      const distanceMoved = Math.abs(centerCoord.x - x);
      if (centerCoord.x < x){
        backJoint.setCoordinates(new Coord (backJoint.coords.x + distanceMoved, backJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x + distanceMoved, frontJoint.coords.y));

      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x - distanceMoved, backJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x - distanceMoved, midJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x - distanceMoved, frontJoint.coords.y));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.x - x); //Find offset amt
      if (backJoint.coords.x < x){ //if moving positive, add front by amount moved, and vice-versa
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x + distanceMoved, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y)); //Probably no longer needed as joints themselves are being set as references now
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
      }
      else {
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x - distanceMoved , frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x - distanceMoved, midJoint.coords.y));
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.x - x);
      if (frontJoint.coords.x < x){
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x + distanceMoved, backJoint.coords.y));
      }
      else {
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x - distanceMoved, midJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x - distanceMoved, backJoint.coords.y));
      }
    }
  }

  else if (posNum === 2) {
    this.pos2X = x;
    const backJoint = this.position2!.getJoints()[0];
    const frontJoint = this.position2!.getJoints()[1];
    const midJoint = this.position2!.getJoints()[2];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position2!);
      const distanceMoved = Math.abs(centerCoord.x - x);
      if (centerCoord.x < x){
        backJoint.setCoordinates(new Coord (backJoint.coords.x + distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x + distanceMoved, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y));
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x - distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x - distanceMoved, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x - distanceMoved, midJoint.coords.y));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.x - x); //Find offset amt
      if (backJoint.coords.x < x){ //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x + distanceMoved, frontJoint.coords.y));
      }
      else {
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x - distanceMoved, midJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x - distanceMoved , frontJoint.coords.y));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.x - x);
      if (frontJoint.coords.x < x){
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x + distanceMoved, backJoint.coords.y));
      }
      else {
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x - distanceMoved, midJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x - distanceMoved, backJoint.coords.y));
      }
    }
  }

  else if (posNum === 3) {
      this.pos3X = x;
    const backJoint = this.position3!.getJoints()[0];
    const frontJoint = this.position3!.getJoints()[1];
    const midJoint = this.position3!.getJoints()[2];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position3!);
      const distanceMoved = Math.abs(centerCoord.x - x);
      if (centerCoord.x < x){
        backJoint.setCoordinates(new Coord (backJoint.coords.x + distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x + distanceMoved, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y));
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x - distanceMoved, backJoint.coords.y));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x - distanceMoved, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x - distanceMoved, midJoint.coords.y));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.x - x); //Find offset amt
      if (backJoint.coords.x < x){ //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x + distanceMoved, frontJoint.coords.y));
      }

      else {
        backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x - distanceMoved, midJoint.coords.y));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x - distanceMoved , frontJoint.coords.y));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.x - x);
      if (frontJoint.coords.x < x){
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y));
        backJoint.setCoordinates(new Coord(backJoint.coords.x + distanceMoved, backJoint.coords.y));
      }
      else {
        frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x - distanceMoved, midJoint.coords.y));
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
    const midJoint = this.position1!.getJoints()[2];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position1!);
      const distanceMoved = Math.abs(centerCoord.y - y);
      if (centerCoord.y < y){
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y + distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y + distanceMoved));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y + distanceMoved));
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y - distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y - distanceMoved));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.y - y); //Find offset amt
      if (backJoint.coords.y < y){ //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y + distanceMoved));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y + distanceMoved));
      }

      else {
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y - distanceMoved));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.y - y);
      if (frontJoint.coords.y < y){
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y + distanceMoved));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y + distanceMoved));
      }
      else {
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y - distanceMoved));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y - distanceMoved));
      }
    }
  }

  else if(posNum === 2){
    const backJoint = this.position2!.getJoints()[0];
    const frontJoint = this.position2!.getJoints()[1];
    const midJoint = this.position2!.getJoints()[2];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position2!);
      const distanceMoved = Math.abs(centerCoord.y - y);
      if (centerCoord.y < y){
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y + distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y + distanceMoved));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y + distanceMoved));
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y - distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y - distanceMoved));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.y - y); //Find offset amt
      if (backJoint.coords.y < y){ //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y + distanceMoved));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y + distanceMoved));
      }
      else {
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y - distanceMoved));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.y - y);
      if (frontJoint.coords.y < y){
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y + distanceMoved));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y + distanceMoved));
      }
      else {
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y - distanceMoved));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y - distanceMoved));
      }
    }
  }

  else if (posNum === 3) {
    this.pos3Y = y;
    const backJoint = this.position3!.getJoints()[0];
    const frontJoint = this.position3!.getJoints()[1];
    const midJoint = this.position3!.getJoints()[2];
    if (this.reference === "Center") {
      let centerCoord = this.getNewCoord(this.position3!);
      const distanceMoved = Math.abs(centerCoord.y - y);
      if (centerCoord.y < y){
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y + distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y + distanceMoved));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y + distanceMoved));
      }
      else {
        backJoint.setCoordinates(new Coord (backJoint.coords.x, backJoint.coords.y - distanceMoved));
        frontJoint.setCoordinates(new Coord (frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y - distanceMoved));
      }
    }
    else if (this.reference === "Back") {
      const distanceMoved = Math.abs(backJoint.coords.y - y); //Find offset amt
      if (backJoint.coords.y < y) { //if moving positive, add front by amount moved, and vice-versa
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y + distanceMoved));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y + distanceMoved));
      } else {
        backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y - distanceMoved));
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, frontJoint.coords.y - distanceMoved));
      }
    }
    else {
      const distanceMoved = Math.abs(frontJoint.coords.y - y);
      if (frontJoint.coords.y < y) {
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y + distanceMoved));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y + distanceMoved));
      }
      else {
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x, midJoint.coords.y - distanceMoved));
        backJoint.setCoordinates(new Coord(backJoint.coords.x, backJoint.coords.y - distanceMoved));
      }
    }
  }
}

  setPositionAngle(angle: number, posNum: number) {
    const radians = angle * (Math.PI / 180); // Convert angle to radians

    if (posNum === 1 && this.position1) {
      this.pos1Angle = angle;
      this.position1.angle = angle;
      const backJoint = this.position1.getJoints()[0];
      const frontJoint = this.position1.getJoints()[1];
      const midJoint = this.position1.getJoints()[2];
      const referenceJoint = this.getReferenceJoint(this.position1);
      const centerX = referenceJoint.coords.x;
      const centerY = referenceJoint.coords.y;
      const halfLength = this.couplerLength / 2;

      if (this.reference === "Center") {
        backJoint.setCoordinates(new Coord(
          centerX - halfLength * Math.cos(radians),
          centerY - halfLength * Math.sin(radians)
        ));
        midJoint.setCoordinates(new Coord (centerX, centerY));
        frontJoint.setCoordinates(new Coord(
          centerX + halfLength * Math.cos(radians),
          centerY + halfLength * Math.sin(radians)
        ));
      } else if (this.reference === "Back") {
        frontJoint.setCoordinates(new Coord(
          centerX + this.couplerLength * Math.cos(radians),
          centerY + this.couplerLength * Math.sin(radians)
        ));
        midJoint.setCoordinates(new Coord (
          centerX + Math.cos(radians),
          centerY + Math.sin(radians)
        ));
      } else if (this.reference === "Front") {
        backJoint.setCoordinates(new Coord(
          centerX - this.couplerLength * Math.cos(radians),
          centerY - this.couplerLength * Math.sin(radians)
        ));
        midJoint.setCoordinates(new Coord (
          centerX - Math.cos(radians),
          centerY - Math.sin(radians)
        ));
      }
    } else if (posNum === 2 && this.position2) {
      this.pos2Angle = angle;
      this.position2.angle = angle;
      const backJoint = this.position2.getJoints()[0];
      const frontJoint = this.position2.getJoints()[1];
      const midJoint = this.position2.getJoints()[2];
      const referenceJoint = this.getReferenceJoint(this.position2);
      const centerX = referenceJoint.coords.x;
      const centerY = referenceJoint.coords.y;
      const halfLength = this.couplerLength / 2;

      if (this.reference === "Center") {
        backJoint.setCoordinates(new Coord(
          centerX - halfLength * Math.cos(radians),
          centerY - halfLength * Math.sin(radians)
        ));
        midJoint.setCoordinates(new Coord (centerX, centerY));
        frontJoint.setCoordinates(new Coord(
          centerX + halfLength * Math.cos(radians),
          centerY + halfLength * Math.sin(radians)
        ));
      } else if (this.reference === "Back") {
        frontJoint.setCoordinates(new Coord(
          centerX + this.couplerLength * Math.cos(radians),
          centerY + this.couplerLength * Math.sin(radians)
        ));
        midJoint.setCoordinates(new Coord (
          centerX + Math.cos(radians),
          centerY + Math.sin(radians)
        ));
      } else if (this.reference === "Front") {
        backJoint.setCoordinates(new Coord(
          centerX - this.couplerLength * Math.cos(radians),
          centerY - this.couplerLength * Math.sin(radians)
        ));
        midJoint.setCoordinates(new Coord (
          centerX - Math.cos(radians),
          centerY - Math.sin(radians)
        ));
      }
    } else if (posNum === 3 && this.position3) {
      this.pos3Angle = angle;
      this.position3.angle = angle;
      const backJoint = this.position3.getJoints()[0];
      const frontJoint = this.position3.getJoints()[1];
      const midJoint = this.position3.getJoints()[2];
      const referenceJoint = this.getReferenceJoint(this.position3);
      const centerX = referenceJoint.coords.x;
      const centerY = referenceJoint.coords.y;
      const halfLength = this.couplerLength / 2;

      if (this.reference === "Center") {
        backJoint.setCoordinates(new Coord(
          centerX - halfLength * Math.cos(radians),
          centerY - halfLength * Math.sin(radians)
        ));
        midJoint.setCoordinates(new Coord (centerX, centerY));
        frontJoint.setCoordinates(new Coord(
          centerX + halfLength * Math.cos(radians),
          centerY + halfLength * Math.sin(radians)
        ));
      } else if (this.reference === "Back") {
        frontJoint.setCoordinates(new Coord(
          centerX + this.couplerLength * Math.cos(radians),
          centerY + this.couplerLength * Math.sin(radians)
        ));
        midJoint.setCoordinates(new Coord (
          centerX + Math.cos(radians),
          centerY + Math.sin(radians)
        ));
      } else if (this.reference === "Front") {
        backJoint.setCoordinates(new Coord(
          centerX - this.couplerLength * Math.cos(radians),
          centerY - this.couplerLength * Math.sin(radians)
        ));
        midJoint.setCoordinates(new Coord (
          centerX - Math.cos(radians),
          centerY - Math.sin(radians)
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
    if (this.panel === "Synthesis"){
      let listOfLinks = this.synthedMech;
      console.log(listOfLinks);
      while (this.synthedMech.length > 0) {
        let linkId = this.synthedMech[0].id;
        console.log(linkId);
        this.synthedMech.splice(0, 1);
        this.mechanism.removeLink(linkId);
        console.log("LIST OF LINKS AFTER DELETION:");
        console.log(this.mechanism.getArrayOfLinks());
      }
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
    this.mechanism.clearTrajectories();

    // Reset flags
    this.fourBarGenerated = false;
    this.synthedMech = [];
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
      const positionCoords = position!.getJoints().slice(0, 2).map(joint => joint._coords); //map the joints into coords, cutting the reference joint out of the array
      let positionMatched = false; //to check if both left and right joint pass throughh

      for (const path of animationPaths) {
        const bothJointsMatched = positionCoords.every(coord => {
          return path.some(pathPoint => this.calculateDistance(coord, pathPoint) <= threshold);
        });

        if (bothJointsMatched) {
          positionMatched = true;
          break;
        }
      }


      if (positionMatched) {
        position!.setColor('green');
      } else {
        position!.setColor('red');
      }
    });
    this.recalcNeeded = false;
  }

  calculateDistance(coord1: Coord, coord2: Coord): number {
    const dx = coord1.x - coord2.x;
    const dy = coord1.y - coord2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  toggleLengthLock() {
    this.isLengthLocked = !this.isLengthLocked;

    // / Show the message when locking is activated
    if (this.isLengthLocked) {
      this.showLockMessage = true;

      // Hide the message after 5 seconds
      setTimeout(() => {
        this.showLockMessage = false;
      }, 5000);
    }

    // Update each position's lock state
    this.positionLocks.forEach((positionLock, index) => {
      positionLock.isLocked = this.isLengthLocked;
      positionLock.lockedLength = this.couplerLength; // Lock to current coupler length
      console.log(`Position ${index + 1} lock state:`, positionLock.isLocked);
    });

    this.cdr.detectChanges();
  }

  unlockPositions() {
    this.positionLocks.forEach(positionLock => {
      positionLock.isLocked = false;
    });
    console.log(this.positionLocks);
  }


  getFirstUndefinedPositionEndPoints() :number {
      return this.twoPointPositions.findIndex(position => !position.defined )
      }

  specifyPositionEndPoints(index: number){
    console.log(index);
    if (index >= 0) {
      this.twoPointPositions[index-1].defined = true;
      this.specifyPosition(index);
    }

    if (!this.placeholderFlags[index]) {
      this.placeholderFlags[index] = { x0: false, y0: false, x1: false, y1: false };
    } else {
      this.placeholderFlags[index].x0 = false;
      this.placeholderFlags[index].y0 = false;
      this.placeholderFlags[index].x1 = false;
      this.placeholderFlags[index].y1 = false;
    }
  }

  deletePositionTwoPoints(index:number){
    console.log("Delete Positions");
    if (index >= 0 && index < this.twoPointPositions.length) {
      this.twoPointPositions[index] = { x0: 0, y0: 0, x1: 0, y1: 0, defined: false };
    }
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

  // onPositionChange(): void {
  //   // Recalculate the positions based on the updated user input
  //   this.positionSolverService.solvePositions();
  //
  //   // Update the display on the grid
  //   const positions = this.positionSolverService.getAnimationPositions();
  //   positions.forEach((position) => {
  //     // Call your method to update the position on the grid
  //     this.interactionService.startDraggingObject(new Link(position)); // Adjust this part as necessary
  //   });
  // }



// Handles focus event to hide placeholder
  handleFocus(index: number, field: 'x0' | 'y0' | 'x1' | 'y1'): void {
    if (this.twoPointPositions[index][field] === 0) {
      this.twoPointPositions[index][field] = '' as any;
    }
  }


// Handles blur event to restore placeholder if input is empty
  handleBlur(index: number, field: 'x0' | 'y0' | 'x1' | 'y1'): void {
    const value = this.twoPointPositions[index][field];

    // Check if the value is empty or invalid
    if (value === null || value === undefined || `${value}` === '') {
      this.twoPointPositions[index][field] = 0;
      this.placeholderFlags[index][field] = true;
    } else {
      this.placeholderFlags[index][field] = false;
  }
  }

  handleInput(event: Event, index: number, coordType: 'x0' | 'y0' | 'x1' | 'y1'): void {
    const inputElement = event.target as HTMLInputElement;

    // Allow temporary empty or negative values
    const value = inputElement.value;

    if (value === '' || value === '-') {
        // Allow empty or negative sign temporarily
        this.twoPointPositions[index][coordType] = NaN; // Use NaN for invalid number state
    } else {
        // Parse and store valid numeric values
        const parsedValue = parseFloat(value);
        this.twoPointPositions[index][coordType] = isNaN(parsedValue) ? 0 : parsedValue;
    }
}

defaultToZero(index: number, coordType: 'x0' | 'y0' | 'x1' | 'y1'): void {
    const value = this.twoPointPositions[index][coordType];

    // Check for NaN (temporary invalid state) and reset to 0
    if (isNaN(value)) {
        this.twoPointPositions[index][coordType] = 0;
    }
}


  pipeToEndPoint(e: Event, posNum: number, endPoint: string) {
    let val = parseFloat((e.target as HTMLInputElement).value);
    switch (endPoint) {
      case "x1":
        this.setPosX1CoordEndPoints(parseFloat(val.toFixed(3)), posNum);
        break;
      case "y1":
        this.setPosY1CoordEndPoints(parseFloat(val.toFixed(3)), posNum);
        break;
      case "x2":
        this.setPosX2CoordEndPoints(parseFloat(val.toFixed(3)), posNum);
        break;
      case "y2":
        this.setPosY2CoordEndPoints(parseFloat(val.toFixed(3)), posNum);
        break;
    }

  }

  setPosX1CoordEndPoints(x: number, posNum: number) {
    switch (posNum){
      case 1:
        const x1 = this.position1!.getJoints()[0];
        const midjoint1 = this.position1!.getJoints()[2];
        x1.setCoordinates(new Coord(x, x1.coords.y));
        const centerCoord1 = this.getReferenceJoint(this.position1!);
        midjoint1.setCoordinates(centerCoord1.coords);
        if (this.position1!.length !== this.position2?.length && this.position2) { this.position2LengthErr = {x1: true, y1: false, x2: false, y2: false}; }
        else this.position2LengthErr = {x1: false, y1: false, x2: false, y2: false};
        if (this.position1!.length !== this.position3?.length && this.position3) { this.position3LengthErr = {x1: true, y1: false, x2: false, y2: false}; }
        else this.position3LengthErr = {x1: false, y1: false, x2: false, y2: false};
        break;
      case 2:
        const x2 = this.position2!.getJoints()[0];
        const midjoint2 = this.position2!.getJoints()[2];
        x2.setCoordinates(new Coord(x, x2.coords.y));
        const centerCoord2 = this.getReferenceJoint(this.position2!);
        midjoint2.setCoordinates(centerCoord2.coords);
        if (this.position2!.length !== this.position1?.length) { this.position2LengthErr = {x1: true, y1: false, x2: false, y2: false}; }
        else {this.position2LengthErr = {x1: false, y1: false, x2: false, y2: false};}
        break;
      case 3:
        const x3 = this.position3!.getJoints()[0];
        const midjoint3 = this.position3!.getJoints()[2];
        x3.setCoordinates(new Coord(x, x3.coords.y));
        const centerCoord3 = this.getReferenceJoint(this.position3!);
        midjoint3.setCoordinates(centerCoord3.coords);
        if (this.position3!.length !== this.position1?.length) { this.position3LengthErr = {x1: true, y1: false, x2: false, y2: false}; }
        else { this.position3LengthErr = {x1: false, y1: false, x2: false, y2: false};}
        break;
    }
  }

  setPosX2CoordEndPoints(x: number, posNum: number) {
    switch (posNum){
      case 1:
        const x1 = this.position1!.getJoints()[1];
        const midjoint1 = this.position1!.getJoints()[2];
        x1.setCoordinates(new Coord(x, x1.coords.y));
        const centerCoord1 = this.getReferenceJoint(this.position1!);
        midjoint1.setCoordinates(centerCoord1.coords);
        if (this.position1!.length !== this.position2?.length && this.position2) { this.position2LengthErr = {x1: false, y1: false, x2: true, y2: false}; }
        else this.position2LengthErr = {x1: false, y1: false, x2: false, y2: false};
        if (this.position1!.length !== this.position3?.length && this.position3) { this.position3LengthErr = {x1: false, y1: false, x2: true, y2: false}; }
        else this.position3LengthErr = {x1: false, y1: false, x2: false, y2: false};
        break;
      case 2:
        const x2 = this.position2!.getJoints()[1];
        const midjoint2 = this.position2!.getJoints()[2];
        x2.setCoordinates(new Coord(x, x2.coords.y));
        const centerCoord2 = this.getReferenceJoint(this.position2!);
        midjoint2.setCoordinates(centerCoord2.coords);
        if (this.position2!.length !== this.position1?.length) { this.position2LengthErr = {x1: false, y1: false, x2: true, y2: false}; }
        else {this.position2LengthErr = {x1: false, y1: false, x2: false, y2: false}; }
        break;
      case 3:
        const x3 = this.position3!.getJoints()[1];
        const midjoint3 = this.position3!.getJoints()[2];
        x3.setCoordinates(new Coord(x, x3.coords.y));
        const centerCoord3 = this.getReferenceJoint(this.position3!);
        midjoint3.setCoordinates(centerCoord3.coords);
        if (this.position3!.length !== this.position1?.length) { this.position3LengthErr = {x1: false, y1: false, x2: true, y2: false}; }
        else {this.position3LengthErr = {x1: false, y1: false, x2: false, y2: false}; }
        break;
    }
  }

  setPosY1CoordEndPoints(y: number, posNum: number) {
    switch (posNum){
      case 1:
        const y1 = this.position1!.getJoints()[0];
        const midjoint1 = this.position1!.getJoints()[2];
        y1.setCoordinates(new Coord(y1.coords.x, y));
        const centerCoord1 = this.getReferenceJoint(this.position1!);
        midjoint1.setCoordinates(centerCoord1.coords);
        if (this.position1!.length !== this.position2?.length && this.position2) { this.position2LengthErr = {x1: false, y1: true, x2: false, y2: false}; }
        else this.position2LengthErr = {x1: false, y1: false, x2: false, y2: false};
        if (this.position1!.length !== this.position3?.length && this.position3) { this.position3LengthErr = {x1: false, y1: true, x2: false, y2: false}; }
        else this.position3LengthErr = {x1: false, y1: false, x2: false, y2: false};
        break;
      case 2:
        const y2 = this.position2!.getJoints()[0];
        const midjoint2 = this.position2!.getJoints()[2];
        y2.setCoordinates(new Coord(y2.coords.x, y));
        const centerCoord2 = this.getReferenceJoint(this.position2!);
        midjoint2.setCoordinates(centerCoord2.coords);
        if (this.position2!.length !== this.position1?.length) { this.position2LengthErr = {x1: false, y1: true, x2: false, y2: false}; }
        else {this.position2LengthErr = {x1: false, y1: false, x2: false, y2: false}; this.position1LengthErr = {x1: false, y1: false, x2: false, y2: false}; }
        break;
      case 3:
        const y3 = this.position3!.getJoints()[0];
        const midjoint3 = this.position3!.getJoints()[2];
        y3.setCoordinates(new Coord(y3.coords.x, y));
        const centerCoord3 = this.getReferenceJoint(this.position3!);
        midjoint3.setCoordinates(centerCoord3.coords);
        if (this.position3!.length !== this.position1?.length) { this.position3LengthErr = {x1: false, y1: true, x2: false, y2: false}; }
        else {this.position3LengthErr = {x1: false, y1: false, x2: false, y2: false}; this.position1LengthErr = {x1: false, y1: false, x2: false, y2: false}; }
        break;
    }
  }

  setPosY2CoordEndPoints(y: number, posNum: number) {
    switch (posNum){
      case 1:
        const y1 = this.position1!.getJoints()[1];
        const midjoint1 = this.position1!.getJoints()[2];
        y1.setCoordinates(new Coord(y1.coords.x, y));
        const centerCoord1 = this.getReferenceJoint(this.position1!);
        midjoint1.setCoordinates(centerCoord1.coords);
        if (this.position1!.length !== this.position2?.length && this.position2) { this.position2LengthErr = {x1: false, y1: false, x2: false, y2: true}; }
        else this.position2LengthErr = {x1: false, y1: false, x2: false, y2: false};
        if (this.position1!.length !== this.position3?.length && this.position3) { this.position3LengthErr = {x1: false, y1: false, x2: false, y2: true}; }
        else this.position3LengthErr = {x1: false, y1: false, x2: false, y2: false};
        break;
      case 2:
        const y2 = this.position2!.getJoints()[1];
        const midjoint2 = this.position2!.getJoints()[2];
        y2.setCoordinates(new Coord(y2.coords.x, y));
        const centerCoord2 = this.getReferenceJoint(this.position2!);
        midjoint2.setCoordinates(centerCoord2.coords); //work
        if (this.position2!.length !== this.position1?.length) { this.position2LengthErr = {x1: false, y1: false, x2: false, y2: true}; }
        else {this.position2LengthErr = {x1: false, y1: false, x2: false, y2: false}; }
        break;
      case 3:
        const y3 = this.position3!.getJoints()[1];
        const midjoint3 = this.position3!.getJoints()[2];
        y3.setCoordinates(new Coord(y3.coords.x, y));
        const centerCoord3 = this.getReferenceJoint(this.position3!);
        midjoint3.setCoordinates(centerCoord3.coords);
        if (this.position3!.length !== this.position1?.length) { this.position3LengthErr = {x1: false, y1: false, x2: false, y2: true}; }
        else {this.position3LengthErr = {x1: false, y1: false, x2: false, y2: false}; }
        break;
    }
  }

  swapInputAndGround() {
    const mechanism: Mechanism = this.stateService.getMechanism();
    const joints = mechanism.getJoints();

    let inputJoint: Joint | undefined;
    let groundJoint: Joint | undefined;
    let otherGroundJoint: Joint | undefined;

    // Identify the input joint and the two ground joints
    for (const joint of joints) {
      if (joint.isInput) {
        inputJoint = joint;
      }
      if (joint.isGrounded) {
        if (!groundJoint) {
          groundJoint = joint; // First ground joint
        } else {
          otherGroundJoint = joint; // Second ground joint
        }
      }
    }

    if (inputJoint && groundJoint && otherGroundJoint) {
      console.log("Before Swap:");
      console.log("Input Joint:", inputJoint);
      console.log("Current Ground Joint:", groundJoint);
      console.log("Other Ground Joint:", otherGroundJoint);

      // Remove input from the current input joint
      inputJoint.removeInput();
      console.log("After removeInput, Input Joint:", inputJoint); // Debugging log

      // Check which ground joint currently has the input
      if (inputJoint === groundJoint) {
        // If the input joint was the current ground joint, add input to the other ground joint
        otherGroundJoint.addInput(); // Set the other ground joint as input
      } else {
        // If the input joint was not the current ground joint, add input to the current ground joint
        groundJoint.addInput(); // Set the current ground joint as input
      }

      console.log("After Swap:");
      console.log("Input Joint:", inputJoint);
      console.log("Current Ground Joint:", groundJoint);
      console.log("Other Ground Joint:", otherGroundJoint);
    } else {
      console.warn("Input or Ground Joint not found!");
    }
  }

  updateEndPointCoords(positionIndex: number, coordType: 'x0' | 'y0' | 'x1' | 'y1', value: number): void {
    // Validate position index
    if (positionIndex < 1 || positionIndex > 3) {
      console.error("Invalid position index. It must be 1, 2, or 3.");
      return;
    }

    const index = positionIndex - 1; // Convert 1-based index to 0-based
    this.twoPointPositions[index][coordType] = value;

    // Get the corresponding position object (e.g., position1, position2, position3)
    let position: Position | null = null;
    switch (positionIndex) {
      case 1:
        position = this.position1;
        break;
      case 2:
        position = this.position2;
        break;
      case 3:
        position = this.position3;
        break;
    }

    if (position) {
      const jointIndex = coordType === 'x0' || coordType === 'y0' ? 0 : 1; // Map coordType to joint index
      const joint = position.getJoints()[jointIndex];

      // Update the x or y coordinate of the joint
      if (coordType === 'x0' || coordType === 'x1') {
        joint.setCoordinates(new Coord(value, joint.coords.y));
      } else {
        joint.setCoordinates(new Coord(joint.coords.x, value));
      }

      // Update the center joint coordinates
      const centerCoord = this.getReferenceJoint(position);
      position.getJoints()[2].setCoordinates(centerCoord.coords);
    }

    // Trigger Angular change detection to reflect updates in the UI
    this.cdr.detectChanges();
  }

getEndPointCoords(positionIndex: number, coordType: 'x0' | 'y0' | 'x1' | 'y1'): number {
    // Validate position index
    if (positionIndex < 1 || positionIndex > 3) {
        console.error("Invalid position index. It must be 1, 2, or 3.");
        return 0; // Default value in case of invalid index
    }

    const index = positionIndex - 1; // Convert 1-based index to 0-based
    return this.twoPointPositions[index][coordType];
}


  generateFourBarFromTwoPoints(): void {
    // Logic to generate a Four-Bar mechanism based on two points
    console.log(`Generating Four-Bar with distance: ${this.distance} cm and angle: ${this.angle}°`);
    console.log('Current Values of Two Point Positions:', this.twoPointPositions);

  }

  generateSixBarFromTwoPoints(): void {
    // Logic to generate a Four-Bar mechanism based on two points
    console.log(`Generating Six-Bar with distance: ${this.distance} cm and angle: ${this.angle}°`);

  }

  getPositionLengthErrX1(pos: number): boolean {
    let retVal: boolean = false;
    switch (pos) {
      case 1:
        retVal = false;
        break;
      case 2:
        retVal = this.position2LengthErr.x1;
        break;
      case 3:
        retVal = this.position3LengthErr.x1;
    }
    return retVal;
  }

  getPositionLengthErrY1(pos: number): boolean {
    let retVal: boolean = false;
    switch (pos) {
      case 1:
        retVal = false;
        break;
      case 2:
        retVal = this.position2LengthErr.y1;
        break;
      case 3:
        retVal = this.position3LengthErr.y1;
    }
    return retVal;
  }

  getPositionLengthErrX2(pos: number): boolean {
    let retVal: boolean = false;
    switch (pos) {
      case 1:
        retVal = false;
        break;
      case 2:
        retVal = this.position2LengthErr.x2;
        break;
      case 3:
        retVal = this.position3LengthErr.x2;
    }
    return retVal;
  }

  getPositionLengthErrY2(pos: number): boolean {
    let retVal: boolean = false;
    switch (pos) {
      case 1:
        retVal = false;
        break;
      case 2:
        retVal = this.position2LengthErr.y2;
        break;
      case 3:
        retVal = this.position3LengthErr.y2;
    }
    return retVal;
  }

}
