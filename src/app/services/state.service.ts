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

/*
Stores the global state of the application. This includes the model, global settings, and Pan/Zoom State. This is a singleton service.
Handles syncing client with server state, and undo/redo.
*/


@Injectable({
    providedIn: 'root'
})
export class StateService {

    private mechanism: Mechanism;// = new Mechanism();
    //Need to use BehaviorSubjects when moving data between unrelated components
    private globalUnits = new BehaviorSubject("Metric (cm)");
    private globalUnitsSuffix = new BehaviorSubject("cm")
    private globalAngles = new BehaviorSubject("Degree (º)");
    private globalAnglesSuffix = new BehaviorSubject("º");
    private globalActivePanel = new BehaviorSubject("Edit");
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
  public reconstructFromUrl(rawData:
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
        if(Boolean(joint.isGrounded==1)){ newJoint.addGround();}
        newJoint.speed = Number(joint.inputSpeed);
        if (Boolean(joint.isWelded)) {newJoint.addWeld();}
        newJoint.locked = Boolean(joint.locked);
        newJoint.hidden = Boolean(joint.isHidden);
        newJoint.reference = Boolean(joint.isReference);
        if(Boolean(joint.isInput)) { newJoint.addInput();}

        this.mechanism._addJoint(newJoint);
      }
      console.log("AFTER JOINTADDS", this.mechanism.getArrayOfJoints())
    }

    //Links TODO FORCES IMPLEMENTATION
    if (rawData.decodedLinks) {
      for (const link of rawData.decodedLinks) {
        console.log(link.joints);

        let jointsArray: Joint[] = link.joints.map((element: string):Joint => {return this.mechanism.getJoint(Number(element))});
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
        let linksArray: Link[] = compoundlink.links.map((element: string):Link => {return this.mechanism.getLink(Number(element))});
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

        let jointsArray: Joint[] = position.joints.map((element: string):Joint => {return this.mechanism.getJoint(Number(element))});

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
}
