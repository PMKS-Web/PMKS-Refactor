import { Injectable } from '@angular/core';
import { Mechanism } from '../model/mechanism';
import {BehaviorSubject} from "rxjs";
import {DecoderService} from "./decoder.service";
import {Joint} from "../model/joint";
import {Link} from "../model/link";
import {CompoundLink} from "../model/compound-link";
import {Trajectory} from "../model/trajectory";
import {Force} from "../model/force";
import {Position} from "../model/position";
import {Coord} from "../model/coord";
import {join} from "@angular/compiler-cli";
import {AnimationBarComponent} from "../components/AnimationBar/animationbar/animationbar.component";
import {Action} from "../components/ToolBar/undo-redo-panel/action";

/*
Stores the global state of the application. This includes the model, global settings, and Pan/Zoom State. This is a singleton service.
Handles syncing client with server state, and undo/redo.
*/


@Injectable({
    providedIn: 'root'
})
export class StateService {

  private showIDLabelsSubject = new BehaviorSubject<boolean>(false);
  showIDLabels$ = this.showIDLabelsSubject.asObservable();

  toggleShowIDLabels() {
    const currentValue = this.showIDLabelsSubject.value;
    this.showIDLabelsSubject.next(!currentValue);
  }

  public hideIDLabels() {
    this.showIDLabelsSubject.next(false);
  }

    private mechanism: Mechanism;// = new Mechanism();
    //Need to use BehaviorSubjects when moving data between unrelated components
    private globalUnits = new BehaviorSubject("Metric (cm)");
    private globalUnitsSuffix = new BehaviorSubject("cm")
    private globalAngles = new BehaviorSubject("Degree (º)");
    private globalAnglesSuffix = new BehaviorSubject("º");
    private globalActivePanel = new BehaviorSubject("Edit");

    private animationbarComponent!: AnimationBarComponent;
    //private undoStack: Mechanism[] = [];
    //private redoStack: Mechanism[] = [];
    private currentState: any = {};

    private maxUndoSize = 2;
    private stateSubject = new BehaviorSubject<any>(this.currentState);
    public state$ = this.stateSubject.asObservable();
    private undoStack: Action[] = [];
    private redoStack: Action[] = [];

  globalUnitsCurrent = this.globalUnits.asObservable();
    globalUSuffixCurrent = this.globalUnitsSuffix.asObservable();
    globalAnglesCurrent = this.globalAngles.asObservable();
    globalASuffixCurrent = this.globalAnglesSuffix.asObservable();
    globalActivePanelCurrent = this.globalActivePanel.asObservable();

  constructor() {
    console.log("StateService constructor");
    this.mechanism = new Mechanism();

  }



  /**
   * Returns a mechanism that is correctly configured,
   *  given a structured data array from the decoder service
   *  Structure:
   *  {  joints: Joint[],
   *     links: Link[],
   *     compoundLinks: CompoundLink[],
   *     trajectories: Trajectory[],
   *     forces: Force[],
   *     positions: Position[]  }
   *
   *        *note that recursive objects (like a link containing a joint),
   *        are stored as an array of number ID's separated by '|'
   * @param rawData
   */
  public reconstructMechanism(rawData:
                            { decodedJoints:any[],
                              decodedLinks:any[],
                              decodedCompoundLinks:any[],
                              decodedTrajectories:any[],
                              decodedForces:any[],
                              decodedPositions:any[] } ) : void {
    // A fresh Mechanism
    //this.mechanism = new Mechanism();

    console.log(rawData);

    console.log(rawData.decodedJoints);
    console.log(rawData.decodedLinks);
    console.log(rawData.decodedCompoundLinks);
    console.log(rawData.decodedTrajectories);
    console.log(rawData.decodedForces);
    console.log(rawData.decodedPositions);

    //Joints
    if (rawData.decodedJoints) {
      console.log("BEFORE JOINTADDS",this.mechanism.getArrayOfJoints())
      for (const joint of rawData.decodedJoints) {
        let newJoint = new Joint(joint.id, Number(joint.x), Number(joint.y));
        newJoint.name = joint.name;
        newJoint.type = Number(joint.type);
        newJoint.angle = (joint.angle);
        if (Boolean(joint.isGrounded)){ newJoint.addGround();}
        if (Boolean(joint.isWelded)) {newJoint.addWeld();}
        newJoint.locked = Boolean(joint.locked);
        newJoint.hidden = Boolean(joint.isHidden);
        newJoint.reference = Boolean(joint.isReference);
        if(Boolean(joint.isInput)) { newJoint.addInput();}
        newJoint.speed = Number(joint.inputSpeed);

        this.mechanism._addJoint(newJoint);
      }
      console.log("AFTER JOINTADDS", this.mechanism.getArrayOfJoints())
    }

    //Links TODO FORCES IMPLEMENTATION
    if (rawData.decodedLinks) {
      for (const link of rawData.decodedLinks) {
        console.log(link.joints);

        let jointsArray: Joint[] = link.joints.split("|").map((element: string):Joint => {return this.mechanism.getJoint(Number(element))});
        console.log(link.joints);
        for (const x of jointsArray) {
          console.log(x.id);
        }
        //if (!link.id) {
          console.log(link, link.id);
        //}
        let newLink = new Link(link.id, jointsArray);
        //link.forces.split("|").forEach((element:number)=> newLink._forces.set()); todo
        newLink.name = link.name;
        newLink.mass = link.mass;
        newLink.angle = link.angle;
        newLink.locked = Boolean(link.locked);
        newLink.color = link.color;

        this.mechanism._addLink(newLink);
      }
    }


    //Compound Links
    if (rawData.decodedCompoundLinks) {
      for (const compoundlink of rawData.decodedCompoundLinks) {
        let linksArray: Link[] = compoundlink.links.split("|").map((element: string):Link => {return this.mechanism.getLink(Number(element))});
        let newCompoundLink = new CompoundLink(compoundlink.id, linksArray);
        newCompoundLink.name = compoundlink.name;
        newCompoundLink.mass = compoundlink.mass;
        newCompoundLink.lock = Boolean(compoundlink.lock);
        newCompoundLink.color = compoundlink.color;

        this.mechanism._addCompoundLink(newCompoundLink);
      }
    }

    //Positions
    //Links TODO FORCES IMPLEMENTATION
    if (rawData.decodedPositions) {
      for (const position of rawData.decodedPositions) {

        let jointsArray: Joint[] = position.joints.split("|").map((element: string):Joint => {return this.mechanism.getJoint(Number(element))});

        let newPosition = new Position(position.id, jointsArray);
        //link.forces.split("|").forEach((element:number)=> newLink._forces.set()); todo
        newPosition.name = position.name;
        newPosition.mass = position.mass;
        newPosition.angle = Number(position.angle);
        newPosition.locked = Boolean(position.locked);
        newPosition.setColor(position.color);//
        newPosition.setReference(position.refPoint);

        this.mechanism._addPosition(newPosition);
      }
    }

    //Forces
    if (rawData.decodedForces) {
      for (const force of rawData.decodedForces) {
        let startCoord = new Coord(force.start.x,force.start.y);
        let endCoord = new Coord(force.end.x, force.end.y);
        let newForce = new Force(force.id, startCoord, endCoord);
        newForce.name = force.name;
        newForce.magnitude = force.magnitude;
        newForce.angle = force.angle;
        newForce.frameOfReference = force.frameOfReference;

        this.mechanism._addForce(newForce);
      }
    }

    //Trajectories
    if (rawData.decodedTrajectories) {
      for (const trajectory of rawData.decodedTrajectories) {
        let newTrajectory = new Trajectory(trajectory.coords, trajectory.id);

        this.mechanism._addTrajectory(newTrajectory);
      }
    }
  }

  public setAnimationBarComponent(component: AnimationBarComponent): void {
    this.animationbarComponent = component;
  }

  public getAnimationBarComponent(): AnimationBarComponent {
    return this.animationbarComponent;
  }

    //todo also load globalUnits, globalUnitsSuffix, globalAngles, globalAnglesSuffix, and globalActivePanel
    public changeActivePanel(panel: string): void {
      this.globalActivePanel.next(panel);
    }

    public changeUnits (units: string, suffix: string){
      this.globalUnits.next(units);
      this.globalUnitsSuffix.next(suffix);
    }

    public changeAngles (angles: string, suffix: string){
      this.globalAngles.next(angles);
      this.globalAnglesSuffix.next(suffix);
    }

    public getMechanism(): Mechanism {
        return this.mechanism;
    }
    public setMechanism(mechanism: Mechanism) {
        this.mechanism = mechanism;
    }
    public getMechanismObservable(){
        return this.mechanism._mechanismChange$;
    }

    public recordAction(action: Action): void {
      if (this.undoStack.length >= this.maxUndoSize) {
        // Remove the oldest action from the stack.
        this.undoStack.shift();
      }
      this.undoStack.push(action);
      this.redoStack = [];
      console.log('Action recorded:', action);
    }

    public canUndo(): boolean {
      return this.undoStack.length > 0;
    }

    public canRedo(): boolean {
      return this.redoStack.length > 0;
    }

  public undo(): void {
    if (!this.canUndo()) {
      console.log('Nothing to undo');
      return;
    }
    const action = this.undoStack.pop()!;
    // Apply the inverse of the action.
    this.applyInverseAction(action);
    // Push the action onto the redo stack.
    this.redoStack.push(action);
    console.log('Undo performed for action:', action);
    this.mechanism.notifyChange();
  }

  // Redo an undone action.
  public redo(): void {
    if (!this.canRedo()) {
      console.log('Nothing to redo');
      return;
    }
    const action = this.redoStack.pop()!;
    // Reapply the original action.
    this.applyAction(action);
    // Push the action back onto the undo stack.
    this.undoStack.push(action);
    console.log('Redo performed for action:', action);
    this.mechanism.notifyChange();
  }

  // Define how to apply an action (redo)
  private applyAction(action: Action): void {
    switch (action.type) {
      case 'addInput':
        if (action.jointId !== undefined) {
          this.mechanism.addInput(action.jointId);
        }
        break;
      case 'removeInput':
        if (action.jointId !== undefined) {
          this.mechanism.removeInput(action.jointId);
        }
        break;
      case 'addGround':
        if (action.jointId !== undefined) {
          this.mechanism.addGround(action.jointId);
        }
        break;
      case 'removeGround':
        if (action.jointId !== undefined) {
          this.mechanism.removeGround(action.jointId);
        }
        break;
      case 'addSlider':
        if (action.jointId !== undefined) {
          this.mechanism.addSlider(action.jointId);
        }
        break;
      case 'removeSlider':
        if (action.jointId !== undefined) {
          this.mechanism.removeSlider(action.jointId);
        }
        break;
      case 'addWeld':
        if (action.jointId !== undefined) {
          this.mechanism.addWeld(action.jointId);
        }
        break;
      case 'removeWeld':
        if (action.jointId !== undefined) {
          this.mechanism.removeWeld(action.jointId);
        }
        break;
      case 'deleteJoint':
        if (action.jointId !== undefined) {
          this.mechanism.removeJoint(action.jointId);
        }

        break;
      default:
        console.error('No inverse defined for action type:', action.type);
    }
  }

// Define how to apply the inverse of an action (for undo)
  private applyInverseAction(action: Action): void {
    switch (action.type) {
      case 'addInput':
        if (action.jointId !== undefined) {
          this.mechanism.removeInput(action.jointId);
        }
        break;
      case 'removeInput':
        if (action.jointId !== undefined) {
          this.mechanism.addInput(action.jointId);
        }
        break;
      case 'addGround':
        if (action.jointId !== undefined) {
          this.mechanism.removeGround(action.jointId);
        }
        break;
      case 'removeGround':
        if (action.jointId !== undefined) {
          this.mechanism.addGround(action.jointId);
        }
        break;
      case 'addSlider':
        if (action.jointId !== undefined) {
          this.mechanism.removeSlider(action.jointId);
        }
        break;
      case 'removeSlider':
        if (action.jointId !== undefined) {
          this.mechanism.addSlider(action.jointId);
        }
        break;
      case 'addWeld':
        if (action.jointId !== undefined) {
          this.mechanism.removeWeld(action.jointId);
        }
        break;
      case 'removeWeld':
        if (action.jointId !== undefined) {
          this.mechanism.addWeld(action.jointId);
        }
        break;
      case 'deleteJoint':
        // Restore main joint:
        if (action.jointData) {
          this.restoreJointFromSnapshot(action.jointData);
        }
        // Restore extra (cascaded) joints:
        if (action.extraJointsData) {
          action.extraJointsData.forEach(jSnap => {
            this.restoreJointFromSnapshot(jSnap);
          });
        }
        // Restore removed links:
        if (action.linksData) {
          action.linksData.forEach(linkSnap => {
            const linkJoints = linkSnap.jointIds.map(jid => this.mechanism.getJoint(jid));
            if (linkJoints.every(j => j !== undefined)) {
              const restoredLink = new Link(linkSnap.id, linkJoints);
              restoredLink.name = linkSnap.name;
              restoredLink.mass = linkSnap.mass;
              restoredLink.angle = linkSnap.angle;
              restoredLink.locked = linkSnap.locked;
              restoredLink.color = linkSnap.color;
              this.mechanism._addLink(restoredLink);
            }
          });
        }

        break;

      default:
        console.error('No inverse defined for action type:', action.type);
    }
  }

  private restoreJointFromSnapshot(jointSnapshot: Action['jointData']): void {
    const restoredJoint = new Joint(jointSnapshot!.id, jointSnapshot!.coords.x, jointSnapshot!.coords.y);
    restoredJoint.name = jointSnapshot!.name;
    restoredJoint.type = jointSnapshot!.type;
    restoredJoint.angle = jointSnapshot!.angle;
    if (jointSnapshot!.isGrounded) restoredJoint.addGround();
    if (jointSnapshot!.isWelded) restoredJoint.addWeld();
    if (jointSnapshot!.isInput) restoredJoint.addInput();
    restoredJoint.speed = jointSnapshot!.inputSpeed;
    restoredJoint.locked = jointSnapshot!.locked;
    restoredJoint.hidden = jointSnapshot!.isHidden;
    restoredJoint.reference = jointSnapshot!.isReference;
    this.mechanism._addJoint(restoredJoint);
  }



}
