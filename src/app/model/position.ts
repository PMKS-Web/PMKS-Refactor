import {Coord} from './coord';
import {Joint} from './joint';
import {Force} from './force';

export interface RigidBody {
  getJoints(): Joint[];
}

export class Position implements RigidBody {
  private readonly _id: number;
  private _name: string;
  private _mass: number;
  private _centerOfMass: Coord;
  _joints: Map<number, Joint>;
  private readonly _forces: Map<number, Force>;
  private _color: string = "";
  private _isLocked: boolean;
  private _referencePoint: string = "Center";
  private _angle: number;

  private positionColorOptions = [
    '#5E646D87'
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
    this._angle = 0;

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
    this.setJointNames();

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

  get length(): number {
    let l = this.calculateLength();
    if (l) {
      return parseFloat(l.toFixed(3));
    }
    else throw new Error('Length is null');
  }

  get angle(): number {
    let posangle = (this._angle + 360) % 360;
    return parseFloat(posangle.toFixed(3));
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

  set angle(value: number) {
    this._angle = (value % 360 + 360) % 360;
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
    const joint1 = joints[0];
    const joint2 = joints[1];
    //2 is default reference point in the middle, 0 is leftmost joint, 1 is rightmost joint
    if (refPoint === "Center") {
      joints[2].hidden = false;
      joints[2].reference = true;
      joints[0].reference = false;
      joints[1].reference = false;
      joints[2]._coords.x = (joint1.coords.x + joint2.coords.x) / 2;
      joints[2]._coords.y = (joint1.coords.y + joint2.coords.y) / 2;
      
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

  setJointNames(): void {
    const nameNum = this.id + 1;
    this.getJoints()[0].name = nameNum + "A";
    this.getJoints()[1].name = nameNum + "B";
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

setLength(newLength: number) {
  const jointKeys = Array.from(this.joints.keys()).filter(key => {
    const joint = this.joints.get(key);
    return joint !== null && joint !== undefined;
  }).slice(0, 2);

  const jointOne = this.joints.get(jointKeys[0]);
  const jointTwo = this.joints.get(jointKeys[1]);

  const currentLength = this.calculateLength();

  if (jointOne && jointTwo && currentLength) {
    if (jointOne.locked || jointTwo.locked) return;

    const centerX = (jointOne.coords.x + jointTwo.coords.x) / 2;
    const centerY = (jointOne.coords.y + jointTwo.coords.y) / 2;

    const vectorX = jointTwo.coords.x - jointOne.coords.x;
    const vectorY = jointTwo.coords.y - jointOne.coords.y;
    const angleInRadians = Math.atan2(vectorY, vectorX);

    const halfNewLength = newLength / 2;

    jointOne.coords.x = centerX - halfNewLength * Math.cos(angleInRadians);
    jointOne.coords.y = centerY - halfNewLength * Math.sin(angleInRadians);

    jointTwo.coords.x = centerX + halfNewLength * Math.cos(angleInRadians);
    jointTwo.coords.y = centerY + halfNewLength * Math.sin(angleInRadians);
  }
}

setAngle(newAngle: number, refJoint: string) {
  const joints = this.getJoints();
  const backJoint = joints[0]
  const frontJoint = joints[1]
  const centerJoint = joints[2]
  const currentLength = this.calculateLength();

  if (backJoint && frontJoint && currentLength) {
    if (backJoint.locked || frontJoint.locked) return;

    let referenceJoint: Joint;
    if (refJoint === 'Back') {
      referenceJoint = backJoint;
    } else if (refJoint === 'Front') {
      referenceJoint = frontJoint;
    } else { // 'Center'
      referenceJoint = centerJoint!;
    }

    const newAngleInRadians = (newAngle * Math.PI) / 180;
    const centerX = referenceJoint.coords.x;
    const centerY = referenceJoint.coords.y;
    const halfLength = currentLength / 2;
    const dx = Math.cos(newAngleInRadians);
    const dy = Math.sin(newAngleInRadians);

    if (refJoint === 'Center') {
      // Rotate around center - both joints move
      backJoint.coords.x = centerX - halfLength * dx;
      backJoint.coords.y = centerY - halfLength * dy;
      
      frontJoint.coords.x = centerX + halfLength * dx;
      frontJoint.coords.y = centerY + halfLength * dy;
      
      if (centerJoint) {
        centerJoint._coords.x = centerX;
        centerJoint._coords.y = centerY;
      }
    } else if (refJoint === 'Back') {
      // Rotate around back joint - front joint moves
      frontJoint.coords.x = centerX + currentLength * dx;
      frontJoint.coords.y = centerY + currentLength * dy;
      
      if (centerJoint) {
        centerJoint._coords.x = centerX + halfLength * dx;
        centerJoint._coords.y = centerY + halfLength * dy;
      }
    } else if (refJoint === 'Front') {
      // Rotate around front joint - back joint moves
      backJoint.coords.x = centerX - currentLength * dx;
      backJoint.coords.y = centerY - currentLength * dy;
      
      if (centerJoint) {
        centerJoint._coords.x = centerX - halfLength * dx;
        centerJoint._coords.y = centerY - halfLength * dy;
      }
    }
  }
  const num = this.calculateAngle();
  if(num){
    this._angle = num;
  }
}

  containsJoint(idORRef: number | Joint): boolean {
    const id = typeof idORRef === 'number' ? idORRef : idORRef.id;
    return this._joints.has(id);
  }
  containsForce(idORRef: number | Force): boolean {
    const id = typeof idORRef === 'number' ? idORRef : idORRef.id;
    return this._forces.has(id);
  }
  setColor(color: string) {
    this._color = color;
  }

  getJoints(): Joint[] {
    return Array.from(this._joints.values()); // Convert the Map of joints to an array
  }
}
