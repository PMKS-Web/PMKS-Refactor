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
import {JointInteractor} from "../../../../controllers/joint-interactor";
import {Position} from "../../../../model/position";
import {Subscription} from "rxjs";




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
  notifNeeded = false;
  private mechanism: Mechanism;
  unitSubscription: Subscription = new Subscription();
  angleSubscription: Subscription = new Subscription();
  panelSubscription: Subscription = new Subscription();
  units: string = "cm";
  angles: string = "º";
  panel: string = "Synthesis";
  synthedMech:Link[] = [];
  positions  = [this.position1, this.position2, this.position3];
  xvals = [this.pos1X, this.pos2X, this.pos3X];
  yvals = [this.pos1Y, this.pos2Y, this.pos3Y];
  anglevals = [this.pos1Angle, this.pos2Angle, this.pos3Angle];

  constructor(private stateService: StateService, private interactionService: InteractionService, private cdr: ChangeDetectorRef, private positionSolver: PositionSolverService) {
    this.mechanism = this.stateService.getMechanism();
  }

  ngOnInit(): void {
    this.lockCurrentJoint();
    this.unitSubscription = this.stateService.globalUSuffixCurrent.subscribe((units) => {this.units = units;});
    this.angleSubscription = this.stateService.globalASuffixCurrent.subscribe((angles) => {this.angles = angles;});
    this.panelSubscription = this.stateService.globalActivePanelCurrent.subscribe((panel) => {this.panel = panel; this.sendNotif()});
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
      window.alert("Please recalculate position accuracy using the \"Recalculate Positions\" button.");
    }
    this.notifNeeded = false;
  }

  reset(): void {
    console.log("CALLED RESET")
    this.removeAllPositions();
    this.reference = "Center";
    this.couplerLength = 2;

  }

  specifyPosition(index: number) {
    if (index === 1) {
      this.pos1Specified = true;
      this.mechanism.addPos(this.coord1A, this.coord2A);
      const positions = this.mechanism.getArrayOfPositions();
      this.position1 = positions[positions.length - 1];
      this.position1.name = "Position 1";
      this.position1.setReference(this.reference);
    } else if (index === 2) {
      this.pos2Specified = true;
      this.mechanism.addPos(this.coord1B, this.coord2B);
      const positions = this.mechanism.getArrayOfPositions();
      this.position2 = positions[positions.length - 1];
      this.position2.name = "Position 2";
      this.position2.setReference(this.reference);
    } else if (index === 3) {
      this.pos3Specified = true;
      this.mechanism.addPos(this.coord1C, this.coord2C);
      const positions = this.mechanism.getArrayOfPositions();
      this.position3 = positions[positions.length - 1];
      this.position3.name = "Position 3";
      this.position3.setReference(this.reference);
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
      angle += 360;
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
    //button changes to "clear four bar" when already generated, so remove mechanism
    if (this.fourBarGenerated) {
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
      /*for (i = 0, len = listOfLinks.length; i < len; i++) {
        let linkId = listOfLinks[i].id;
        console.log(linkId);
        this.synthedMech.splice(i);
        this.mechanism.removeLink(linkId);
        console.log("LIST OF LINKS AFTER DELETION:");
        console.log(this.mechanism.getArrayOfLinks());
      }*/
      this.setPositionsColorToDefault()
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
        console.log("LIST OF LINKS AFTER DELETION:");
        console.log(this.mechanism.getArrayOfLinks());
      }
      this.setPositionsColorToDefault();
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
          this.position1.getJoints()[2].setCoordinates(centerCoord);
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
        frontJoint.setCoordinates(new Coord(frontJoint.coords.x + distanceMoved, frontJoint.coords.y));
        midJoint.setCoordinates(new Coord (midJoint.coords.x + distanceMoved, midJoint.coords.y));
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
      let len;
      let i;
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
      const nonCenter = position!.getJoints().slice(0,2)
      const positionCoords = nonCenter.map(joint => joint._coords);//converts positions joints into coords in a array
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

}
