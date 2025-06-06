import { Coord } from './coord'

export enum JointType{
    Prismatic,
    Revolute
}

export class Joint {
    private readonly _id: number;
    private _name: string;
    public _coords: Coord;
    private _type: JointType;
    private _angle: number;
    private _isGrounded: boolean;
    private _isInput: boolean;
    private _inputSpeed: number;
    private _isWelded: boolean;
    private _parentLocked: boolean;
    private _isHidden: boolean;
    private _isReference: boolean;

    constructor(id: number, x: number, y: number);
    constructor(id: number, coord: Coord);
    constructor(id: number, xORCoord: number | Coord, y?: number){
        this._id = id;
        // changed name to be the same as ID instead of blank
        if (this.id <= -1){
            this._name = "Reference Point";
            this.locked = true;
        }
        else {
            this._name = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".charAt(Math.abs(id) % 52);
        }
        this._type = JointType.Revolute;
        this._angle = 0;        
        this._isInput = false;
        this._isWelded = false;
        this._isGrounded = false;
        this._inputSpeed = 0;
        this._parentLocked = false;
        this._inputSpeed = 10;
        this._isHidden = false;
        this._isReference = false;

        if(typeof xORCoord === 'number' && y !== undefined)
        {
            this._coords = new Coord(xORCoord,y);

        } else if(typeof xORCoord === 'object'){
            this._coords = new Coord(xORCoord.x,xORCoord.y);
        } else {
            throw new Error("Invalid Constructor Parameters");
        }
    }
    //----------------------------getters----------------------------
    get id(): number{
        return this._id;
    }

    get name(): string{
        return this._name;
    }

    get coords(): Coord{
        return this._coords;
    }

    get type(): JointType{
        return this._type;
    }
    get angle(): number{
        return this._angle;
    }

    get isGrounded(): boolean{
        return this._isGrounded;
    }
    get isInput(): boolean{
        return this._isInput;
    }

    get inputSpeed(): number{
        return this._inputSpeed;
    }

    get isWelded(): boolean{
        return this._isWelded;
    }
    get locked(): boolean{
        return this._parentLocked;
    }
    get isHidden(): boolean{
      return this._isHidden;
    }
    get isReference(): boolean{
      return this._isReference
    }
    //----------------------------setters----------------------------
    set name(newName: string){
        this._name = newName;
    }

    set type(newType: number){
      this._type = newType;
    }

    set angle(newAngle: number){
        this._angle = newAngle % 360;
    }

    set speed(newSpeed: number){
        this._inputSpeed = newSpeed;
    }
    set locked(value: boolean){
        this._parentLocked = value;
    }

    set hidden(val: boolean){
      this._isHidden = val;
    }

    set reference(val: boolean){
      this._isReference = val;
    }

    //----------------------------Joint Modification with modifying other variables----------------------------
    addGround(){
        this._type = JointType.Revolute;
        this._isGrounded = true;
    }

    removeGround(){
        this._isInput = false;
        this._isGrounded = false;
    }
    addInput(){
      //console.log("input being called");
        if(!this._isGrounded && this._type == JointType.Revolute){
            throw new Error("Input Joints must be Grounded or Prismatic");

        } else{
            //console.log(`adding input to joint ${this.id}`);
            this._isInput = true;
        }
    }

    removeInput(){
        this._isInput = false;
    }

    addWeld(){
            this._isWelded = true;
    }

    removeWeld(){
        this._isWelded = false;
    }

    addSlider(){
        this._isGrounded = true;
        this._type = JointType.Prismatic;

    }

    removeSlider(){
        this._isInput = false;
        this._type = JointType.Revolute;
    }

    addLock() {
        console.log('setting lock in child')
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
        return !(!this._isGrounded && this._type == JointType.Revolute);
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
    canLock(): boolean{
        return true;
    }
    canUnlock(): boolean{
        return true;
    }

    //----------------------------Joint Alteration Relative to other Joints----------------------------
    setDistancetoJoint(){

    }

    setAngletoJoint(newAngle: number){
        this.angle = newAngle;
    }

    setCoordinates(coord: Coord){
        this._coords = coord;

    }
    addCoordinates(coord: Coord){
        this._coords.add(coord);
    }

    clone(): Joint {
      const newJoint = new Joint(this._id, this._coords.clone());
      newJoint.name = this._name;
      newJoint.type = this._type;
      newJoint.angle = this._angle;
      if (this._isGrounded) newJoint.addGround();
      if (this._isInput) newJoint.addInput();
      if (this._isWelded) newJoint.addWeld();
      newJoint.speed = this._inputSpeed;
      newJoint.locked = this._parentLocked;
      newJoint.hidden = this._isHidden;
      newJoint.reference = this._isReference;
      return newJoint;
    }

}

export class RealJoint {
}
