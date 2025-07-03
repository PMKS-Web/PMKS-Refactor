import { Coord } from './coord';
import { Joint } from './joint';
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
    this._start = this.calculatePositionInLink(start);
    this._end = new Coord(end.x, end.y);
    this._frameOfReference = ForceFrame.Global;
    this._angle = this.calculateAngle();
    this._color = this.linkColorOptions[1];
    this._magnitude = start.getDistanceTo(end);
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
    this._start = this.calculatePositionInLink(value);
  }

  set end(value: Coord) {
    this._end = value;
  }

  set magnitude(value: number) {
    this._magnitude = value;
  }

  set angle(value: number) {
    this._angle = value;
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
  setPosAlongLink() {
    this._start = this.calculatePositionInLink(this._start);
  }

  switchForceDirection() {}
  setForceAngle() {}
  setXComp(newXComp: number) {}
  setYComp(newYComp: number) {}
  addCoordinates(coord: Coord) {
    this._start = this._start.clone().add(coord);
    this._end = this._end.clone().add(coord);
  }
  setStartCoordinate(coord: Coord) {
    this._start = coord.clone();
  }
  setEndCoordinate(coord: Coord) {
    this._end = coord.clone();
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
  calculatePositionInLink(value: Coord): Coord {
    const joints: Joint[] = this._parentLink.getJoints();
    const polygonPoints: Coord[] = joints.map((joint) => joint._coords);
    const convexHull = this.computeConvexHull(polygonPoints);
    if (
      polygonPoints.length > 2 &&
      this.isPointInsideConvexPolygon(value, convexHull)
    ) {
      return value;
    }

    return this.findClosestPointOnPolygonBoundary(value, convexHull);
  }
  // Graham Scan Algorithm (Stolen from svg-path.service.ts)
  computeConvexHull(coords: Coord[]): Coord[] {
    // Find the point with the lowest y-coordinate, break ties by lowest x-coordinate
    let startPoint = coords[0];
    for (const point of coords) {
      if (
        point.y < startPoint.y ||
        (point.y === startPoint.y && point.x < startPoint.x)
      ) {
        startPoint = point;
      }
    }

    // Sort the coords by polar angle with the startPoint
    coords.sort((a, b) => {
      const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
      const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
      return angleA - angleB;
    });

    // Initialize the convex hull with the start point
    const hull = [startPoint];
    // Process the sorted coords
    for (const point of coords) {
      while (
        hull.length >= 2 &&
        this.crossProduct(
          hull[hull.length - 2],
          hull[hull.length - 1],
          point
        ) <= 0
      ) {
        // Pop the last point from the hull if we're not making a counter-clockwise turn
        hull.pop();
      }
      hull.push(point);
    }
    return hull;
  }
  isPointInsideConvexPolygon(point: Coord, polygon: Coord[]): boolean {
    const n = polygon.length;
    if (n < 3) return false;
    let sign = 0;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cross = this.crossProduct(polygon[i], polygon[j], point);

      if (cross !== 0) {
        if (sign === 0) {
          sign = cross > 0 ? 1 : -1;
        } else if ((cross > 0 ? 1 : -1) !== sign) {
          return false; // Point is on different sides of edges
        }
      }
    }

    return true;
  }
  crossProduct(p1: Coord, p2: Coord, p3: Coord): number {
    return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  }

  private findClosestPointOnPolygonBoundary(
    point: Coord,
    polygonPoints: Coord[]
  ): Coord {
    let closestPoint = polygonPoints[0].clone();
    let minDistance = point.getDistanceTo(closestPoint);

    const n = polygonPoints.length;

    // Check each edge of the polygon
    for (let i = 0; i < n; i++) {
      const edgeStart = polygonPoints[i];
      const edgeEnd = polygonPoints[(i + 1) % n];

      const closestOnEdge = this.findClosestPointOnLineSegment(
        point,
        edgeStart,
        edgeEnd
      );
      const distance = point.getDistanceTo(closestOnEdge);

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = closestOnEdge;
      }
    }

    return closestPoint;
  }

  private findClosestPointOnLineSegment(
    point: Coord,
    lineStart: Coord,
    lineEnd: Coord
  ): Coord {
    const lineVector = lineEnd.subtract(lineStart);
    const pointVector = point.subtract(lineStart);

    const lineLengthSquared =
      lineVector.x * lineVector.x + lineVector.y * lineVector.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        (pointVector.x * lineVector.x + pointVector.y * lineVector.y) /
          lineLengthSquared
      )
    );
    return lineStart.add(lineVector.scale(t));
  }
}
