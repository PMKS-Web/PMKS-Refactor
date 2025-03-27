import { Coord } from '../model/coord'

export enum ForceFrame{
    Local,
    Global
}

export class Force {
    private _id: number;
    private _name: string;
    private _start: Coord;
    private _end: Coord;
    private _magnitude: number;
    private _angle: number;
    private _frameOfReference: ForceFrame;


    constructor(id: number, start: Coord, end: Coord){
        this._id = id;
        this._name = '';
        this._magnitude = 1;
        this._start = new Coord(start.x,start.y);
        this._end = new Coord(end.x,end.y);
        this._frameOfReference = ForceFrame.Global;
        this._angle = this.calculateAngle();
    }
    //getters
    get id(): number {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    get start(): Coord {
        return this._start;
    }

    get end(): Coord {
        return this._end;
    }

    get magnitude(): number {
        return this._magnitude;
    }

    get angle(): number {
        return this._angle;
    }

    get frameOfReference(): ForceFrame{
        return this._frameOfReference;
    }
    //setters
    set name(value: string) {
        this._name = value;
    }

    set start(value: Coord) {
        this._start = value;
    }

    set end(value: Coord) {
        this._end = value;
    }

    set magnitude(value: number) {
        this._magnitude = value;
    }

    set angle(value: number) {
      this._angle = value;//calculateAngle()
    }

    set frameOfReference(frame: ForceFrame){
        this._frameOfReference = frame;
    }

    changeFrameOfReference(){
        if(this._frameOfReference === ForceFrame.Global){
            this._frameOfReference = ForceFrame.Local;
        } else{
            this._frameOfReference = ForceFrame.Global;
        }
    }

    //TODO implement secondary information calculations and modifications
    calculateAngle(): number{
        return 0;
    }

    calculateXComp(): number{
        return 0;
    }

    calculateYComp(): number{
        return 0;
    }

    switchForceDirection(){

    }
    setForceAngle(newAngle: number){

    }
    setXComp(newXComp: number){

    }
    setYComp(newYComp: number){

    }
    addCoordinates(coord: Coord){
        this._start.add(coord);
        this._end.add(coord);
    }
    setCoordinates(newStartCoord: Coord, newEndCoord: Coord){
        this._start = newStartCoord;
        this._end = newEndCoord;
    }

    clone(): Force {
      const newForce = new Force(this._id, this._start.clone(), this._end.clone());
      newForce.name = this._name;
      newForce.magnitude = this._magnitude;
      newForce.angle = this._angle;
      newForce.frameOfReference = this._frameOfReference;
      return newForce;
    }

}
