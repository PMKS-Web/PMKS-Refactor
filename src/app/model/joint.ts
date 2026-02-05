import {Coord} from './coord';
import {BehaviorSubject} from "rxjs";

export enum JointType {
  Prismatic,
  Revolute,
}

export class Joint {
  private readonly _id: number;
  private _name: string;
  public _coords: Coord;
  private _type: JointType;
  private _angle: number;
  private _isGrounded: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private _isInput: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private _inputSpeed: number;
  private _isWelded: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private _parentLocked: boolean;
  private _isHidden: boolean;
  private _isReference: boolean;
  private _isGenerated: boolean;
  private _rpmSpeed: number;

  isInput$ = this._isInput.asObservable();
  isGrounded$ = this._isGrounded.asObservable();
  isWelded$ = this._isWelded.asObservable();

  constructor(id: number, x: number, y: number);
  constructor(id: number, coord: Coord);
  constructor(id: number, xORCoord: number | Coord, y?: number) {
    this._id = id;
    // changed name to be the same as ID instead of blank
    if (this.id <= -1) {
      this._name = 'Reference Point';
    } else {
      this._name =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.charAt(
          Math.abs(id) % 52
        );
    }
    this._type = JointType.Revolute;
    this._angle = 0;
    // this._isInput = false;
    // this._isWelded = false;
    // this._isGrounded = false;
    this._inputSpeed = 0;
    this._parentLocked = false;
    this._inputSpeed = 10;
    this._isHidden = false;
    this._isReference = false;
    this._isGenerated = false;
    this._rpmSpeed = 10;

    if (typeof xORCoord === 'number' && y !== undefined) {
      this._coords = new Coord(xORCoord, y);
    } else if (typeof xORCoord === 'object') {
      this._coords = new Coord(xORCoord.x, xORCoord.y);
    } else {
      throw new Error('Invalid Constructor Parameters');
    }
  }

  //----------------------------getters----------------------------
  get id(): number {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get coords(): Coord {
    return this._coords;
  }

  get type(): JointType {
    return this._type;
  }

  get angle(): number {
    return this._angle;
  }

  get isGrounded(): boolean {
    return this._isGrounded.value;
  }

  get isInput(): boolean {
    return this._isInput.value;
  }

  get inputSpeed(): number {
    return this._inputSpeed;
  }

  get rpmSpeed(): number {
    return this._rpmSpeed;
  }

  get isWelded(): boolean {
    return this._isWelded.value;
  }

  get locked(): boolean {
    return this._parentLocked;
  }

  get isHidden(): boolean {
    return this._isHidden;
  }

  get isReference(): boolean {
    return this._isReference;
  }

  get isGenerated(): boolean {
    return this._isGenerated;
  }

  getInputObservable() {
    return this.isInput$;
  }

  getGroundedObservable() {
    return this.isGrounded$;
  }

  getWeldedObservable() {
    return this.isWelded$;
  }

  //----------------------------setters----------------------------
  set name(newName: string) {
    this._name = newName;
  }

  set type(newType: number) {
    this._type = newType;
  }

  set angle(newAngle: number) {
    this._angle = newAngle % 360;
  }

  set speed(newSpeed: number) {
    this._inputSpeed = newSpeed;
  }

  set locked(value: boolean) {
    this._parentLocked = value;
  }

  set rpmSpeed(newSpeed: number) {
    this._rpmSpeed = newSpeed;
  }

  set hidden(val: boolean) {
    this._isHidden = val;
  }

  set reference(val: boolean) {
    this._isReference = val;
  }

  set generated(val: boolean) {
    this._isGenerated = val;
  }

  //----------------------------Joint Modification with modifying other variables----------------------------
  addGround() {
    this._type = JointType.Revolute;
    this._isGrounded.next(true);
  }

  removeGround() {
    this._isInput.next(false);
    this._isGrounded.next(false);
  }

  addInput() {
    //console.log("input being called");
    if (!this._isGrounded.value && this._type == JointType.Revolute) {
      throw new Error('Input Joints must be Grounded or Prismatic');
    } else {
      //console.log(`adding input to joint ${this.id}`);
      this._isInput.next(true);
    }
  }

  removeInput() {
    this._isInput.next(false);
  }

  addWeld() {
    this._isWelded.next(true);
  }

  removeWeld() {
    this._isWelded.next(false);
  }

  addSlider() {
    this._type = JointType.Prismatic;
    this.removeGround();
  }

  removeSlider() {
    this._type = JointType.Revolute;
    this.removeGround();
  }

  addLock() {
    console.log('setting lock in child');
    this._parentLocked = true;
  }

  breakLock() {
    this._parentLocked = false;
  }

  //----------------------------Joint Modification Querying----------------------------
  canAddGround(): boolean {
    return true;
  }

  canRemoveGround(): boolean {
    return true;
  }

  canAddInput(): boolean {
    //return !(!this._isGrounded.value && this._type == JointType.Revolute);
    return this._isGrounded.value;
  }

  canRemoveInput(): boolean {
    return true;
  }

  /* canAddWeld(): boolean {
        return true;
    } */

  canRemoveWeld(): boolean {
    return true;
  }

  canAddSlider(): boolean {
    return true;
  }

  canRemoveSlider(): boolean {
    return true;
  }

  canLock(): boolean {
    return true;
  }

  canUnlock(): boolean {
    return true;
  }

  //----------------------------Joint Alteration Relative to other Joints----------------------------
  setDistancetoJoint() {
  }

  setAngletoJoint(newAngle: number) {
    this.angle = newAngle;
  }

  setCoordinates(coord: Coord) {
    this._coords = coord;
    this.notifyObservers();
  }

  addCoordinates(coord: Coord) {
    this._coords.add(coord);
  }

  clone(): Joint {
    const newJoint = new Joint(this._id, this._coords.clone());
    newJoint.name = this._name;
    newJoint.type = this._type;
    newJoint.angle = this._angle;
    if (this._isGrounded.value) newJoint.addGround();
    if (this._isInput.value) newJoint.addInput();
    if (this._isWelded.value) newJoint.addWeld();
    newJoint.speed = this._inputSpeed;
    newJoint.locked = this._parentLocked;
    newJoint.hidden = this._isHidden;
    newJoint.reference = this._isReference;
    return newJoint;
  }

  private _observers: ((joint: Joint) => void)[] = [];

  addObserver(callback: (joint: Joint) => void) {
    this._observers.push(callback);
  }

  removeObserver(callback: (joint: Joint) => void) {
    const index = this._observers.indexOf(callback);
    if (index > -1) {
      this._observers.splice(index, 1);
    }
  }

  private notifyObservers() {
    this._observers.forEach((observer) => observer(this));
  }
}

export class RealJoint {
}
