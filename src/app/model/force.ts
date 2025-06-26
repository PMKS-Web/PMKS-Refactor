import { Coord } from './coord';
import { Link } from './link';

export enum ForceFrame {
  Local,
  Global,
}

export class Force {
  private readonly _id: number;
  private _name: string;
  private _start: Coord;
  private _end: Coord;
  private _magnitude: number;
  private _angle: number;
  private _frameOfReference: ForceFrame;
  private _parentLink: Link;
  private _color: string;
  private _positionAlongLink: number;
  private linkColorOptions = [
    '#727FD5',
    '#2F3E9F',
    '#0D125A',
    '#207297',
    '#00695D',
    '#0D453E',
  ];

  constructor(id: number, start: Coord, end: Coord, parent: Link) {
    this._id = id;
    this._parentLink = parent;
    this._name = '';
    this._magnitude = 1;
    this._start = this.setStart(start);
    this._end = new Coord(end.x, end.y);
    this._frameOfReference = ForceFrame.Global;
    this._angle = this.calculateAngle();
    this._color = this.linkColorOptions[1];
    this._positionAlongLink = this.calculatePositionAlongLink();
  }
  calculatePositionAlongLink(): number {
    const linkStart: Coord = this._parentLink.getJoints()[0]._coords;
    const linkEnd: Coord = this._parentLink.getJoints()[1]._coords;
    const forceStart = this._start;

    // Calculate the total link length
    const linkLength = Math.sqrt(
      Math.pow(linkEnd.x - linkStart.x, 2) +
        Math.pow(linkEnd.y - linkStart.y, 2)
    );

    // Calculate distance from link start to force start
    const forceDistance = Math.sqrt(
      Math.pow(forceStart.x - linkStart.x, 2) +
        Math.pow(forceStart.y - linkStart.y, 2)
    );

    // Return ratio (0 = at start joint, 1 = at end joint)
    return linkLength === 0 ? 0 : forceDistance / linkLength;
  }

  setStart(forceStart: Coord): Coord {
    const linkStart: Coord = this._parentLink.getJoints()[0]._coords;
    const linkEnd: Coord = this._parentLink.getJoints()[1]._coords; // Fixed: should be [1] for end

    const linkVector = {
      x: linkEnd.x - linkStart.x,
      y: linkEnd.y - linkStart.y,
    };
    const toForceVector = {
      x: forceStart.x - linkStart.x,
      y: forceStart.y - linkStart.y,
    };
    const linkLengthSquared =
      linkVector.x * linkVector.x + linkVector.y * linkVector.y;

    if (linkLengthSquared === 0) return { ...linkStart } as Coord;

    const t = Math.max(
      0,
      Math.min(
        1,
        (toForceVector.x * linkVector.x + toForceVector.y * linkVector.y) /
          linkLengthSquared
      )
    );
    return new Coord(
      linkStart.x + t * linkVector.x,
      linkStart.y + t * linkVector.y
    );
  }

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
  get color(): string {
    return this._color;
  }

  get frameOfReference(): ForceFrame {
    return this._frameOfReference;
  }
  get parentLink(): Link {
    return this._parentLink;
  }
  //setters
  set name(value: string) {
    this._name = value;
  }

  set start(value: Coord) {
    this._start = this.setStart(value);
  }

  set end(value: Coord) {
    this._end = value;
  }

  set magnitude(value: number) {
    this._magnitude = value;
  }

  set angle(value: number) {
    this._angle = value; //calculateAngle()
  }

  set frameOfReference(frame: ForceFrame) {
    this._frameOfReference = frame;
  }
  set parentLink(link: Link) {
    this._parentLink = link;
  }

  changeFrameOfReference() {
    if (this._frameOfReference === ForceFrame.Global) {
      this._frameOfReference = ForceFrame.Local;
    } else {
      this._frameOfReference = ForceFrame.Global;
    }
  }

  calculateAngle(): number {
    const deltaX = this._end.x - this._start.x;
    const deltaY = this._end.y - this._start.y;
    const rad: number = Math.atan2(deltaY, deltaX);
    return rad * (180 / Math.PI);
  }

  calculateXComp(): number {
    return Math.cos((Math.PI * this.angle) / 180) * this.magnitude;
  }

  calculateYComp(): number {
    return Math.sin((Math.PI * this.angle) / 180) * this.magnitude;
  }

  switchForceDirection() {}
  setForceAngle() {}
  setXComp(newXComp: number) {}
  setYComp(newYComp: number) {}
  addCoordinates(coord: Coord) {
    this.start = this._start.add(coord);
    // this.end = this._end.add(coord);
  }

  clone(): Force {
    const newForce = new Force(
      this._id,
      this._start.clone(),
      this._end.clone(),
      this.parentLink
    );
    newForce.name = this._name;
    newForce.magnitude = this._magnitude;
    newForce.angle = this._angle;
    newForce.frameOfReference = this._frameOfReference;
    return newForce;
  }

  setColor(index: number) {
    this._color = this.linkColorOptions[index];
  }
  getColorIndex(): number {
    return this.linkColorOptions.indexOf(this._color);
  }
  public updateFromEndpoints(): void {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    this.magnitude = Math.sqrt(dx * dx + dy * dy);
    this.angle = Math.atan2(dy, dx) * (180 / Math.PI);
  }
}
