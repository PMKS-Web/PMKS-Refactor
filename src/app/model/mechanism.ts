import { Coord } from './coord';
import { Joint } from './joint';
import { Link, RigidBody } from './link';
import { Force } from './force';
import { CompoundLink } from './compound-link';
import { BehaviorSubject } from 'rxjs';
import { Position } from './position';
import { Trajectory } from './trajectory';
import { PositionSolverService } from 'src/app/services/kinematic-solver.service';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Mechanism {
  private _joints: Map<number, Joint>;
  private _links: Map<number, Link>;
  private _forces: Map<number, Force>;
  private _compoundLinks: Map<number, CompoundLink>;
  private _idCount: number;
  private _jointIDCount: number;
  private _linkIDCount: number;
  private _forceIDCount: number;
  private _compoundLinkIDCount: number;
  private _mechanismChange: BehaviorSubject<Mechanism> =
  new BehaviorSubject<Mechanism>(this);
  public _mechanismChange$ = this._mechanismChange.asObservable();
  private _trajectories: Map<number, Trajectory> = new Map();
  private _refIdCount: number = -1;

  private _positionIDCount: number = 0;
  private _positions: Map<number, Position> = new Map();
  public _positionReference: string = 'Center';
  private _positionLengthChange: BehaviorSubject<number> = new BehaviorSubject<number>(2);
  public _positionLengthChange$ = this._positionLengthChange.asObservable();



  constructor() {
    this._joints = new Map();
    this._links = new Map();
    this._forces = new Map();
    this._positions = new Map();
    this._trajectories = new Map();
    this._compoundLinks = new Map();
    this._idCount = 0;
    this._jointIDCount = 0;
    this._linkIDCount = 0;
    this._forceIDCount = 0;
    this._compoundLinkIDCount = 0;
  }

  notifyChange(): void {
    this._mechanismChange.next(this);
  }

  //----------------------------GRID CONTEXT MENU ACTIONS----------------------------

  /**
   * Given two Coordinates, generates two joints at those coordinates and makes a link between them
   * TODO: Account for two additional cases,
   * 1. from grid to joint
   * 2. from grid to link
   * @param {Coord} coordOne
   * @param {Coord} coordTwo
   * @param synthesized
   * @memberof Mechanism
   */
  addLink(coordOne: Coord, coordTwo: Coord, synthesized?: boolean) {
    let isSynth = false;
    if (typeof synthesized !== 'undefined') {
      isSynth = synthesized;
    }
    let jointA = new Joint(this._jointIDCount, coordOne);
    console.log(coordOne.x);
    console.log(coordOne.y);
    this._jointIDCount++;
    let jointB = new Joint(this._jointIDCount, coordTwo);
    this._jointIDCount++;
    this._joints.set(jointA.id, jointA);
    this._joints.set(jointB.id, jointB);
    let linkA = new Link(this._linkIDCount, [jointA, jointB]);
    if (linkA.calculateAngle() === null) {
      linkA.angle = 0;
    } else linkA.angle = parseFloat(linkA.calculateAngle()!.toFixed(3));
    this._linkIDCount++;
    this._links.set(linkA.id, linkA);
    if (!isSynth) {
      this.notifyChange();
    }
    //console.log(this);
  }

addPos(positionIndex: number) {
    // Get the current coupler length from positionLengthChange
    const couplerLength = this._positionLengthChange.value;
    
    let coord1: Coord, coord2: Coord;
    
    if (positionIndex === 1) {
        coord1 = new Coord(-couplerLength / 2, 0);
        coord2 = new Coord(couplerLength / 2, 0);
    } else if (positionIndex === 2) {
        coord1 = new Coord(-couplerLength / 2 - 1.5 * couplerLength, 0);
        coord2 = new Coord(couplerLength / 2 - 1.5 * couplerLength, 0);
    } else if (positionIndex === 3) {
        coord1 = new Coord(-couplerLength / 2 + 1.5 * couplerLength, 0);
        coord2 = new Coord(couplerLength / 2 + 1.5 * couplerLength, 0);
    } else {
        throw new Error(`Invalid position index: ${positionIndex}`);
    }

    // Create two joints for the new position
    let jointA = new Joint(this._jointIDCount, coord1);
    this._jointIDCount++;
    let jointB = new Joint(this._jointIDCount, coord2);
    this._jointIDCount++;
    
    // Create pseudo joint for fixed reference point, do not add to maps, default to center
    const centerX = (jointA.coords.x + jointB.coords.x) / 2;
    const centerY = (jointA.coords.y + jointB.coords.y) / 2;
    let jointC = new Joint(this._refIdCount, new Coord(centerX, centerY));
    jointC.hidden = true;
    jointC.reference = true;
    this._refIdCount--;
    
    this._joints.set(jointA.id, jointA);
    this._joints.set(jointB.id, jointB);
    this._joints.set(jointC.id, jointC);
    
    let position = new Position(positionIndex, [
        jointA,
        jointB,
        jointC,
    ]);
    
    // Set position properties based on index
    if (positionIndex === 1) {
        position.name = 'Position 1';
    } else if (positionIndex === 2) {
        position.name = 'Position 2';
    } else if (positionIndex === 3) {
        position.name = 'Position 3';
    }
    
    position.setReference(this._positionReference);
    
    this._positionIDCount++;
    this._positions.set(position.id, position);
    this.notifyChange();
    
    return position;
}

  populateTrajectories(positionSolver: PositionSolverService): void {
    const animationFrames = positionSolver.getAnimationFrames();

    if (animationFrames.length === 0) {
      console.warn('No animation frames available.');
      return;
    }

    const correspondingJoints = animationFrames[0].correspondingJoints;

    for (let j = 0; j < correspondingJoints.length; j++) {
      const jointId = correspondingJoints[j];
      const joint = this.getJoint(jointId);

      if (joint.isGrounded) {
        continue;
      }

      const trajectoryCoords: Coord[] = [];

      for (let i = 0; i < animationFrames[0].positions.length; i++) {
        const frame = animationFrames[0].positions[i];
        trajectoryCoords.push(frame[j]);
      }
      console.log('trajectoryCoords', trajectoryCoords);

      console.log('Trajectory Coords:', trajectoryCoords);
      console.log('Animation Frames:', animationFrames);
      console.log(
        `Populating trajectory for joint ID ${jointId} with coords:`,
        trajectoryCoords
      );

      this.setTrajectory(jointId, new Trajectory(trajectoryCoords, jointId));
    }
  }

  //----------------------------JOINT CONTEXT MENU ACTIONS----------------------------

  /**
   * Generalized function for performing actions/modifications on joints,
   * 1. Checks the jointID is valid.
   * 2. Checks the requested action can be performed on the joint(a Joint class function)
   * 3. Attempts to perform the action on the joint(another Joint class function)
   * Outline: this.executeJointAction(jointID, (joint) => true, 'error','success', (joint) =>{});
   * @private
   * @param {number} jointID
   * @param {(joint: any) => boolean} canPerformAction
   * @param {string} errorMsg
   * @param {string} successMsg
   * @param {(joint: any) => void} action
   * @param synthesized
   * @return {*}
   * @memberof Mechanism
   */
  private executeJointAction(
    jointID: number,
    canPerformAction: (joint: Joint) => boolean,
    errorMsg: string,
    successMsg: string,
    action: (joint: any) => void,
    synthesized?: boolean
  ): boolean {
    let joint = this._joints.get(jointID);
    let isSynth = false;
    if (typeof synthesized !== 'undefined') {
      isSynth = synthesized;
    }
    if (joint === undefined) {
      console.error(`Joint with ID ${jointID} does not exist`);
      return false;
    }
    if (!canPerformAction(joint)) {
      console.error(`Joint with ID ${jointID} ${errorMsg}`);
      return false;
    }
    if (joint.locked && successMsg !== 'unwelded') {
      console.error(`Joint with ID ${jointID} is locked`);
      return false;
    }

    try {
      action(joint);
      //console.log(`Joint with ID ${jointID} ${successMsg}`);
      if (!isSynth) this.notifyChange();
      //console.log(this);
      return true;
    } catch (error: any) {
      console.error(
        `An error occurred when trying to ${errorMsg} joint ${jointID}: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Given a joint's ID, welds all links attached to that joint into a single compound link, and sets the joint to welded.
   *
   * @param {number} jointID
   * @memberof Mechanism
   */
  addWeld(jointID: number) {
    this.executeJointAction(
      jointID,
      (joint) => this.canAddWeld(joint),
      'cannot become welded',
      'successfully welded',
      (joint) => {
        joint.addWeld();
        //cascade effects into affected links, compound links,
        let connectedLinks: Link[] = this.getConnectedLinksForJoint(joint);
        let connectedCompoundLinks: CompoundLink[] =
          this.getConnectedCompoundLinks(joint);

        //if not connected to any links do nothing
        if (connectedLinks.length == 0) {
          return;

          //if not already part of a CompoundLink create a new one and add all connected links
        } else if (connectedCompoundLinks.length == 0) {
          let compoundLink: CompoundLink = new CompoundLink(
            this._compoundLinkIDCount,
            connectedLinks
          );
          this._compoundLinkIDCount++;
          this._compoundLinks.set(compoundLink.id, compoundLink);
          compoundLink;
          //if part of one or more compoundLink, combine them and add any other existing links
        } else if (connectedCompoundLinks.length >= 1) {
          for (let compoundLink of connectedCompoundLinks) {
            //add all links from connected compoundlinks to connectedLinks array
            for (let link of compoundLink.links.values()) {
              if (!connectedLinks.includes(link)) connectedLinks.push(link);
            }
            //remove compound link to avoid duplicates
            this._compoundLinks.delete(compoundLink.id);
          }
          //create a new compoundlink containing all of the links that should be connected.
          let compoundLink: CompoundLink = new CompoundLink(
            this._compoundLinkIDCount,
            connectedLinks
          );
          this._compoundLinkIDCount++;
          this._compoundLinks.set(compoundLink.id, compoundLink);
        }
      }
    );
  }
  /**
   * Given a joint's ID, unwelds all links attached to that joint, and sets the joint to unwelded.
   *
   * @param {number} jointID
   * @memberof Mechanism
   */
  removeWeld(jointID: number) {
    this.executeJointAction(
      jointID,
      (joint) => joint.canRemoveWeld(),
      'cannot become unwelded',
      'unwelded',
      (joint) => {
        joint.removeWeld();
        //cascade effects into affected links, compound links, and forces
        let connectedCompoundLinks: CompoundLink[] =
          this.getConnectedCompoundLinks(joint);

        for (let compoundLink of connectedCompoundLinks) {
          console.log('compound links being checked');
          let newCompoundLinks: CompoundLink[] =
            compoundLink.compoundLinkAfterRemoveWeld(
              joint,
              this._compoundLinkIDCount
            );
          this._compoundLinks.delete(compoundLink.id);

          // Unlock every link that isn't part of a compound link
          this.unlockNonCompoundLinks();

          for (let link of newCompoundLinks) {
            this._compoundLinks.set(link.id, link);
            this._compoundLinkIDCount++;
          }
        }
      }
    );
  }

  private unlockNonCompoundLinks(): void {
    for (let link of this._links.values()) {
      let isPartOfCompoundLink = Array.from(this._compoundLinks.values()).some(
        (compoundLink) => compoundLink.links.has(link.id)
      );
      console.log('Unlocking non-compound link:' + link.name);
      if (!isPartOfCompoundLink) {
        console.log('Link is not part of compound: ' + link.name);
        link.locked = false;
      }
    }
  }
  /**
   *  Given a joint's ID, turns the joint into a prismatic-revolute joint with a slider and angle.
   *
   * @param {number} jointID
   * @memberof Mechanism
   */
  addSlider(jointID: number) {
    this.executeJointAction(
      jointID,
      (joint) => joint.canAddSlider(),
      'cannot become prismatic',
      'slider added successfully',
      (joint) => joint.addSlider()
    );
  }
  /**
   * Given a joint's ID, turns the joint into a revolute joint, removing the slider and angle.
   *
   * @param {number} jointID
   * @memberof Mechanism
   */
  removeSlider(jointID: number) {
    this.executeJointAction(
      jointID,
      (joint) => joint.canRemoveSlider(),
      'cannot become revolute',
      'slider removed successfully',
      (joint) => joint.removeSlider()
    );
  }
  /**
   * Given a joint's ID, attempts to make the joint a ground.
   *
   * @param {number} jointID
   * @memberof Mechanism
   */
  addGround(jointID: number) {
    this.executeJointAction(
      jointID,
      (joint) => joint.canAddGround(),
      'cannot become grounded',
      'grounded successfully',
      (joint) => joint.addGround()
    );
  }
  /**
   * Given a joint's ID, attempts to remove the ground from the joint.
   *
   * @param {number} jointID
   * @memberof Mechanism
   */
  removeGround(jointID: number) {
    this.executeJointAction(
      jointID,
      (joint) => joint.canRemoveGround(),
      'cannot become ungrounded',
      'ungrounded successfully',
      (joint) => joint.removeGround()
    );
  }
  /**
   * Given a joint's ID, attempts to add an input to the joint.
   * @param {number} jointID
   * @memberof Mechanism
   */
  addInput(jointID: number) {
    //before this, check if mechanism already has an input.
    this.executeJointAction(
      jointID,
      (joint) => joint.canAddInput(),
      'cannot become an input',
      'input added successfully',
      (joint) => joint.addInput()
    );
  }
  /**
   * Given a joint's ID, attempts to remove the input from the joint.
   *
   * @param {number} jointID
   * @memberof Mechanism
   */
  removeInput(jointID: number) {
    this.executeJointAction(
      jointID,
      (joint) => joint.canRemoveInput(),
      'cannot have its input removed',
      'input removed successfully',
      (joint) => joint.removeInput()
    );
  }

  /**
   * Given a joint's ID, and a Coordinate, creates a new joint with the coordinate, and a new Link containing the passed Joint, and the new joint.
   * @param {number} jointID
   * @param coordOneORJointID
   * @param synthesized
   * @memberof Mechanism
   */
  addLinkToJoint(
    jointID: number,
    coordOneORJointID: Coord | number,
    synthesized?: boolean
  ) {
    this.executeJointAction(
      jointID,
      () => true,
      'cannot have a new link added',
      'has had a new link added',
      (joint) => {
        let jointB: Joint;
        if (typeof coordOneORJointID !== 'number') {
          jointB = new Joint(this._jointIDCount, coordOneORJointID);
          this._jointIDCount++;
        } else if (this._joints.has(coordOneORJointID)) {
          jointB = this._joints.get(coordOneORJointID)!;
        } else {
          return;
        }
        this._joints.set(jointB.id, jointB);
        let linkA = new Link(this._linkIDCount, joint, jointB);
        this._linkIDCount++;
        this._links.set(linkA.id, linkA);
      },
      synthesized
    );
  }

  /**
   * Given a joint's ID, deletes the joint from the mechanism, as well as updates all links, and compound links to reflect the change.
   *
   * @param {number} jointID
   * @memberof Mechanism
   */
  removeJoint(jointID: number) {
    this.executeJointAction(
      jointID,
      (joint) => true,
      'error',
      'success',
      (joint) => {
        //perform deletion, need helper functions to handle links(and their forces), and compound links.

        for (let link of this._links.values()) {
          if (link.containsJoint(joint.id)) {
            try {
              link.removeJoint(joint.id);
            } catch (error: any) {
              //only error thrown here is when the link now only has 1 joint and must be deleted.
              this.removeLink(link.id);
            }
          }
        }
        this._joints.delete(joint.id);
      }
    );
  }
  //----------------------------JOINT CONTEXT MENU ACTIONS VERIFIERS----------------------------

  canAddInput(joint: Joint): boolean {
    //check if the joint knows it can be an input
    if (!joint.canAddInput()) return false;

    let numberOfEffectiveConnectedLinks =
      this.getNumberOfEffectiveConnectedLinksForJoint(joint);
    //If a revolute grounded joint is connected to more than one link and isn't welded to all of them it cannot be an input.
    return !(joint.isGrounded && numberOfEffectiveConnectedLinks > 1);
  }
  canRemoveInput(joint: Joint): boolean {
    return joint.canRemoveInput();
  }
  canAddGround(joint: Joint): boolean {
    return joint.canAddGround();
  }
  canRemoveGround(joint: Joint): boolean {
    return joint.canRemoveGround();
  }

  canAddWeld(joint: Joint): boolean {
    let count = 0;
    for (let link of this._links.values()) {
      if (link.containsJoint(joint)) count++;
    }
    return count >= 2;
  }
  canRemoveWeld(joint: Joint): boolean {
    return joint.canRemoveWeld();
  }
  canAddSlider(joint: Joint): boolean {
    return joint.canAddSlider();
  }
  canRemoveSlider(joint: Joint): boolean {
    return joint.canRemoveSlider();
  }

  //----------------------------JOINT EDIT MENU ACTIONS----------------------------

  /**
   * Moves a joint to a new specified x coordinate.
   *
   * @param {number} jointID
   * @param newCoord
   * @memberof Mechanism
   */
  setJointCoord(jointID: number, newCoord: Coord) {
    this.executeJointAction(
      jointID,
      () => true,
      'error',
      'success',
      (joint) => {
        joint.setCoordinates(newCoord);
      }
    );
  }
  /**
   * Moves a joint to a new specified x coordinate.
   *
   * @param {number} jointID
   * @param {number} newXCoord
   * @memberof Mechanism
   */
  setXCoord(jointID: number, newXCoord: number) {
    this.executeJointAction(
      jointID,
      () => true,
      'error',
      'success',
      (joint) => {
        joint.coords.x = newXCoord;
      }
    );
  }

  /**
   *Moves a joint to a new specified y coordinate.
   *
   * @param {number} jointID
   * @param {number} newYCoord
   * @memberof Mechanism
   */
  setYCoord(jointID: number, newYCoord: number) {
    this.executeJointAction(
      jointID,
      (joint) => true,
      'error',
      'success',
      (joint) => {
        joint.coords.y = newYCoord;
      }
    );
  }
  /**
   * Given two joints and a desired length between them, moves the first joint along the line which passes between both joints(maintains angle) to a position that satisfies the length
   *
   * @param {number} jointIDtoChange
   * @param {number} jointIDReference
   * @param {number} newDistance
   * @memberof Mechanism
   */
  setDistanceToJoint(
    jointIDtoChange: number,
    jointIDReference: number,
    newDistance: number
  ) {
    let jointB = this._joints.get(jointIDReference);
    if (jointB === undefined) {
      console.error(`Joint with ID ${jointIDReference} does not exist`);
      return;
    }
    this.executeJointAction(
      jointIDtoChange,
      (joint) => true,
      'error',
      'success',
      (joint) => {
        joint.setDistancetoJoint();
      }
    );
  }
  /**
   * Given two joints and a desired angle between them, rotates the first joint around the second(mantaining same distance) until the desired angle is reached.
   *
   * @param {number} jointIDtoChange
   * @param {number} jointIDReference
   * @param {number} newAngle
   * @memberof Mechanism
   */
  setAngleToJoint(
    jointIDtoChange: number,
    jointIDReference: number,
    newAngle: number
  ) {
    let jointB = this._joints.get(jointIDReference);
    if (jointB === undefined) {
      console.error(`Joint with ID ${jointIDReference} does not exist`);
      return;
    }
    this.executeJointAction(
      jointIDtoChange,
      () => true,
      'error',
      'success',
      (joint) => {
        joint.setAngletoJoint(newAngle);
      }
    );
  }

  //----------------------------LINK CONTEXT MENU ACTIONS----------------------------
  /**
   * Higher Order function that performs all available actions on links
   * 1. Checks the linkID is valid and gets the link to change
   * 2. Attempts to perform the modification to the link based on the passed function.
   * Outline: this.executeLinkAction(linkID, link => {});
   * @private
   * @param {number} linkID
   * @param {(link: Link) => void} action
   * @param synthesized
   * @return {*}
   * @memberof Mechanism
   */
  private executeLinkAction(
    linkID: number,
    action: (link: Link) => void,
    synthesized?: boolean
  ) {
    let link = this._links.get(linkID);
    let isSynth: boolean = false;
    if (typeof synthesized !== 'undefined') {
      isSynth = synthesized;
    }
    if (link === undefined) {
      console.error(`Link with ID ${linkID} does not exist`);
      return;
    }
    action(link);
    if (!isSynth) this.notifyChange();
    //console.log(this);
  }

  /**
   * Executes an action on the specified position if it exists.
   * @param positionId The ID of the position to act upon.
   * @param action The action to execute.
   */
  private executePositionAction(
    positionId: number,
    action: (position: Position) => void
  ): void {
    if (this._positions.has(positionId)) {
      const position = this._positions.get(positionId);
      if (position) {
        action(position);
      }
    } else {
      console.error(`Position with ID ${positionId} does not exist.`);
    }
  }

  /**
   * attaches a tracer point(effectively a joint) to a an existing link.
   *
   * @param {number} linkID
   * @param {Coord} coord
   * @memberof Mechanism
   */
  addJointToLink(linkID: number, coord: Coord) {
    this.executeLinkAction(linkID, (link) => {
      let jointA = new Joint(this._jointIDCount, coord);
      this._jointIDCount++;
      this._joints.set(jointA.id, jointA);
      link.addTracer(jointA);
    });
  }

  /**
   * attaches a tracer point(effectively a joint) to a an existing link.
   *
   * @param {number} linkID
   * @param {Coord} coord
   * @memberof Mechanism
   */
  addJointToPosition(posID: number, coord: Coord) {
    this.executePositionAction(posID, (position) => {
      let jointA = new Joint(this._jointIDCount, coord);
      this._jointIDCount++;
      this._joints.set(jointA.id, jointA);
      position.addTracer(jointA);
    });
  }

  /**
   * attaches a new link to another link at a point along the existing link which is not a joint.
   *
   * @param {number} linkID
   * @param {Coord} startCoord
   * @param {Coord} endCoord
   * @memberof Mechanism
   */
  addLinkToLink(
    linkID: number,
    startCoord: Coord,
    endCoord: Coord,
    synthesized?: boolean
  ) {
    this.executeLinkAction(
      linkID,
      (link) => {
        //create new joints and link
        let jointA = new Joint(this._jointIDCount, startCoord);
        this._jointIDCount++;
        let jointB = new Joint(this._jointIDCount, endCoord);
        this._jointIDCount++;
        let linkB = new Link(this._linkIDCount, jointA, jointB);
        this._linkIDCount++;
        //add new joints and links to mechanism
        this._joints.set(jointA.id, jointA);
        this._joints.set(jointB.id, jointB);
        this._links.set(linkB.id, linkB);
        //attach links
        link.addTracer(jointA);
      },
      synthesized
    );
  }
  /**
   *attaches a force to a an existing link.
   *
   * @param {number} linkID
   * @param {Coord} startCoord
   * @param {Coord} endCoord
   * @memberof Mechanism
   */
  addForceToLink(linkID: number, startCoord: Coord, endCoord: Coord) {
    this.executeLinkAction(linkID, (link) => {
      let forceA = new Force(this._forceIDCount, startCoord, endCoord, link);
      forceA.name = 'F' + this.toSubscript(this._forceIDCount.toString());
      this._forceIDCount++;
      this._forces.set(forceA.id, forceA);
      link.addForce(forceA);
      console.log('forceAdded! num: ' + this._forceIDCount);
    });
  }
  /**
   * deletes a link from the mechanism, and cascades this deletion into affected forces, joints, and compound links.
   *
   * @param {number} linkID
   * @memberof Mechanism
   */
  removeLink(linkID: number) {
    this.executeLinkAction(linkID, (link) => {
      //Delete all forces associated with this link.
      this.removeLinkCascadeForces(link);
      //If this link is the only link associated with a joint, delete it.
      this.removeLinkCascadeJoints(link);
      //If this link is part of any compound link, the compound link must be readjusted
      this.removeLinkCascadeCompoundLinks(link);
      this._links.delete(link.id);
    });
  }

  public removePosition(positionId: number): void {
    this.executePositionAction(positionId, (position) => {
      // If this position is the only one associated with a joint, delete it.
      this.removePositionCascadeJoints(position);

      // Finally, delete the position from the map
      this._positions.delete(position.id);
      console.log(`Position with ID ${positionId} removed.`);
    });
  }

  //----------------------------LINK HELPERS----------------------------
  private removeLinkCascadeForces(link: Link) {
    for (let forceID of link.forces.keys()) {
      link.removeForce(forceID);
      this._forces.delete(forceID);
    }
  }
  private removeLinkCascadeJoints(link: Link) {
    for (let joint of link.joints.values()) {
      let isIsolated = true; //assume joint is isolated initially

      //check if joint is part of any other link
      for (let alink of this._links.values()) {
        if (alink.id !== link.id && alink.containsJoint(joint.id)) {
          isIsolated = false; //joint isn't isolated, move to next joint
          break;
        }
      }
      //Delete isolated joint
      if (isIsolated) {
        this._joints.delete(joint.id);
      }
    }
  }

  /**
   * Checks if this position is the only one associated with a joint and removes it if so.
   * @param position The position to check.
   */
  private removePositionCascadeJoints(position: Position): void {
    for (let joint of position.joints.values()) {
      let isIsolated = true; // Assume joint is isolated initially

      // Check if joint is part of any other position
      for (let aPosition of this._positions.values()) {
        if (aPosition.id !== position.id && aPosition.containsJoint(joint.id)) {
          isIsolated = false; // Joint isn't isolated, move to next joint
          break;
        }
      }

      // Delete isolated joint
      if (isIsolated) {
        this._joints.delete(joint.id);
        console.log(`Isolated joint with ID ${joint.id} removed.`);
      }
    }
  }

  // first removes every link within the compound link, then the compound link itself
  public removeCompoundLink(compoundLink: CompoundLink) {
    for (let link of compoundLink.links.values()) {
      this.removeLink(link.id);
    }
    this._compoundLinks.delete(compoundLink.id);
  }

  private removeLinkCascadeCompoundLinks(link: Link) {
    let compoundLink: CompoundLink | undefined;
    compoundLink = undefined;
    //find the compound link this link is a part of if there is one
    for (let compound of this._compoundLinks.values()) {
      if (compound.containsLink(link.id)) {
        compoundLink = compound;
        break;
      }
    }
    if (compoundLink === undefined) return;
    try {
      compoundLink.removeLink(link);
    } catch (error) {
      //This means the compound link only has one link in it after the deletion. ie it shouldn't exist anymore
      this._compoundLinks.delete(compoundLink.id);
    }
  }
  //----------------------------LINK EDIT MENU ACTIONS----------------------------
  /**
   * Sets the name of a link given its ID.
   *
   * @param {number} linkID
   * @param {string} newName
   * @memberof Mechanism
   */
  setLinkName(linkID: number, newName: string) {
    this.executeLinkAction(linkID, (link) => {
      link.name = newName;
    });
  }
  /**
   * Sets the length of a link given its ID.
   *
   * @param {number} linkID
   * @param {number} newLength
   * @memberof Mechanism
   */
  /*
    setLinkLength(linkID: number, newLength: number) {
        this.executeLinkAction(linkID, link => {link.setLength(newLength);});
    }
     */
  /**
   * Sets the angle of a link relative to the x axis, while maintaining its length given its ID.
   *
   * @param {number} linkID
   * @param {number} newAngle
   * @memberof Mechanism
   */

  setLinkAngle(linkID: number, refJoint: Joint, newAngle: number) {
    this.executeLinkAction(linkID, (link) => {
      link.setAngle(newAngle, refJoint);
    });
  }

  /**
   * Changes the mass of a specified Link
   *
   * @param {number} linkID
   * @param {number} newMass
   * @memberof Mechanism
   */
  setLinkMass(linkID: number, newMass: number) {
    this.executeLinkAction(linkID, (link) => {
      link.mass = newMass;
    });
  }
  //----------------------------FORCE CONTEXT MENU ACTIONS----------------------------

  /**
   * Higher Order function that performs all available actions on forces
   * 1. Checks the forceID is valid and gets the force to change
   * 2. Attempts to perform the modification to the force based on the passed function.
   *
   * @private
   * @param {number} forceID
   * @param {(force: Force) => void} action
   * @return {*}
   * @memberof Mechanism
   */
  private executeForceAction(forceID: number, action: (force: Force) => void) {
    let force = this._forces.get(forceID);
    if (force === undefined) {
      console.error(`Force with ID ${forceID} does not exist`);
      return;
    }
    action(force);
    this.notifyChange();
  }

  /**
   * Rotates a force 180 degrees to be pointed in the opposite direction.
   *
   * @param {number} forceID
   * @memberof Mechanism
   */
  switchForceDirection(forceID: number) {
    this.executeForceAction(forceID, (force) => force.switchForceDirection());
  }
  /**
   * Changes the frame of reference of the force, either local to the link which it is attached, or global, acting on all forces.
   *
   * @param {number} forceID
   * @memberof Mechanism
   */
  changeForceFrame(forceID: number) {
    this.executeForceAction(forceID, (force) => force.changeFrameOfReference());
  }
  /**
   * Deletes a force from the mechanism and from the link it was associated with.
   *
   * @param {number} forceID
   * @memberof Mechanism
   */
  removeForce(forceID: number) {
    this.executeForceAction(forceID, (force) => {
      for (let link of this._links.values()) {
        if (link.containsForce(forceID)) {
          link.removeForce(forceID);
        }
      }
      this._forces.delete(forceID);
    });
  }

  //----------------------------FORCE EDIT MENU ACTIONS----------------------------
  /**
   *Sets the name of a force given its ID.
   *
   * @param {number} forceID
   * @param {string} newName
   * @memberof Mechanism
   */
  setForceName(forceID: number, newName: string) {
    this.executeForceAction(forceID, (force) => (force.name = newName));
  }
  /**
   * Sets the magnitude of a force given its ID.
   *
   * @param {number} forceID
   * @param {number} newMagnitude
   * @memberof Mechanism
   */
  setForceMagnitude(forceID: number, newMagnitude: number) {
    this.executeForceAction(
      forceID,
      (force) => (force.magnitude = newMagnitude)
    );
  }
  /**
   * Sets the x component(not be confused with individual coordinates) of a force given its ID by changing its end coordinate.
   *
   * @param {number} forceID
   * @param {number} newXComp
   * @memberof Mechanism
   */
  setForceXComp(forceID: number, newXComp: number) {
    this.executeForceAction(forceID, (force) => force.setXComp(newXComp));
  }
  /**
   *Sets the y component(not be confused with individual coordinates) of a force given its ID by changing its end coordinate.
   *
   * @param {number} forceID
   * @param {number} newYComp
   * @memberof Mechanism
   */
  setForceYComp(forceID: number, newYComp: number) {
    this.executeForceAction(forceID, (force) => force.setYComp(newYComp));
  }
  /**
   *Sets the start coordinate of a force given its ID by changing its start coordinate.
   *
   * @param {number} forceID
   * @param {number} newYComp
   * @memberof Mechanism
   */
  setForceStart(forceID: number, newStart: Coord) {
    this.executeForceAction(forceID, (force) =>
      force.setStartCoordinate(newStart)
    );
  }
  /**
   *Sets the end coordinate of a force given its ID by changing its end coordinate.
   *
   * @param {number} forceID
   * @param {number} newYComp
   * @memberof Mechanism
   */
  setForceEnd(forceID: number, newEnd: Coord) {
    this.executeForceAction(forceID, (force) => force.setEndCoordinate(newEnd));
  }
  /**
   * Sets the angle of a force relative to the x axis while maintaining its length given its ID.
   *
   * @param {number} forceID
   * @param {number} newAngle
   * @memberof Mechanism
   */
  setForceAngle(forceID: number, newAngle: number) {
    this.executeForceAction(forceID, (force) => force.setForceAngle());
  }

  //----------------------------HELPER FUNCTIONS----------------------------

  toSubscript(num: number | string): string {
    const subscriptMap: Record<string, string> = {
      '0': '₀',
      '1': '₁',
      '2': '₂',
      '3': '₃',
      '4': '₄',
      '5': '₅',
      '6': '₆',
      '7': '₇',
      '8': '₈',
      '9': '₉',
      '-': '₋',
      '+': '₊',
      '=': '₌',
      '(': '₍',
      ')': '₎',
    };

    return String(num)
      .split('')
      .map((char) => subscriptMap[char] || char)
      .join('');
  }
  getConnectedLinksForJoint(joint: Joint): Link[] {
    let connectedLinks: Link[] = [];
    for (let link of this._links.values()) {
      if (link.containsJoint(joint.id)) {
        connectedLinks.push(link);
      }
    }
    return connectedLinks;
  }
  private getConnectedCompoundLinks(joint: Joint): CompoundLink[] {
    let connectedCompoundLinks: CompoundLink[] = [];
    for (let link of this._compoundLinks.values()) {
      if (link.containsJoint(joint.id)) {
        connectedCompoundLinks.push(link);
      }
    }
    return connectedCompoundLinks;
  }
  private getNumberOfEffectiveConnectedLinksForJoint(joint: Joint): number {
    let connectedLinks: Link[] = this.getConnectedLinksForJoint(joint);
    let connectedCompoundLinks: CompoundLink[] =
      this.getConnectedCompoundLinks(joint);
    let numberOfConnectedCompoundLinks: number =
      connectedCompoundLinks.length.valueOf();
    let numberOfConnectedLinks: number = connectedLinks.length.valueOf();
    let duplicates: number = 0;
    for (let compoundLink of connectedCompoundLinks) {
      for (let link of compoundLink.links.values()) {
        if (link.containsJoint(joint.id)) duplicates++;
      }
    }
    return numberOfConnectedLinks - duplicates + numberOfConnectedCompoundLinks;
  }
  private getEffectiveConnectedLinksForJoint(joint: Joint): RigidBody[] {
    let connectedLinks: Link[] = this.getConnectedLinksForJoint(joint);
    let connectedCompoundLinks: CompoundLink[] =
      this.getConnectedCompoundLinks(joint);

    for (let compoundLink of connectedCompoundLinks) {
      for (let link of compoundLink.links.values()) {
        connectedLinks = connectedLinks.filter(
          (connectedLink) => connectedLink.id !== link.id
        );
      }
    }
    return [...connectedLinks, ...connectedCompoundLinks] as RigidBody[];
  }

  public hasPositionWithId(id: number): boolean {
    return this._positions.has(id);
  }

  //----------------------------GET FUNCTIONS----------------------------
  getJoint(id: number): Joint {
    return <Joint>this._joints.get(id) || this._joints.get(id);
  }

  getLink(id: number): Link {
    return <Link>this._links.get(id);
  }

  get_jointIDCount(): number {
    return this._jointIDCount;
  }

  getLinks(): IterableIterator<Link> {
    return this._links.values();
  }

  getArrayOfLinks(): Array<Link> {
    return Array.from(this._links.values());
  }

  public getPositions(): Iterable<Position> {
    return this._positions.values();
  }

  getArrayOfPositions(): Position[] {
    return Array.from(this._positions.values());
  }

  public getTrajectories(): Iterable<Trajectory> {
    //console.log('Trajectories:', this._trajectories.values());
    return this._trajectories.values();
  }

  getArrayOfTrajectories(): Array<Trajectory> {
    return Array.from(this._trajectories.values());
  }

  getJoints(): IterableIterator<Joint> {
    return this._joints.values();
  }

  getArrayOfJoints(): Array<Joint> {
    return Array.from(this._joints.values());
  }

  getIndependentLinks(): IterableIterator<Link> {
    let allLinks: Map<number, Link> = new Map();
    for (let [id, link] of this._links) {
      allLinks.set(id, link);
    }
    for (let compound of this._compoundLinks.values()) {
      for (let linkID of compound.links.keys()) {
        allLinks.delete(linkID);
      }
    }
    return allLinks.values();
  }

  getCompoundLinks(): IterableIterator<CompoundLink> {
    return this._compoundLinks.values();
  }
  getArrayOfCompoundLinks(): Array<CompoundLink> {
    return Array.from(this._compoundLinks.values());
  }
  getForces(): IterableIterator<Force> {
    return this._forces.values();
  }
  getArrayOfForces(): Array<Force> {
    return Array.from(this._forces.values());
  }
  //----------------------------SET FUNCTIONS----------------------------
  set_jointIDCount(count: number) {
    this._jointIDCount = count;
  }
  setTrajectory(jointId: number, trajectory: Trajectory): void {
    this._trajectories.set(jointId, trajectory);
  }
  setCouplerLength(length: number){
  this._positionLengthChange.next(length);
  this._positions.forEach(pos => {
    pos.setLength(length);
  });
  }
  setPositionAngle(angle: number, id: number){
    let pos = this._positions.get(id);
    pos?.setAngle(angle, this._positionReference);
    console.log(pos)
  }
  setPositionLocation(newPosition: Coord, id: number){
    let pos = this._positions.get(id);
    if(!pos) return;
    console.log(newPosition)
    let ref: Coord = this.getReferenceJoint(pos).coords;
    let difference: Coord = newPosition.subtract(ref);
    pos._joints.forEach(joint =>{
      joint._coords = joint._coords.add(difference);
    })
  }
//HELPER FOR setCouplerLength
  getReferenceJoint(position: Position): Joint {
    if (this._positionReference === 'Back') {
      return position.getJoints()[0];
    } else if (this._positionReference === 'Front') {
      return position.getJoints()[1];
    } else {
      return position.getJoints()[2];
    }
  }


  //----------------------------CLEAR FUNCTIONS----------------------------
  clearTrajectories(): void {
    this._trajectories.clear();
  }

  clearLinks(): void {
    this._links.clear();
    this._linkIDCount = 0;

    this._joints.clear();
    this._jointIDCount = 0;

    this._compoundLinks.clear();
    this._compoundLinkIDCount = 0;

    this.notifyChange();
  }
  clearPositions() {
    this._positions.clear();
    this.notifyChange();
  }

  //----------------------------GET FUNCTIONS FOR KINEMATICS----------------------------
  getSubMechanisms(): Array<Map<Joint, RigidBody[]>> {
    const subMechanisms: Array<Map<Joint, RigidBody[]>> = new Array();
    const visitedJoints: Set<Joint> = new Set();
    const sublinkIndex: number = 0;
    for (let joint of this._joints.values()) {
      if (!visitedJoints.has(joint)) {
        const subMechanism: Map<Joint, RigidBody[]> = new Map();
        this.connectedJointsDFS(joint, visitedJoints, subMechanism);
        subMechanisms.push(subMechanism);
      }
    }

    return subMechanisms;
  }

  private connectedJointsDFS(
    joint: Joint,
    visited: Set<Joint>,
    subMechanism: Map<Joint, RigidBody[]>
  ) {
    visited.add(joint);

    subMechanism.set(joint, this.getEffectiveConnectedLinksForJoint(joint));
    subMechanism.get(joint)?.forEach((link) => {
      for (let connectedJoint of link.getJoints())
        if (!visited.has(connectedJoint)) {
          this.connectedJointsDFS(connectedJoint, visited, subMechanism);
        }
    });
  }

  /**
   * Reconstructor Methods
   *  Adds configured objects to the mechanism.
   */

  public _addJoint(joint: Joint): void {
    this._joints.set(joint.id, joint);
    this._jointIDCount++;
  }

  public _addLink(link: Link): void {
    this._links.set(link.id, link);
    this._linkIDCount++;
  }

  public _addCompoundLink(compoundLink: CompoundLink): void {
    this._compoundLinks.set(compoundLink.id, compoundLink);
    this._compoundLinkIDCount++;
  }

  public _addForce(force: Force): void {
    this._forces.set(force.id, force);
    this._forceIDCount++;
  }

  public _addPosition(position: Position): void {
    this._positions.set(position.id, position);
    this._positionIDCount++;
    this._refIdCount--;
  }
  //Does the same as the above but does not increment the idCount
  public _addPositionSilent(position: Position): void {
    this._positions.set(position.id, position);
    this._refIdCount--;
  }

  public _addTrajectory(trajectory: Trajectory): void {
    this._trajectories.set(trajectory.id, trajectory);
  }
}
