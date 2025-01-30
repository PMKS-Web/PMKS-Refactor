
import { Mechanism } from '../model/mechanism';
import { Joint } from '../model/joint';
import { Link } from '../model/link';
import { Force } from '../model/force';
import { Position } from '../model/position';
import { Trajectory } from '../model/trajectory';
import { CompoundLink } from '../model/compound-link';


/*
TODO
     - add encoding for runtime settings
     - Addpositions/Addtrajectories fix
     -Jeremy
 */
export class Encoder {
  private data: string[] = [];

  constructor() {}

  addJoint(joint: Joint): void {
    const jointData = {
      id: joint.id, // Using getters
      name: joint.name, //
      coords: { x: joint.coords.x, y: joint.coords.y }, //
      type: joint.type, //
      angle: joint.angle, //
      isGrounded: joint.isGrounded, //
      isInput: joint.isInput, //
      inputSpeed: joint.inputSpeed, //
      isWelded: joint.isWelded, //
      isReference: joint.isReference, //
    };
    this.data.push(`JOINT:${JSON.stringify(jointData)}`);
  }

  addLink(link: Link): void {
    const linkData = {
      id: link.id, // Using getters
      name: link.name, //
      mass: link.mass, //
      centerOfMass: { x: link.centerOfMass.x, y: link.centerOfMass.y }, //
      joints: Array.from(link.joints.values()).map((joint) => joint.id), //
      forces: Array.from(link.forces.values()).map((force) => force.id), //
      color: link.color, //
      isLocked: link.locked, //
      angle: link.angle, //
    };
    this.data.push(`LINK:${JSON.stringify(linkData)}`);
  }

  addForce(force: Force): void {
    const forceData = {
      id: force.id, //
      name: force.name, //
      start: { x: force.start.x, y: force.start.y }, //
      end: { x: force.end.x, y: force.end.y }, //
      magnitude: force.magnitude, //
      angle: force.angle, //
      frameOfReference: force.frameOfReference, //
    };
    this.data.push(`FORCE:${JSON.stringify(forceData)}`);
  }

  addPositions(positions: Position[]): void {
    positions.forEach(position => {
      const positionData = {
        id: position.id, // Using getter
        name: position.name, // Using getter
        x: position.x, // Using getter, get from coord TODO get from coords
        y: position.y, // Using getter
        description: position.description, // Using getter
      };
      this.data.push(`POSITION:${JSON.stringify(positionData)}`);
    });
  }

  //TODO FIX
  addTrajectories(trajectories: Trajectory[]): void {
    trajectories.forEach(trajectory => {
      const trajectoryData = {
        id: trajectory.id, // Using getter
        name: trajectory.name, // Using getter
        points: trajectory.points, // Using getter
      };
      this.data.push(`TRAJECTORY:${JSON.stringify(trajectoryData)}`);
    });
  }

  //todo fix last 2 lines
  encodeMechanism(mechanism: Mechanism): void {
    mechanism.getArrayOfJoints().forEach((joint: Joint) => this.addJoint(joint));
    mechanism.getArrayOfLinks().forEach((link: Link) => this.addLink(link));
    Array.from(mechanism.getForces()).forEach((force: Force) => this.addForce(force));
    this.addPositions(mechanism.getPositions()); //todo
    this.addTrajectories(mechanism.getTrajectories()); //todo
  }

  getEncodedData(): string {
    return this.data.join(';');
  }
}
