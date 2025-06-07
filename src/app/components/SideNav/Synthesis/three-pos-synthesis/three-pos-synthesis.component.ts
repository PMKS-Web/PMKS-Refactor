import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener
} from '@angular/core';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { Link } from 'src/app/model/link';
import { Mechanism } from 'src/app/model/mechanism';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';
import { Joint } from 'src/app/model/joint';
import { Coord } from 'src/app/model/coord';
import { ChangeDetectorRef } from '@angular/core';
import {PositionSolverService} from "../../../../services/kinematic-solver.service";
import {Position} from "../../../../model/position";
import { NotificationService } from 'src/app/services/notification.service';


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
// Explicitly define valid keys
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
  recalcNeeded = false;
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
  private readonly mechanism: Mechanism;



  constructor(private stateService: StateService, private interactionService: InteractionService, private cdr: ChangeDetectorRef, private positionSolver: PositionSolverService, private notificationService: NotificationService) {
    this.mechanism = this.stateService.getMechanism();
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
  onMouseMove() {
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
      this.sixBarGenerated = false;
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
      let firstGround = this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1].getJoints()[0];
      this.synthedMech.push(this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1]);

      let joints = this.mechanism.getJoints(); //makes a list of all the joints in the mechanism
      let lastJoint = this.getLastJoint(joints);
      if (lastJoint !== undefined) {
        this.mechanism.addLinkToJoint(lastJoint.id, thirdPoint, true);
        this.synthedMech.push(this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1]);
      }

      joints = this.mechanism.getJoints(); //updates list of all joints
      lastJoint = this.getLastJoint(joints);
      let lastGround;
      if (lastJoint !== undefined) {
        this.mechanism.addLinkToJoint(lastJoint.id, fourthPoint, true);
        lastGround = this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1].getJoints()[1];
        this.synthedMech.push(this.mechanism.getArrayOfLinks()[this.mechanism.getArrayOfLinks().length - 1]);
      }

      //adds the grounded joints and input

      //TO-DO get the location of the last joint in the joints array ans start th eindex from there because now we have joints in this array fromn the positions.!
      this.mechanism.getJoints(); //instead of using it hard coded just do first and last on the list, we could do a getter for this.
      /*for (const joint of joints) {
              if (index === 9) { //using index so we arent dependent on ID of the joints
                joint.addGround();
                joint.addInput();
              }
              if (index === 12) {
                joint.addGround();
              }
              index++
            }*/

      firstGround.addGround();
      firstGround.addInput();
      lastGround!.addGround();

      /*let arrayOfJoints = this.mechanism.getArrayOfJoints();
      arrayOfJoints[9].addGround();
      arrayOfJoints[9].addInput();
      arrayOfJoints[12].addGround();*/

      this.positionSolver.solvePositions();
      this.verifyMechanismPath();

      const inputLink = this.synthedMech[0];
      const linkInteractor = new LinkInteractor(
        inputLink,
        this.stateService,
        this.interactionService,
        this.notificationService,
      );
      this.interactionService.setSelectedObject(linkInteractor);
      this.stateService.getAnimationBarComponent()?.updateTimelineMarkers();

      let initialGreenCount = this.mechanism.getArrayOfPositions().filter(position => position.color === 'green').length;

      if (initialGreenCount < 3) {//since is not the best we check the other input joint, to see of that gives better result
        /*arrayOfJoints[9].removeInput();
        arrayOfJoints[12].addInput();
        arrayOfJoints[9].addGround();*/
        firstGround.removeInput();
        firstGround.addGround();
        lastGround!.addInput();

        this.positionSolver.solvePositions();
        this.verifyMechanismPath();
        let alternativeGreenCount = this.mechanism.getArrayOfPositions().filter(position => position.color === 'green').length;

        if (initialGreenCount >= alternativeGreenCount) { //go back to initial conf
          /*arrayOfJoints[12].removeInput();
          arrayOfJoints[9].addInput();
          arrayOfJoints[12].addGround();*/
          firstGround.addInput();
          lastGround!.removeInput();
          lastGround!.addGround();
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
      this.fourBarGenerated = false;
      this.cdr.detectChanges();
      return;
    }

    let firstGround = this.synthedMech[0];
    let lastGround = this.synthedMech[this.synthedMech.length-1];
    //change the inputs to ground
    const joints = [firstGround.getJoints()[0], lastGround.getJoints()[1]];
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

    //override for now
    groundedLink = firstGround;

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
        this.coord1A = new Coord(this.pos1X - this.couplerLength / 2, this.pos1Y);
        this.coord2A = new Coord(this.pos1X + this.couplerLength / 2, this.pos1Y);
        this.coord1B = new Coord(this.pos2X - this.couplerLength / 2, this.pos2Y);
        this.coord2B = new Coord(this.pos2X + this.couplerLength / 2, this.pos2Y);
        this.coord1C = new Coord(this.pos3X - this.couplerLength / 2, this.pos3Y);
        this.coord2C = new Coord(this.pos3X + this.couplerLength / 2, this.pos3Y);
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
        this.coord1A = new Coord(0, this.pos1Y);
        this.coord2A = new Coord(this.couplerLength, this.pos1Y);
        this.coord1B = new Coord(this.pos2X, this.pos2Y);
        this.coord2B = new Coord(this.pos2X + this.couplerLength, this.pos2Y);
        this.coord1C = new Coord(this.pos3X, this.pos3Y);
        this.coord2C = new Coord(this.pos3X + this.couplerLength, this.pos3Y);

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
        this.coord1A = new Coord(-this.couplerLength, this.pos1Y);
        this.coord2A = new Coord(0, this.pos1Y);
        this.coord1B = new Coord(this.pos2X - this.couplerLength, this.pos2Y);
        this.coord2B = new Coord(this.pos2X, this.pos2Y);
        this.coord1C = new Coord(this.pos3X - this.couplerLength, this.pos3Y);
        this.coord2C = new Coord(this.pos3X, this.pos3Y);

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
      this.setCouplerJointCoordinates(referenceJoint, radians, backJoint, midJoint, frontJoint);

    } else if (posNum === 2 && this.position2) {
      this.pos2Angle = angle;
      this.position2.angle = angle;
      const backJoint = this.position2.getJoints()[0];
      const frontJoint = this.position2.getJoints()[1];
      const midJoint = this.position2.getJoints()[2];
      const referenceJoint = this.getReferenceJoint(this.position2);
      this.setCouplerJointCoordinates(referenceJoint, radians, backJoint, midJoint, frontJoint);

    } else if (posNum === 3 && this.position3) {
      this.pos3Angle = angle;
      this.position3.angle = angle;
      const backJoint = this.position3.getJoints()[0];
      const frontJoint = this.position3.getJoints()[1];
      const midJoint = this.position3.getJoints()[2];
      const referenceJoint = this.getReferenceJoint(this.position3);
      this.setCouplerJointCoordinates(referenceJoint, radians, backJoint, midJoint, frontJoint);

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

    if (index === 1) {
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
    return this.pos1Specified && this.pos2Specified && this.pos3Specified;
}

  confirmRemoveAll: boolean = false;

  removeAllPositions() {
    if (!this.confirmRemoveAll) {
      this.confirmRemoveAll = true;
      setTimeout(() => this.confirmRemoveAll = false, 3000);
    } else {
      if (this.fourBarGenerated){
        this.fourBarGenerated = false;
      }
      if (this.sixBarGenerated){
        this.fourBarGenerated = false;
        this.sixBarGenerated = false;
      }
      this.synthedMech = [];
      this.confirmRemoveAll = false;
      this.deletePosition(1);
      this.deletePosition(2);
      this.deletePosition(3);
    }
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
// Handles blur event to restore placeholder if input is empty
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

    this.stateService.getAnimationBarComponent()?.updateTimelineMarkers();
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

// Helper to update joint positions based on center and reference type
  private setCouplerJointCoordinates(referenceJoint: Joint, radians: number, backJoint: Joint, midJoint: Joint, frontJoint: Joint): void {
    const centerX = referenceJoint.coords.x;
    const centerY = referenceJoint.coords.y;
    const halfLength = this.couplerLength / 2;

    const dx = Math.cos(radians);
    const dy = Math.sin(radians);

    if (this.reference === "Center") {
      backJoint.setCoordinates(new Coord(centerX - halfLength * dx, centerY - halfLength * dy));
      midJoint.setCoordinates(new Coord(centerX, centerY));
      frontJoint.setCoordinates(new Coord(centerX + halfLength * dx, centerY + halfLength * dy));
    } else if (this.reference === "Back") {
      frontJoint.setCoordinates(new Coord(centerX + this.couplerLength * dx, centerY + this.couplerLength * dy));
      midJoint.setCoordinates(new Coord(centerX + dx, centerY + dy));
    } else if (this.reference === "Front") {
      backJoint.setCoordinates(new Coord(centerX - this.couplerLength * dx, centerY - this.couplerLength * dy));
      midJoint.setCoordinates(new Coord(centerX - dx, centerY - dy));
    }
  }
}
