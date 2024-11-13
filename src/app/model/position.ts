import {Coord} from '../model/coord';
import {Joint} from '../model/joint';
import {Force} from '../model/force';

export interface RigidBody {
  getJoints(): Joint[];
}

export class Position implements RigidBody {
  private _id: number;
  private _name: string;
  private _mass: number;
  private _centerOfMass: Coord;
  _joints: Map<number, Joint>;
  private _forces: Map<number, Force>;
  private _color: string = "";
  private _isLocked: boolean;
  private _referencePoint: string = "Center";

  private positionColorOptions = [
    '#5E646D87'
    // '#FF5733',
    // '#33FFBD',
    // '#FF33A6',
    // '#335BFF',
    // '#33FF57'
  ];

  constructor(id: number, jointA: Joint, jointB: Joint);
  constructor(id: number, joints: Joint[]);
  constructor(id: number, jointAORJoints: Joint | Joint[], jointB?: Joint) {
    this._id = id;

    this._mass = 0;
    this._forces = new Map();
    this._joints = new Map();
    this._color = this.positionColorOptions[id % this.positionColorOptions.length];
    this._isLocked = false;

    if (Array.isArray(jointAORJoints)) {
      jointAORJoints.forEach(joint => {
        this._joints.set(joint.id, joint);
      });
    } else if (jointB) {
      this._joints.set(jointAORJoints.id, jointAORJoints);
      this._joints.set(jointB.id, jointB);
    } else {
      throw new Error("Invalid Constructor Parameters");
    }

    this._centerOfMass = this.calculateCenterOfMass();
    this._name = this.generateName();
  }

  // Getters
  get id(): number {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get mass(): number {
    return this._mass;
  }

  get color(): string {
    return this._color;
  }

  get centerOfMass(): Coord {
    return this.calculateCenterOfMass();
  }

  get joints(): Map<number, Joint> {
    return this._joints;
  }

  get forces(): Map<number, Force> {
    return this._forces;
  }

  get locked(): boolean {
    return this._isLocked;
  }

  get refPoint(): string {
    return this._referencePoint;
  }

  // Setters
  set name(value: string) {
    this._name = value;
  }

  set mass(value: number) {
    this._mass = value;
  }

  set locked(value: boolean) {
    this._isLocked = value;
    this.updateLocks(value);
  }

  addTracer(newJoint: Joint) {
    this._joints.set(newJoint.id, newJoint);
    this.calculateCenterOfMass();
    this._name = this.generateName();
  }

  updateLocks(value: boolean) {
    console.log('Updating lock in position');
    this._joints.forEach((joint: Joint, key: number) => {
      joint.locked = value;
      console.log(`Joint ${key}: ${joint}`);
    });
  }

  setReference(refPoint:string) {
    this._referencePoint = refPoint; //Needed for component
    const joints = this.getJoints();
    //2 is default reference point in the middle, 0 is leftmost joint, 1 is rightmost joint
    if (refPoint === "Center") {
      joints[2].hidden = false;
      joints[2].reference = true;
      joints[0].reference = false;
      joints[1].reference = false;
    }
    else if (refPoint === "Back"){
      joints[2].hidden = true;
      joints[2].reference = false;
      joints[0].reference = true;
      joints[1].reference = false;
    }
    else if (refPoint === "Front"){
      joints[2].hidden = true
      joints[2].reference = false;
      joints[0].reference = false;
      joints[1].reference = true;
    }
  }

  removeJoint(idORRef: number | Joint) {
    let id: number;
    if (typeof idORRef === 'number') {
      id = idORRef;
    } else {
      id = idORRef.id;
    }

    if (this._joints.has(id)) {
      this._joints.delete(id);
    } else {

    }

    this.calculateCenterOfMass();
    if (this._joints.size === 1) {
      throw new Error("Position now only contains 1 Joint");
    }
    this._name = this.generateName();
  }

  addForce(newForce: Force) {
    this._forces.set(newForce.id, newForce);
  }

  removeForce(idORRef: number | Force) {
    if (typeof idORRef === 'number') {
      this._forces.delete(idORRef);
    } else {
      this._forces.delete(idORRef.id);
    }
  }

  calculateCenterOfMass(): Coord {
    let totalX = 0;
    let totalY = 0;

    this._joints.forEach((joint) => {
      totalX += joint.coords.x;
      totalY += joint.coords.y;
    });

    const numberOfJoints = this._joints.size;
    const centerX = totalX / numberOfJoints;
    const centerY = totalY / numberOfJoints;

    this._centerOfMass = new Coord(centerX, centerY);
    return this._centerOfMass;
  }

  private generateName(): string {
    let nameNum = this.id + 1;
    return "Position " + nameNum.toString();
  }

  calculateLength(): number | null {
    const jointKeys = Array.from(this.joints.keys()).filter(key => {
      const joint = this.joints.get(key);
      return joint !== null && joint !== undefined;
    }).slice(0, 2);

    const jointOne = this.joints.get(jointKeys[0]);
    const jointTwo = this.joints.get(jointKeys[1]);

    if (jointOne && jointTwo) {
      const vectorX = Math.abs(jointOne.coords.x - jointTwo.coords.x);
      const vectorY = Math.abs(jointOne.coords.y - jointTwo.coords.y);
      const hypotenuse = vectorX * vectorX + vectorY * vectorY;
      return Math.sqrt(hypotenuse);
    } else {
      return null;
    }
  }

  calculateAngle(): number | null {
    const jointKeys = Array.from(this.joints.keys()).filter(key => {
      const joint = this.joints.get(key);
      return joint !== null && joint !== undefined;
    }).slice(0, 2);

    const jointOne = this.joints.get(jointKeys[0]);
    const jointTwo = this.joints.get(jointKeys[1]);

    if (jointOne && jointTwo) {
      const vectorX = jointTwo.coords.x - jointOne.coords.x;
      const vectorY = jointTwo.coords.y - jointOne.coords.y;

      const angleInRadians = Math.atan2(vectorY, vectorX);
      let angleInDegrees = angleInRadians * (180 / Math.PI);

      if (angleInDegrees > 180) {
        angleInDegrees -= 360;
      } else if (angleInDegrees < -180) {
        angleInDegrees += 360;
      }

      return angleInDegrees;
    } else {
      return null;
    }
  }

  setLength(newLength: number, refJoint: Joint) {
    const jointKeys = Array.from(this.joints.keys()).filter(key => {
      const joint = this.joints.get(key);
      return joint !== null && joint !== undefined;
    }).slice(0, 2);

    let jointOne = this.joints.get(jointKeys[0]);
    let jointTwo = this.joints.get(jointKeys[1]);

    const currentLength = this.calculateLength();

    if (jointOne && jointTwo && currentLength) {
      if (refJoint.id == jointTwo.id) {
        const temp = jointOne;
        jointOne = jointTwo;
        jointTwo = temp;
      }

      if (jointOne.locked || jointTwo.locked) return;

      const scalingFactor = newLength / currentLength;
      const vectorX = jointTwo.coords.x - jointOne.coords.x;
      const vectorY = jointTwo.coords.y - jointOne.coords.y;

      const scaledVectorX = vectorX * scalingFactor;
      const scaledVectorY = vectorY * scalingFactor;

      jointTwo.coords.x = jointOne.coords.x + scaledVectorX;
      jointTwo.coords.y = jointOne.coords.y + scaledVectorY;
    }
  }

  setAngle(newAngle: number, refJoint: Joint) {
    const jointKeys = Array.from(this.joints.keys()).filter(key => {
      const joint = this.joints.get(key);
      return joint !== null && joint !== undefined;
    }).slice(0, 2);

    let jointOne = this.joints.get(jointKeys[0]);
    let jointTwo = this.joints.get(jointKeys[1]);

    const currentAngle = (this.calculateAngle() as number) + 0.000000001;
    const currentDistance = this.calculateLength();

    if (jointOne && jointTwo && currentAngle && currentDistance) {
      if (refJoint.id == jointTwo.id) {
        const temp = jointOne;
        jointOne = jointTwo;
        jointTwo = temp;
      }

      if (jointOne.locked || jointTwo.locked) return;

      const angleDifference = newAngle - currentAngle;
      const currentAngleInRadians = (currentAngle * Math.PI) / 180;
      const angleInRadians = (angleDifference * Math.PI) / 180;

      const newX = jointOne.coords.x + currentDistance * Math.cos(currentAngleInRadians + angleInRadians);
      const newY = jointOne.coords.y + currentDistance * Math.sin(currentAngleInRadians + angleInRadians);

      jointTwo.coords.x = newX;
      jointTwo.coords.y = newY;
    }
  }

  containsJoint(idORRef: number | Joint): boolean {
    const id = typeof idORRef === 'number' ? idORRef : idORRef.id;
    return this._joints.has(id);
  }

  containsJoints(joints: Joint[]): Joint[] {
    return joints.filter(joint => this._joints.has(joint.id));
  }

  containsForce(idORRef: number | Force): boolean {
    const id = typeof idORRef === 'number' ? idORRef : idORRef.id;
    return this._forces.has(id);
  }

  moveCoordinates(coord: Coord) {
    for (const jointID of this._joints.keys()) {
      const joint = this._joints.get(jointID)!;
      joint.setCoordinates(joint.coords.add(coord));
    }
    for (const forceID of this._forces.keys()) {
      const force = this._forces.get(forceID)!;
      force.setCoordinates(force.start.add(coord), force.end.add(coord));
    }
  }

  // setColor(index: number) {
  //   console.log(index);
  //   this._color = this.positionColorOptions[index];
  //   console.log(this._color);
  // }

  setColor(color: string) {
    this._color = color;
  }

  getJoints(): Joint[] {
    return Array.from(this._joints.values()); // Convert the Map of joints to an array
  }
}
