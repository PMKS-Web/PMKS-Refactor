import { Injectable } from '@angular/core';
import { Mechanism } from '../model/mechanism';
import { BehaviorSubject, Subject } from 'rxjs';
import { Joint } from '../model/joint';
import { Link } from '../model/link';
import { CompoundLink } from '../model/compound-link';
import { Trajectory } from '../model/trajectory';
import { Force } from '../model/force';
import { Position } from '../model/position';
import { Coord } from '../model/coord';
import { AnimationBarComponent } from '../components/AnimationBar/animationbar/animationbar.component';
import { Action } from '../components/ToolBar/undo-redo-panel/action';
import { ThreePosSynthesis } from '../components/SideNav/Synthesis/three-pos-synthesis/three-pos-synthesis.component';
import { InteractionService } from './interaction.service';

/*
Stores the global state of the application. This includes the model, global settings, and Pan/Zoom State. This is a singleton service.
Handles syncing client with server state, and undo/redo.
*/

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private showIDLabelsSubject = new BehaviorSubject<boolean>(false);
  showIDLabels$ = this.showIDLabelsSubject.asObservable();
  /**These generateBarSubjects need to be here because
   * the logic is all in the component and not in a
   * service, eventually it should be refactored.
   */
  private generateFourBarSubject = new Subject<void>();
  private generateSixBarSubject = new Subject<void>();
  generateFourBar$ = this.generateFourBarSubject.asObservable();
  generateSixBar$ = this.generateSixBarSubject.asObservable();

  // Toggles the visibility of ID labels on all components.
  toggleShowIDLabels() {
    const currentValue = this.showIDLabelsSubject.value;
    this.showIDLabelsSubject.next(!currentValue);
  }

  // Hides all ID labels by setting the subject to false.
  public hideIDLabels() {
    this.showIDLabelsSubject.next(false);
  }

  private readonly mechanism: Mechanism; // = new Mechanism();
  //Need to use BehaviorSubjects when moving data between unrelated components
  private globalUnits = new BehaviorSubject('Metric (cm)');
  private globalUnitsSuffix = new BehaviorSubject('cm');
  private globalAngles = new BehaviorSubject('Degree (º)');
  private globalAnglesSuffix = new BehaviorSubject('º');
  private globalActivePanel = new BehaviorSubject('Edit');

  private animationbarComponent!: AnimationBarComponent;

  globalUnitsCurrent = this.globalUnits.asObservable();
  globalUSuffixCurrent = this.globalUnitsSuffix.asObservable();
  globalAnglesCurrent = this.globalAngles.asObservable();
  globalASuffixCurrent = this.globalAnglesSuffix.asObservable();
  globalActivePanelCurrent = this.globalActivePanel.asObservable();

  public sixBarGenerated: boolean = false;
  public fourBarGenerated: boolean = false;

  constructor() {
    console.log('StateService constructor');
    this.mechanism = new Mechanism();
  }

  private reinitializeSubject = new Subject<void>();
  public reinitialize$ = this.reinitializeSubject.asObservable();

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
  public reconstructMechanism(rawData: {
    decodedJoints: any[];
    decodedLinks: Link[];
    decodedCompoundLinks: any[];
    decodedTrajectories: any[];
    decodedForces: Force[];
    decodedPositions: Position[];
  }): void {
    // A fresh Mechanism
    this.mechanism.clearLinks();
    this.mechanism.clearTrajectories();
    this.mechanism.clearPositions();

    //Joints
    if (rawData.decodedJoints) {
      for (const joint of rawData.decodedJoints) {
        let newJoint = new Joint(
          Number(joint.id),
          Number(joint.x),
          Number(joint.y)
        );
        newJoint.name = joint.name;
        newJoint.angle = joint.angle;
        if (Boolean(joint.isGrounded)) {
          newJoint.addGround();
        }
        if (Boolean(joint.isWelded)) {
          newJoint.addWeld();
        }
        newJoint.locked = Boolean(joint.locked);
        newJoint.hidden = Boolean(joint.isHidden);
        newJoint.reference = Boolean(joint.isReference);
        newJoint.generated = Boolean(joint.isGenerated);
        if (Boolean(joint.isInput)) {
          newJoint.addInput();
        }
        newJoint.speed = Number(joint.inputSpeed);
        if (Boolean(!joint.type)) {
          newJoint.addSlider();
        }

        this.mechanism._addJoint(newJoint);
      }
    }
    // Links
    if (rawData.decodedLinks) {
      for (const link of rawData.decodedLinks) {
        let jointsArray: Joint[] = (link.joints as unknown as string)
          .split('|')
          .map((element: string): Joint => {
            return this.mechanism.getJoint(Number(element));
          });
        console.log('JOINTS');
        console.log(this.mechanism.getArrayOfJoints());
        console.log(link.joints);
        console.log(this.mechanism.getJoint(17));
        for (const x of jointsArray) {
          console.log(x.id);
        }
        console.log(link, link.id);
        let newLink = new Link(link.id, jointsArray);
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
        let linksArray: Link[] = compoundlink.links
          .split('|')
          .map((element: string): Link => {
            return this.mechanism.getLink(Number(element));
          });
        let newCompoundLink = new CompoundLink(compoundlink.id, linksArray);
        newCompoundLink.name = compoundlink.name;
        newCompoundLink.mass = compoundlink.mass;
        newCompoundLink.lock = Boolean(compoundlink.lock);
        newCompoundLink.color = compoundlink.color;

        this.mechanism._addCompoundLink(newCompoundLink);
      }
    }

    //Positions
    if (rawData.decodedPositions) {
      for (const position of rawData.decodedPositions) {
        const jointsArray = (position.joints as unknown as number[]).map((id) =>
          this.mechanism.getJoint(Number(id))
        );
        let newPosition = new Position(Number(position.id), jointsArray);
        newPosition.name = position.name;
        newPosition.mass = position.mass;
        newPosition.angle = Number(position.angle);
        newPosition.locked = Boolean(position.locked);
        newPosition.setColor(position.color); //
        newPosition.setReference(position.refPoint);

        this.mechanism._addPosition(newPosition);
      }
      this.reinitializeSubject.next();
    }

    //Forces
    if (rawData.decodedForces) {
      console.log('force:');
      console.log(rawData.decodedForces);
      for (const force of rawData.decodedForces) {
        let startCoord = new Coord(force.start.x, force.start.y);
        let endCoord = new Coord(force.end.x, force.end.y);
        let newForce = new Force(
          force.id,
          startCoord,
          endCoord,
          this.mechanism.getLink(force.parentLink as unknown as number)
        );
        newForce.name = force.name;
        newForce.magnitude = newForce.start.getDistanceTo(newForce.end);
        const coord1 = newForce.end.subtract(newForce.start);
        newForce.angle = Math.atan2(coord1.y, coord1.x) * (180 / Math.PI);
        newForce.frameOfReference = force.frameOfReference;
        newForce.parentLink.addForce(newForce);
        console.log('force:');
        console.log(newForce);
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
    this.getMechanism().notifyChange();
  }

  // Stores the reference to the AnimationBarComponent for future use.
  public setAnimationBarComponent(component: AnimationBarComponent): void {
    this.animationbarComponent = component;
  }

  // Retrieves the stored AnimationBarComponent instance.
  public getAnimationBarComponent(): AnimationBarComponent {
    return this.animationbarComponent;
  }

  // Changes the active panel in the UI to the specified panel name.
  public changeActivePanel(panel: string): void {
    this.globalActivePanel.next(panel);
  }

  public get getCurrentActivePanel(): string {
    return this.globalActivePanel.value;
  }

  // Updates the global measurement "units" and their "suffix" based on user selection.
  public changeUnits(units: string, suffix: string) {
    const oldSuffix = this.globalUnitsSuffix.value; 
    if (oldSuffix === suffix) return;
    
    // bring whatever current unit to 'cm'
    // 1cm = 1cm, 1cm = 0.01m, 1cm = 1/2.54in
    // Example: 1in = (?)m. 1in / (1/2.54in) = 2.54cm -> 2.54cm*0.01m = 0.025m. Finish convertion 1in = 0.025m
    const conversionFactor: {[key:string]: number} = {
      'cm': 1,
      'm': 0.01,
      'in': 1/2.54,
    }

    //Read example above to understand
    const fromFractor = conversionFactor[oldSuffix];
    const toFractor = conversionFactor[suffix];
    const conversionRatio = toFractor/fromFractor;

    //Read example above to understand
    this.mechanism.getArrayOfJoints().forEach(joint=>{ // loop through each "joint" in the "mechanism"
      joint.coords.x *= conversionRatio;
      joint.coords.y *= conversionRatio;
      console.log(`new 'x' coordinate conversion: ${joint.coords.x}`);
      console.log(`new 'y' coordinate conversion: ${joint.coords.y}`);
    });    

    this.mechanism.notifyChange();
    this.globalUnits.next(units);
    this.globalUnitsSuffix.next(suffix);
  }

  // Updates the global angle units and their suffix based on user selection.
  public changeAngles(angles: string, suffix: string) {
    this.globalAngles.next(angles);
    this.globalAnglesSuffix.next(suffix);
  }

  // Returns the current Mechanism instance.
  public getMechanism(): Mechanism {
    return this.mechanism;
  }

  // Subscribes to notifications of Mechanism changes as an observable
  public getMechanismObservable() {
    return this.mechanism._mechanismChange$;
  }
}
