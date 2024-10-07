import { Coord } from '../model/coord'

export enum JointType{
    Prismatic,
    Revolute
}

export class Joint {
    private _id: number;
    private _name: string;
    public _coords: Coord;
    private _type: JointType;
    private _angle: number;
    private _isGrounded: boolean;
    private _isInput: boolean;
    private _inputSpeed: number;
    private _isWelded: boolean;
    private _parentLocked: boolean;



    constructor(id: number, x: number, y: number);
    constructor(id: number, coord: Coord);
    constructor(id: number, xORCoord: number | Coord, y?: number){
        this._id = id;
        // changed name to be the same as ID instead of blank
        if (this.id === -1){
          this._name = "-1";
        }
        else {
          this._name = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".charAt(Math.abs(id) % 52);
        }
        this._type = JointType.Revolute;
        this._angle = 0;
        this._isGrounded = false;
        this._isInput = false;
        this._isWelded = false;
        this._inputSpeed = 0;
        this._parentLocked = false;
        this._inputSpeed = 10;

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
    //----------------------------setters----------------------------
    set name(newName: string){
        this._name = newName;
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
        if(this._isGrounded == false && this._type == JointType.Revolute){
            throw new Error("Input Joints must be Grounded or Prismatic");

        } else{
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
        if(this._isGrounded == false && this._type == JointType.Revolute){
            return false;
        } else{
            return true;
        }
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
    setDistancetoJoint(newDistance: number, jointRef: Joint){

    }

    setAngletoJoint(newAngle: number, jointRef: Joint){
        this.angle = newAngle;
    }

    setCoordinates(coord: Coord){
        this._coords = coord;

    }
    addCoordinates(coord: Coord){
        this._coords.add(coord);
    }

}

