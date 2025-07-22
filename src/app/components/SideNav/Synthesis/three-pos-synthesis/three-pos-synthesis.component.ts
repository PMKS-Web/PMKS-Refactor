import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  OnInit,
} from '@angular/core';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { Link } from 'src/app/model/link';
import { Mechanism } from 'src/app/model/mechanism';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';
import { Joint } from 'src/app/model/joint';
import { Coord } from 'src/app/model/coord';
import { ChangeDetectorRef } from '@angular/core';
import { PositionSolverService } from '../../../../services/kinematic-solver.service';
import { Position } from '../../../../model/position';
import { NotificationService } from 'src/app/services/notification.service';
import { Action } from 'rxjs/internal/scheduler/Action';
import { Subscription } from 'rxjs';
import { UndoRedoService } from 'src/app/services/undo-redo.service';

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
export class ThreePosSynthesis implements OnInit {
  @Input() disabled: boolean = false;
  @Input() tooltip: string = '';
  @Input() input1Value: number = 0;
  @Input() label1: string = 'Length';
  @Output() input1Change: EventEmitter<number> = new EventEmitter<number>();
  @Output() Generated: EventEmitter<boolean> = new EventEmitter<boolean>();

  sectionExpanded: { [key: string]: boolean } = { Basic: false };
  reference: string = 'Center';
  couplerLength: number = 2;
  position1: Position | null = null;
  position2: Position | null = null;
  position3: Position | null = null;
  position2LengthErr: lengthErrRecentPoint = {
    x1: false,
    y1: false,
    x2: false,
    y2: false,
  };
  position3LengthErr: lengthErrRecentPoint = {
    x1: false,
    y1: false,
    x2: false,
    y2: false,
  }; //To be used with End Points system, True if position x has a different length than position 1
  fourBarGenerated: boolean = false;
  sixBarGenerated: boolean = false;
  recalcNeeded = false;
  units: string = 'cm';
  angles: string = 'º';
  panel: string = 'Synthesis';
  synthedMech: Link[] = [];
  selectedOption: string = 'xy-angle';
  angle: number = 0;
  // New array for two-point mode, using the Position interface
  twoPointPositions: CoordinatePosition[] = [
    { x0: -1, y0: 0, x1: 1, y1: 0, defined: false },
    { x0: -3.5, y0: 0, x1: -1.5, y1: 0, defined: false },
    { x0: 1.5, y0: 0, x1: 3.5, y1: 0, defined: false },
  ];
  isLengthLocked: boolean = false;
  showLockMessage: boolean = false; // Controls the visibility of the message
  positionLocks: PositionLock[] = [
    { isLocked: false, lockedLength: 2 }, // Position 1
    { isLocked: false, lockedLength: 2 }, // Position 2
    { isLocked: false, lockedLength: 2 }, // Position 3
  ];
  // Flags to control placeholder visibility
  placeholderFlags: {
    [key: number]: { x0: boolean; y0: boolean; x1: boolean; y1: boolean };
  } = {};
  private readonly mechanism: Mechanism;
  

  constructor(
    private stateService: StateService,
    private interactionService: InteractionService,
    private cdr: ChangeDetectorRef,
    private positionSolver: PositionSolverService,
    private notificationService: NotificationService,
    private undoRedoService: UndoRedoService
  ) {
    this.mechanism = this.stateService.getMechanism();
  }
  ngOnInit(): void {
    this.init();
    this.undoRedoService.reinitialize$.subscribe(() => {
      this.init();
      this.cdr.detectChanges();
    });
    this.stateService.generateFourBar$.subscribe(() => {
      this.generateFourBar();
    });
    this.stateService.generateSixBar$.subscribe(() => {
      this.generateSixBar();
    });
        this.mechanism._positionLengthChange$
      .subscribe(newLength => {
        this.couplerLength = newLength;
      });
  }
  init() {
    console.log("Synthesis Init");
    this.mechanism.getArrayOfPositions().forEach((position) => {
      if (position.id === 1) {
        this.position1 = position;
      } else if (position.id === 2) {
        this.position2 = position;
      } else if (position.id === 3) {
        this.position3 = position;
      }
    });
    this.mechanism.getArrayOfLinks().forEach((link) => {
      if (link.joints.values().next().value?.isGenerated)
        this.synthedMech.push(link);
    });
    let initialGreenCount = this.mechanism
      .getArrayOfPositions()
      .filter((position) => position.color === 'green').length;
    if (initialGreenCount > 0 || this.stateService.sixBarGenerated){
      this.fourBarGenerated = true;
      this.stateService.fourBarGenerated = true;
      this.sixBarGenerated = this.stateService.sixBarGenerated;
    }

  }
  setReference(r: string) {
    this.reference = r;
    this.mechanism._positionReference = this.reference;
    if (this.position1) {
      this.position1.setReference(this.reference);
      this.setPosXCoord(this.getNewCoord(this.position1).x, 1);
      this.setPosYCoord(this.getNewCoord(this.position1).y, 1);
    }
    if (this.position2) {
      this.position2.setReference(this.reference);
      this.setPosXCoord(this.getNewCoord(this.position2).x, 2);
      this.setPosYCoord(this.getNewCoord(this.position2).y, 2);
    }
    if (this.position3) {
      this.position3.setReference(this.reference);
      this.setPosXCoord(this.getNewCoord(this.position3).x, 3);
      this.setPosYCoord(this.getNewCoord(this.position3).y, 3);
    }
  }
  toggleOption(selectedOption: string) {
    this.selectedOption = selectedOption;
  }
// In your component - Updated specifyPosition function
specifyPosition(index: number) {
  if(index < 1 || index > 3) {
    console.warn("Index " + index + " is an invalid position number")
  }
    if (index === 1) {
        this.position1 = this.mechanism.addPos(1);
    } else if (index === 2) {
        this.position2 = this.mechanism.addPos(2);
    } else if (index === 3) {
        this.position3 = this.mechanism.addPos(3);
    }
    this.undoRedoService.recordAction({
      type: "positionSpecified",
      linkId: index
    })
}

  getNewCoord(position: Position): Coord {
    let joint: Joint;
    if (this.reference === 'Back') {
      joint = position.getJoints()[0]; // First joint for "Back"
    } else if (this.reference === 'Front') {
      joint = position.getJoints()[1]; // Second joint for "Front"
    } else if (this.reference === 'Center') {
      joint = position.getJoints()[2];
    } else {
      // Default to "Back" if reference is not recognized
      joint = position.getJoints()[0];
    }
    return new Coord(joint.coords.x, joint.coords.y);
  }

  getLength(): number{
    return this.couplerLength as number;
  }
  isFourBarGenerated(): boolean {
    return this.fourBarGenerated;
  }
  isSixBarGenerated(): boolean {
    return this.sixBarGenerated;
  }
  onInputClick() {
    this.notificationService.showNotification(
      'Clear Current Four-bar so that change link length and positions and regenerate a new four-bar'
    );
  }

  getLastJoint(joints: IterableIterator<Joint>): Joint | undefined {
    let lastJoint: Joint | undefined;
    for (const joint of joints) {
      lastJoint = joint;
    }
    if (lastJoint !== undefined) {
      return lastJoint;
    } else return undefined;
  }

  generateFourBar() {
    //button changes to "clear four bar" when already generated, so remove mechanism
    if (this.fourBarGenerated) {
      while (this.synthedMech.length > 0) {
        let linkId = this.synthedMech[0].id;
        this.synthedMech.splice(0, 1);
        this.mechanism.removeLink(linkId);
        this.position1!.locked = false;
        this.position2!.locked = false;
        this.position3!.locked = false;
      }
      this.setPositionsColorToDefault();
      this.mechanism.clearTrajectories();
      this.fourBarGenerated = false;
      this.sixBarGenerated = false;
      this.stateService.sixBarGenerated = this.sixBarGenerated;
      this.stateService.fourBarGenerated = this.fourBarGenerated;
      this.synthedMech = [];
      this.Generated.emit(false);
    } else {
      let firstPoint = this.findIntersectionPoint(
        this.position1!.getJoints()[0]._coords,
        this.position2!.getJoints()[0]._coords,
        this.position3!.getJoints()[0]._coords
      );
      let secondPoint = this.position1!.getJoints()[0]._coords;
      let thirdPoint = this.position1!.getJoints()[1]._coords;
      let fourthPoint = this.findIntersectionPoint(
        this.position1!.getJoints()[1]._coords,
        this.position2!.getJoints()[1]._coords,
        this.position3!.getJoints()[1]._coords
      );
      this.fourBarGenerated = !this.fourBarGenerated;
      this.stateService.fourBarGenerated = this.fourBarGenerated;

      this.Generated.emit(this.fourBarGenerated);
      this.cdr.detectChanges();

      this.mechanism.addLink(firstPoint, secondPoint, true);
      let firstGround = this.mechanism
        .getArrayOfLinks()
        [this.mechanism.getArrayOfLinks().length - 1].getJoints()[0];
      this.synthedMech.push(
        this.mechanism.getArrayOfLinks()[
          this.mechanism.getArrayOfLinks().length - 1
        ]
      );
      this.synthedMech[this.synthedMech.length - 1]._joints.forEach(
        (number) => {
          number.generated = true;
        }
      );
      let joints = this.mechanism.getJoints(); //makes a list of all the joints in the mechanism
      let lastJoint = this.getLastJoint(joints);
      if (lastJoint !== undefined) {
        this.mechanism.addLinkToJoint(lastJoint.id, thirdPoint, true);
        this.synthedMech.push(
          this.mechanism.getArrayOfLinks()[
            this.mechanism.getArrayOfLinks().length - 1
          ]
        );
        this.synthedMech[this.synthedMech.length - 1]._joints.forEach(
          (number) => {
            number.generated = true;
          }
        );
      }

      joints = this.mechanism.getJoints(); //updates list of all joints
      lastJoint = this.getLastJoint(joints);
      let lastGround;
      if (lastJoint !== undefined) {
        this.mechanism.addLinkToJoint(lastJoint.id, fourthPoint, true);
        lastGround = this.mechanism
          .getArrayOfLinks()
          [this.mechanism.getArrayOfLinks().length - 1].getJoints()[1];
        this.synthedMech.push(
          this.mechanism.getArrayOfLinks()[
            this.mechanism.getArrayOfLinks().length - 1
          ]
        );
        this.synthedMech[this.synthedMech.length - 1]._joints.forEach(
          (number) => {
            number.generated = true;
          }
        );
      }
      firstGround.addGround();
      firstGround.addInput();
      lastGround!.addGround();
      this.positionSolver.solvePositions();
      this.verifyMechanismPath();

      const inputLink = this.synthedMech[0];
      const linkInteractor = new LinkInteractor(
        inputLink,
        this.stateService,
        this.interactionService,
        this.notificationService,
        this.undoRedoService
      );
      this.interactionService.setSelectedObject(linkInteractor);
      this.stateService.getAnimationBarComponent()?.updateTimelineMarkers();

      let initialGreenCount = this.mechanism
        .getArrayOfPositions()
        .filter((position) => position.color === 'green').length;

      if (initialGreenCount < 3) {
        //since is not the best we check the other input joint, to see of that gives better result
        firstGround.removeInput();
        firstGround.addGround();
        lastGround!.addInput();

        this.positionSolver.solvePositions();
        this.verifyMechanismPath();
        let alternativeGreenCount = this.mechanism
          .getArrayOfPositions()
          .filter((position) => position.color === 'green').length;

        if (initialGreenCount >= alternativeGreenCount) {
          //go back to initial conf
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
    }
  }

  generateSixBar() {
    this.sixBarGenerated = !this.sixBarGenerated;
    this.stateService.sixBarGenerated = this.sixBarGenerated;

    //clear the six-bar
    if (!this.sixBarGenerated) {
      let listOfLinks = this.synthedMech[4].id;
      while (this.synthedMech.length > 4) {
        let linkId = this.synthedMech[4].id;
        this.synthedMech.splice(4, 1);
        this.mechanism.removeLink(linkId);
        this.mechanism.removeLink(linkId - 1);

        this.position1!.locked = false;
        this.position2!.locked = false;
        this.position3!.locked = false;
        console.log('LIST OF LINKS AFTER DELETION:');
        console.log(this.mechanism.getArrayOfLinks());
        this.mechanism.removeJoint(10);
      }
      this.mechanism.removeJoint(10);
      this.setPositionsColorToDefault();
      this.mechanism.clearTrajectories();
      console.log('Six-bar has been cleared');
      this.fourBarGenerated = true;
      this.sixBarGenerated = false;
      this.stateService.sixBarGenerated = this.sixBarGenerated;
      this.stateService.fourBarGenerated = this.fourBarGenerated;
      this.cdr.detectChanges();
      return;
    }

    let firstGround = this.synthedMech[0];
    let lastGround = this.synthedMech[this.synthedMech.length - 1];
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
      console.error('no grounded link');
      return;
    }

    //override for now
    groundedLink = firstGround;

    const linkJoints = groundedLink.getJoints();
    const firstJoint = linkJoints[0];
    const attachPoint = firstJoint._coords;

    const adjustedAttachPoint = new Coord(attachPoint.x, attachPoint.y + 0.8);
    const newLinkEndCoord = new Coord(
      adjustedAttachPoint.x - 1.75,
      adjustedAttachPoint.y
    );
    this.mechanism.addLinkToLink(
      groundedLink.id,
      adjustedAttachPoint,
      newLinkEndCoord,
      true
    );
    this.synthedMech.push(
      this.mechanism.getArrayOfLinks()[
        this.mechanism.getArrayOfLinks().length - 1
      ]
    );

    let newJoints = Array.from(this.mechanism.getJoints());
    let lastJoint = newJoints[newJoints.length - 1];

    const downwardLinkEndCoord = new Coord(
      lastJoint._coords.x,
      lastJoint._coords.y - 0.75
    );
    this.mechanism.addLinkToJoint(lastJoint.id, downwardLinkEndCoord, true);
    this.synthedMech.push(
      this.mechanism.getArrayOfLinks()[
        this.mechanism.getArrayOfLinks().length - 1
      ]
    );

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

  setCouplerLength(x: number) {
    if (x > 0 && x !== this.couplerLength) {
      this.undoRedoService.recordAction({type: "setSynthesisLength", oldDistance: this.couplerLength, newDistance: x})
      this.couplerLength = x;
      this.mechanism.setCouplerLength(x);
    }
  }

  setPosXCoord(x: number, posNum: number) {
    const position = [this.position1, this.position2, this.position3][posNum - 1];
    if (!position) throw new Error(`Invalid position number: ${posNum}`);

    let refPos = this.getReferenceJoint(position).coords;

    if(position && refPos.x !== x){
      this.undoRedoService.recordAction({
        type: "setPositionPosition",
        linkId: position.id,
        oldCoords: refPos,
        newCoords: new Coord(x, parseFloat(this.getPosYCoord(posNum)))
      })
      this.mechanism.setPositionLocation(new Coord(x, parseFloat(this.getPosYCoord(posNum))), position.id);
    }
  }

  setPosYCoord(y: number, posNum: number) {
    const position = [this.position1, this.position2, this.position3][posNum - 1];
    if (!position) throw new Error(`Invalid position number: ${posNum}`);
    let refPos = this.getReferenceJoint(position).coords;
    if(position && refPos.y !== y){
      this.undoRedoService.recordAction({
        type: "setPositionPosition",
        linkId: position.id,
        oldCoords: refPos,
        newCoords: new Coord(parseFloat(this.getPosXCoord(posNum)), y)
      })
      this.mechanism.setPositionLocation(new Coord(parseFloat(this.getPosXCoord(posNum)), y), position.id);
    }
  }

  setPositionAngle(angle: number, posNum: number) {
    const positions = [this.position1, this.position2, this.position3];
    const position = positions[posNum - 1];
    if (!position) throw new Error(`Invalid position number: ${posNum}`);
    
    if(position && position.angle.toFixed(3) !== Number(angle).toFixed(3)){
      this.undoRedoService.recordAction({
        type: "setPositionAngle",
        linkId: position.id,
        oldAngle: position.angle,
        newAngle: Number(angle)
      })
      this.mechanism.setPositionAngle(Number(angle), position.id);
    }
    
    this.cdr.detectChanges();
  }

  getReferenceJoint(position: Position): Joint {
    if (this.reference === 'Back') {
      return position.getJoints()[0];
    } else if (this.reference === 'Front') {
      return position.getJoints()[1];
    } else {
      return position.getJoints()[2];
    }
  }
  getPosXCoord(posNum: number) {
    if (posNum == 1)
      return this.getReferenceJoint(
        this.position1 as Position
      ).coords.x.toFixed(3);
    else if (posNum == 2)
      return this.getReferenceJoint(
        this.position2 as Position
      ).coords.x.toFixed(3);
    return this.getReferenceJoint(this.position3 as Position).coords.x.toFixed(
      3
    );
  }
  getPosYCoord(posNum: number) {
    if (posNum == 1)
      return this.getReferenceJoint(
        this.position1 as Position
      ).coords.y.toFixed(3);
    else if (posNum == 2)
      return this.getReferenceJoint(
        this.position2 as Position
      ).coords.y.toFixed(3);
    return this.getReferenceJoint(this.position3 as Position).coords.y.toFixed(
      3
    );
  }

  getPosAngle(posNum: number) {
    if (posNum == 1) return this.position1?.angle.toFixed(3) as unknown as number;
    else if (posNum == 2) return this.position2?.angle.toFixed(3) as unknown as number;
    else return this.position3?.angle.toFixed(3) as unknown as number;
  }

  isPositionDefined(index: number): boolean {
    return this.mechanism.hasPositionWithId(index);
  }

  getFirstUndefinedPosition(): number {
    if (!this.mechanism.hasPositionWithId(1)) {
      return 1;
    }
    if (!this.mechanism.hasPositionWithId(2)) {
      return 2;
    }
    if (!this.mechanism.hasPositionWithId(3)) {
      return 3;
    }
    return 0;
  }

  deletePosition(index: number) {
    const positions = [this.position1, this.position2, this.position3];
    const position = positions[index - 1];
    this.undoRedoService.recordAction({
      type: "deletePosition",
      oldPosition: position as Position,
    })

    if (index === 1) {
      this.mechanism.removePosition(this.position1!.id);
    } else if (index === 2) {
      this.mechanism.removePosition(this.position2!.id);
    } else if (index === 3) {
      this.mechanism.removePosition(this.position3!.id);
    }
  }

  allPositionsDefined(): boolean {
    if(!this.position1 || !this.position2 || !this.position3) return false;
    return this.mechanism.hasPositionWithId(this.position1!.id) && this.mechanism.hasPositionWithId(this.position2!.id) && this.mechanism.hasPositionWithId(this.position3!.id);
  }
  anyPositionsDefined(): boolean {
    return (this.position1 && this.mechanism.hasPositionWithId(this.position1!.id)) || (this.position2 && this.mechanism.hasPositionWithId(this.position2!.id)) || (this.position3 && this.mechanism.hasPositionWithId(this.position3!.id)) || false;
  }

  confirmRemoveAll: boolean = false;

  recordFourBarWrapper() {
    this.undoRedoService.recordAction({
      type: 'generateFourBar',
    });
  }
  recordSixBarWrapper() {
    this.undoRedoService.recordAction({
      type: 'generateSixBar',
    });
  }
  removeAllPositions() {
    if(!this.confirmRemoveAll) {
      this.confirmRemoveAll = true;
      return;
    }
    const positions = [this.position1, this.position2, this.position3];

    this.undoRedoService.recordAction({
      type: "deleteAllPositions",
      oldPositionArray: positions as Position[],
    })

    if (this.position1 && this.isPositionDefined(this.position1.id)) {
      this.mechanism.removePosition(this.position1!.id);
    }  
    if (this.position2 && this.isPositionDefined(this.position2.id)) {
      this.mechanism.removePosition(this.position2!.id);
    } 
    if (this.position3 && this.isPositionDefined(this.position3.id)) {
      this.mechanism.removePosition(this.position3!.id);
    }
  }

findIntersectionPoint(
  pose1_coord: Coord,
  pose2_coord: Coord,
  pose3_coord: Coord
) {
  let slope1 = 1 / ((pose2_coord.y - pose1_coord.y) / (pose2_coord.x - pose1_coord.x));
  let slope2 = 1 / ((pose3_coord.y - pose2_coord.y) / (pose3_coord.x - pose2_coord.x));
  
  let midpoint_line1 = new Coord(
    (pose1_coord.x + pose2_coord.x) / 2,
    (pose1_coord.y + pose2_coord.y) / 2
  );
  let midpoint_line2 = new Coord(
    (pose3_coord.x + pose2_coord.x) / 2,
    (pose3_coord.y + pose2_coord.y) / 2
  );
  
  let c1 = midpoint_line1.y + slope1 * midpoint_line1.x;
  let c2 = midpoint_line2.y + slope2 * midpoint_line2.x;
  
  let x1 = (c1 - c2) / (-slope2 + slope1);
  let y1 = -slope1 * x1 + c1;
  
  return new Coord(x1, y1);
}

  verifyMechanismPath() {
    const threshold = 0.09;
    const userPositions = [this.position1, this.position2, this.position3];
    const animationPaths = this.positionSolver.getAnimationPositions();

    userPositions.forEach((position) => {
      const positionCoords = position!
        .getJoints()
        .slice(0, 2)
        .map((joint) => joint._coords); //map the joints into coords, cutting the reference joint out of the array
      let positionMatched = false; //to check if both left and right joint pass throughh

      for (const path of animationPaths) {
        const bothJointsMatched = positionCoords.every((coord) => {
          return path.some(
            (pathPoint) => pathPoint.getDistanceTo(coord) <= threshold
          );
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

  toggleLengthLock() {
    this.isLengthLocked = !this.isLengthLocked;

    if (this.isLengthLocked) {
      this.showLockMessage = true;

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
  specifyPositionEndPoints(index: number) {
    if (index >= 0) {
      this.twoPointPositions[index - 1].defined = true;
      this.specifyPosition(index);
    }

    if (!this.placeholderFlags[index]) {
      this.placeholderFlags[index] = {
        x0: false,
        y0: false,
        x1: false,
        y1: false,
      };
    } else {
      this.placeholderFlags[index].x0 = false;
      this.placeholderFlags[index].y0 = false;
      this.placeholderFlags[index].x1 = false;
      this.placeholderFlags[index].y1 = false;
    }
  }

  // Handles blur event to restore placeholder if input is empty
  swapInputAndGround() {
    const joints = this.mechanism.getJoints();

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
      console.log('Before Swap:');
      console.log('Input Joint:', inputJoint);
      console.log('Current Ground Joint:', groundJoint);
      console.log('Other Ground Joint:', otherGroundJoint);

      // Remove input from the current input joint
      inputJoint.removeInput();
      console.log('After removeInput, Input Joint:', inputJoint); // Debugging log

      // Check which ground joint currently has the input
      if (inputJoint === groundJoint) {
        // If the input joint was the current ground joint, add input to the other ground joint
        otherGroundJoint.addInput(); // Set the other ground joint as input
      } else {
        // If the input joint was not the current ground joint, add input to the current ground joint
        groundJoint.addInput(); // Set the current ground joint as input
      }

      console.log('After Swap:');
      console.log('Input Joint:', inputJoint);
      console.log('Current Ground Joint:', groundJoint);
      console.log('Other Ground Joint:', otherGroundJoint);
    } else {
      console.warn('Input or Ground Joint not found!');
    }

    this.stateService.getAnimationBarComponent()?.updateTimelineMarkers();
  }

  updateEndPointCoords(
    positionIndex: number,
    coordType: 'x0' | 'y0' | 'x1' | 'y1',
    value: number
  ): void {
    // Validate position index
    if (positionIndex < 1 || positionIndex > 3) {
      console.error('Invalid position index. It must be 1, 2, or 3.');
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

  getEndPointXCoords(positionIndex: number, jointIndex: number) {
    if (positionIndex == 1)
      return this.position1?.getJoints()[jointIndex].coords.x.toFixed(3);
    else if (positionIndex == 2)
      return this.position2?.getJoints()[jointIndex].coords.x.toFixed(3);
    return this.position3?.getJoints()[jointIndex].coords.x.toFixed(3);
  }
  getEndPointYCoords(positionIndex: number, jointIndex: number) {
    if (positionIndex == 1)
      return this.position1?.getJoints()[jointIndex].coords.y.toFixed(3);
    else if (positionIndex == 2)
      return this.position2?.getJoints()[jointIndex].coords.y.toFixed(3);
    return this.position3?.getJoints()[jointIndex].coords.y.toFixed(3);
  }
}