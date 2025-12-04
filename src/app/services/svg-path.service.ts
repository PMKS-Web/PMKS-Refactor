import {Injectable} from '@angular/core';
import {Coord} from 'src/app/model/coord'
import {Link} from "../model/link";
import {UnitConversionService} from "./unit-conversion.service";
import {arc} from "d3-shape";
import {intersection} from "d3";

@Injectable({
  providedIn: 'root',
})
export class SVGPathService {

  private scale = 1;

  constructor(private unitConversionService: UnitConversionService) {};

  // Generates an SVG path string representing a single connection based on provided coordinates and radius.
  getSingleLinkDrawnPath(allCoords: Coord[], radius: number): string{

    //check if coordinates are collinear. If they are, use the two returned coords(the end points) to draw a line
    let collinearCoords: Coord[] | undefined = this.findCollinearCoords(allCoords);
    if(collinearCoords !== undefined){
      //build path string between two coords
      return this.calculateTwoPointPath(collinearCoords[0],collinearCoords[1],radius);
    }
    //If not collinear, use grahamScan to determine hull Points
    //(The points which make up a convex polygon containing the least number of "joints" in drawing order)
    let hullCoords: Coord[] = this.grahamScan(allCoords);
    return this.calculateConvexPath(hullCoords,radius);
  }

  // Creates an SVG path string tracing the trajectory through all provided coordinates with the given radius.
  getTrajectoryDrawnPath(allCoords: Coord[], radius: number): string {
    if (allCoords.length === 0) {
      return '';
    }

    //check if coordinates are collinear. If they are, use the two returned coords(the end points) to draw a line
    const collinearCoords: Coord[] | undefined = this.findCollinearCoords(allCoords);
    if (collinearCoords !== undefined) {

      return this.calculateTwoPointPath(collinearCoords[0], collinearCoords[1], radius);
    }

    let pathData = `M ${allCoords[0].x},${allCoords[0].y} `;
    for (let i = 1; i < allCoords.length; i++) {
      const currentCoord = allCoords[i];
      pathData += `L ${currentCoord.x},${currentCoord.y} `;
    }

    return pathData.trim();
  }

  // Generates an SVG path string for a single position or connection, using convex hull or collinear logic and the given radius.
  getSinglePosDrawnPath(allCoords: Coord[], radius: number): string {

    //check if coordinates are collinear. If they are, use the two returned coords(the end points) to draw a line
    let collinearCoords: Coord[] | undefined = this.findCollinearCoords(allCoords);
    if(collinearCoords !== undefined){
      //build path string between two coords
      return this.calculateTwoPointPath(collinearCoords[0],collinearCoords[1],radius);
    }
    //If not collinear, use grahamScan to determine hull Points
    //(The points which make up a convex polygon containing the least number of "joints" in drawing order)
    let hullCoords: Coord[] = this.grahamScan(allCoords);
    return this.calculateConvexPath(hullCoords,radius);
  }

  // Identifies if all coordinates lie on a straight line and returns the endpoints if they are collinear.
  private findCollinearCoords(coords: Coord[]): Coord[] | undefined {

    if (coords.length < 2) {
      return undefined;
    }
    // Sort coords by x, then by y to find the "end coords"
    const sortedcoords = coords.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const start = sortedcoords[0];
    const end = sortedcoords[sortedcoords.length - 1];

    // Calculate the slope of the line formed by the start and end coords
    const slope = (end.y - start.y) / (end.x - start.x);

    // Check if all other coords are on the same line
    for (let i = 1; i < sortedcoords.length - 1; i++) {
      const point = sortedcoords[i];
      const tempSlope = (point.y - start.y) / (point.x - start.x);

      // If the slope is not equal, the coords are not collinear
      if (tempSlope !== slope) {
        return undefined;
      }
    }

    // If all coords have the same slope with the 'start' point, they are collinear
    return [start, end];
  }

  // Computes the convex hull of a set of points using Graham's scan algorithm.
  grahamScan(coords: Coord[]): Coord[] {
    // Find the point with the lowest y-coordinate, break ties by lowest x-coordinate
    let startPoint = coords[0];
    for (const point of coords) {
      if (point.y < startPoint.y || (point.y === startPoint.y && point.x < startPoint.x)) {
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
      while (hull.length >= 2 && !this.isCounterClockwise(hull[hull.length - 2], hull[hull.length - 1], point)) {
        // Pop the last point from the hull if we're not making a counter-clockwise turn
        hull.pop();
      }
      hull.push(point);
    }
    return hull;
  }

  // Helper function to determine if three coords make a counter-clockwise turn
  isCounterClockwise(c1: Coord, c2: Coord, c3: Coord): boolean {
    const crossProduct = (c2.x - c1.x) * (c3.y - c1.y) - (c2.y - c1.y) * (c3.x - c1.x);
    return crossProduct > 0; // if cross product is positive, the coords are counter-clockwise
  }

  // Calculates the SVG path for a straight or rounded connection between two points using the specified radius.
  calculateTwoPointPath(coord1: Coord, coord2: Coord, r: number): string {
    // Calculate perpendicular direction vectors for the line
    const dirFirstToSecond = this.perpendicularDirection(coord1, coord2);
    const dirSecondToFirst = this.perpendicularDirection(coord2, coord1);
    // Create the rounded line path
    let pathData = `M ${coord1.x + dirFirstToSecond.x * r},${coord1.y + dirFirstToSecond.y * r} `; // Move to the first point
    pathData += `L ${coord2.x + dirFirstToSecond.x * r},${coord2.y + dirFirstToSecond.y * r} `; // Line from first to second Point
    pathData += `A ${r},${r} 0 0 1 ${coord2.x + dirSecondToFirst.x * r},${coord2.y + dirSecondToFirst.y * r} `; // Arc from Second to Third Point
    pathData += `L ${coord1.x + dirSecondToFirst.x * r},${coord1.y + dirSecondToFirst.y * r} `; // Line From Third to Fourth Point
    pathData += `A ${r},${r} 0 0 1 ${coord1.x + dirFirstToSecond.x * r},${coord1.y + dirFirstToSecond.y * r} `; // Arc from Fourth to First Point
    pathData += 'Z'; // Close the path
    return pathData;
  }

  // Function to calculate the correct perpendicular direction vector between two points
  perpendicularDirection(c1: Coord, c2: Coord): Coord {
    const dir: Coord = this.direction(c1,c2);
    return new Coord(dir.y, -dir.x);
  }

  // Constructs an SVG path string for a convex polygon defined by hull points with rounded corners based on radius.
  calculateConvexPath(hullPoints: Coord[], r: number): string {
    if (hullPoints.length < 3) {
      throw new Error('At least three points are required to create a path with rounded corners.');
    }
    // Start the path, moving the pointer to the first correct point
    let pathData = 'M';
    const dirFirstToSecondInit = this.perpendicularDirection(hullPoints[0], hullPoints[1]);
     pathData += `${hullPoints[0].x + dirFirstToSecondInit.x * r}, ${hullPoints[0].y + dirFirstToSecondInit.y * r}`
    //iterate over all of the points, drawing one line and one arc at a time
    for (let i = 0; i < hullPoints.length; i++) {
    //get current points to look at.
    const c0 = hullPoints[i];
    const c1 = hullPoints[(i + 1) % hullPoints.length]
    const c2 = hullPoints[(i + 2) % hullPoints.length]
    //get the correct Perpendicular Direction for the Path
    const dirFirstToSecond = this.perpendicularDirection(c0, c1);
    const dirSecondToThird = this.perpendicularDirection(c1, c2);
    pathData += `L ${c1.x + dirFirstToSecond.x * r},${c1.y + dirFirstToSecond.y * r} `; // Line from first joint to second joint
    pathData += `A ${r},${r} 0 0 1 ${c1.x+ dirSecondToThird.x * r},${c1.y + dirSecondToThird.y * r}`; // Arc around second joint
    }
    // Close the path
    pathData += ' Z';
    return pathData;
  }

  // Function to calculate the direction vector between two points
  direction(from: Coord, to: Coord) {
    const len = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
    return new Coord((to.x - from.x) / len,  (to.y - from.y) / len);
  }

  // Builds an SVG path string representing length markings between two points at a specific angle.
  calculateLengthSVGPath(coord1: Coord, coord2: Coord, angle: number): string {
    let pathData = "";
    if (angle === 90){
      pathData += `M ${coord1.x - 100}, ${coord1.y} `;
      pathData += `L ${coord1.x - 30}, ${coord1.y} `;
      pathData += `M ${coord1.x - 65}, ${coord1.y} `;
      pathData += `L ${coord2.x - 65}, ${coord2.y} `;
      pathData += `M ${coord2.x - 100}, ${coord2.y} `
      pathData += `L ${coord2.x - 30}, ${coord2.y} `;
    }
    else if (angle < 90 && angle >= 0){
      pathData += `M ${coord1.x-angle},${coord1.y + angle - 100} `; // Move to the first point
      pathData += `L ${coord1.x},${coord1.y} `;
      pathData += `M ${(coord1.x + coord1.x-angle)/2},${(coord1.y + angle - 100 + coord1.y)/2} `;
      pathData += `L ${(coord2.x + coord2.x-angle)/2},${(coord2.y + angle - 100 + coord2.y)/2} `;
      pathData += `M ${coord2.x - angle},${coord2.y + angle - 100} `;
      pathData += `L ${coord2.x},${coord2.y} `;
    }
    else if (angle > 90 && angle <= 180){
      pathData += `M ${coord2.x - 180%angle},${coord2.y - 180%angle + 100} `; // Move to the first point
      pathData += `L ${coord2.x},${coord2.y} `;
      pathData += `M ${(coord2.x + coord2.x-180%angle)/2},${(coord2.y + coord2.y - 180%angle + 100)/2} `;
      pathData += `L ${(coord1.x + coord1.x-180%angle)/2},${(coord1.y + coord1.y - 180%angle + 100)/2} `;
      pathData += `M ${coord1.x - 180%angle},${coord1.y - 180%angle + 100} `;
      pathData += `L ${coord1.x},${coord1.y} `;
    }
    else if (angle > 180 && angle < 270){
      pathData += `M ${coord2.x + angle%180},${coord2.y - angle%180 + 100} `; // Move to the first point
      pathData += `L ${coord2.x},${coord2.y} `;
      pathData += `M ${(coord2.x + coord2.x+angle%180)/2},${(coord2.y - angle%180 + 100 + coord2.y)/2} `;
      pathData += `L ${(coord1.x + coord1.x+angle%180)/2},${(coord1.y - angle%180 + 100 + coord1.y)/2} `;
      pathData += `M ${coord1.x + angle%180},${coord1.y - angle%180 + 100} `;
      pathData += `L ${coord1.x},${coord1.y} `;
    }
    else if (angle === 270){
      pathData += `M ${coord1.x + 100}, ${coord1.y} `;
      pathData += `L ${coord1.x + 30}, ${coord1.y} `;
      pathData += `M ${coord1.x + 65}, ${coord1.y} `;
      pathData += `L ${coord2.x + 65}, ${coord2.y} `;
      pathData += `M ${coord2.x + 100}, ${coord2.y} `
      pathData += `L ${coord2.x + 30}, ${coord2.y} `;
    }
    else if (angle > 270){
      let diff = angle - 270;
      let newangle = 90 + diff;
      pathData += `M ${coord1.x+180%(newangle)},${coord1.y + 180%(newangle) - 100} `; // Move to the first point
      pathData += `L ${coord1.x},${coord1.y} `;
      pathData += `M ${(coord1.x + coord1.x+180%newangle)/2},${(coord1.y + (180%newangle) + coord1.y - 100)/2} `;
      pathData += `L ${(coord2.x + coord2.x+180%newangle)/2},${(coord2.y + (180%newangle) + coord2.y - 100)/2} `;
      pathData += `M ${coord2.x + 180%newangle},${coord2.y + (180%newangle) - 100} `;
      pathData += `L ${coord2.x},${coord2.y} `;
    }

    //Issues: perpendicular lines at the ends of the length grow in size as angle decreases
    return pathData;
  }

  // Builds an SVG path string representing an angled arc between two points based on the given angle.
  calculateAngleSVGPath(coord1: Coord, coord2: Coord, angle: number): string {
    let pathData = "";
    let d = Math.sqrt((coord2.x - coord1.x) * (coord2.x - coord1.x) + (coord2.y-coord1.y) * (coord2.y-coord1.y));
    let r = 150 / d;
    if (angle < 180) {
      pathData += `M ${coord1.x}, ${coord1.y} `; //Move to first coord
      pathData += `H ${coord1.x + 150} `; //Draw horizontal 25 units right
      //pathData += `M ${coord1.x}, ${coord1.y} `; //Move to first coord
      pathData += `A ${150} ${150} 0 0 0 ${(1-r)*coord1.x + r * coord2.x} ${(1-r)*coord1.y + r * coord2.y}`;
      pathData += `L ${coord1.x}, ${coord1.y} `;
    }
    else if (angle >= 180){
      pathData += `M ${coord1.x}, ${coord1.y} `; //Move to first coord
      pathData += `H ${coord1.x + 150} `; //Draw horizontal 25 units right
      //pathData += `M ${coord1.x}, ${coord1.y} `; //Move to first coord
      pathData += `A ${150} ${150} 0 1 0 ${(1-r)*coord1.x + r * coord2.x} ${(1-r)*coord1.y + r * coord2.y}`;
      pathData += `L ${coord1.x}, ${coord1.y} `;
    }

   return pathData;
  }

  // checks if the path string is starting or ending a path; returns true if it is
  isNewShape(pathString: string): boolean {
    return pathString === '' || pathString.substring(pathString.length - 2) === 'Z ';
  }

  // used for creating a concave fillet between two lines
  computeArcPointsAndRadius(line1: [Coord, Coord, Coord | null, Link], line2:[Coord, Coord, Coord | null, Link], arcRadius: number):[Coord, Coord, number] {
    // modify line1 end point and line2 start point to create an arc between them
    const arcOffset = Math.min(arcRadius, line1[0].getDistanceTo(line1[1]) / 2, line2[0].getDistanceTo(line2[1]) / 2);
    const line1OffsetPoint:Coord = line1[0].clone()
      .subtract(line1[1])
      .normalize()
      .multiply(arcOffset)
      .add(line1[1]);

    const line2OffsetPoint:Coord = line2[1].clone()
      .subtract(line2[0])
      .normalize()
      .multiply(arcOffset)
      .add(line2[0]);

    // find angle between two lines
    const line2Angle = Math.atan2(line2[1].y - line2[0].y, line2[1].x - line2[0].x);
    const line1Angle = Math.atan2(line1[1].y - line1[0].y, line1[1].x - line1[0].x);
    const angleBetweenLines = line2Angle - line1Angle;
    const radius = arcOffset * Math.tan((Math.PI - angleBetweenLines) / 2);

    return [line1OffsetPoint, line2OffsetPoint, radius];
  }

  // recalculates angle to be in between -pi and pi.
  angleToPI(line1: [Coord, Coord, Coord | null, Link], line2:[Coord, Coord, Coord | null, Link]) {
    // calculate angle of each individual line, given in radians
    let line1Angle = Math.atan2(line1[1].y - line1[0].y, line1[1].x - line1[0].x);
    let line2Angle = Math.atan2(line2[1].y - line2[0].y, line2[1].x - line2[0].x);

    // angle in between the lines
    let angle = line1Angle - line2Angle;

    // recalculate the angle to be between -pi and pi
    angle = angle % (2 * Math.PI);
    if (angle > Math.PI) {
      angle -= 2 * Math.PI;
    }
    if (angle < -Math.PI) {
      angle += 2 * Math.PI;
    }
    return angle;
  }

  // checks if two numbers are loosely equal, bounded by a delta
  twoNumsLooselyEquals(a: number, b: number, delta: number = 0.00001): boolean {
    return Math.abs(a - b) <= delta;
  }

  // checks if a point is on a line
  // return true if the point is on the line segment defined by lineStart and lineEnd
  // return false otherwise
  isPointOnLine(point: Coord, lineStart: Coord, lineEnd: Coord): boolean {
    // check if the point is within a small range of the line segment.
    let range = 0.00001;
    if (
      point.x < Math.min(lineStart.x, lineEnd.x) - range ||
      point.x > Math.max(lineStart.x, lineEnd.x) + range ||
      point.y < Math.min(lineStart.y, lineEnd.y) - range ||
      point.y > Math.max(lineStart.y, lineEnd.y) + range
    ) {
      return false;
    }
    return true;
  }

  // checks if a point is on an arc
  // return true if the point is within the arc
  // return false if the point is outside the circle or if the point is on the circle, but not within the arc
  isPointInArc(intersection: Coord, arcStart: Coord, arcEnd: Coord): boolean {
    // the arc always goes from the start point to the end point in a counter-clockwise direction.
    // use the cross product to determine if the point is on the left or right side of the line from the start point to the end point.
    // if the point is on the left side, then it is within the arc.
    // if the point is on the right side, then it is outside the arc.
    let crossProduct =
      (arcEnd.x - arcStart.x) * (intersection.y - arcStart.y) -
      (intersection.x - arcStart.x) * (arcEnd.y - arcStart.y);

    // check if the point is on the left side of the line from the start point to the end point
    return crossProduct < 0;
  }

  // https://stackoverflow.com/questions/13937782/calculating-the-point-of-intersection-of-two-lines
  // line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
  // Determine the intersection point of two line segments
  // Return undefiend if the lines don't intersect
  lineLineIntersect(line1Start: Coord, line1End: Coord, line2Start: Coord, line2End: Coord): Coord | undefined {
    let x1 = line1Start.x;
    let y1 = line1Start.y;
    let x2 = line1End.x;
    let y2 = line1End.y;
    let x3 = line2Start.x;
    let y3 = line2Start.y;
    let x4 = line2End.x;
    let y4 = line2End.y;

    let delta = 0.

    // check if none of the lines are of length 0
    if ((this.twoNumsLooselyEquals(x1, x2) && this.twoNumsLooselyEquals(y1, y2)) || (this.twoNumsLooselyEquals(x3, x4) && this.twoNumsLooselyEquals(y3, y4))) {
      return undefined;
    }

    let denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

    // check if lines are parallel
    if (denominator === 0) {
      return undefined;
    }

    let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
    let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

    // check if intersection is not within the segments
    if (ua <= 0 || ua >= 1 || ub <= 0 || ub >= 1) {
      return undefined;
    }

    // return Coord with x and y coordinates of intersection
    let x = x1 + ua * (x2 - x1);
    let y = y1 + ua * (y2 - y1);

    let intersection = new Coord(x, y);

    // checks if the intersection is an end point of the segments
    if (intersection.looselyEquals(line1Start, this.scale) ||
    intersection.looselyEquals(line1End, this.scale) ||
    intersection.looselyEquals(line2Start, this.scale) ||
    intersection.looselyEquals(line2End, this.scale)) {
      return undefined;
    }

    return intersection;
  }

  // return the intersection points between a line and a circle.
  // if the line is tangent to the circle, then return the point of tangency.
  // if the line does not intersect the circle, return undefined.
  lineCircleIntersect(lineStart: Coord, lineEnd: Coord, circleCenter: Coord, circleRadius: number): Coord[] | undefined {
    // check if the line is vertical or not
    if (this.twoNumsLooselyEquals(lineEnd.x, lineStart.x)) {
      // line is vertical so equation is x = c
      let c = lineStart.x;

      // find equation of the circle in the form (x - h)^2 + (y - k)^2 = r^2
      let h = circleCenter.x;
      let k = circleCenter.y;
      let r = circleRadius;

      // substitute x = c into the circle equation and solve for y
      // this will give a quadratic equation in the form ay^2 + by + c = 0
      let a = 1; // coefficient of y^2
      let b = -2 * k; // coefficient of y
      let d = c - h; // constant term divided by 2
      let e = d * d + k * k - r * r; // constant term

      // find the discriminant of the quadratic equation
      // this will determine how many solutions there are
      let D = b * b - 4 * a * e; // discriminant


      if (D < 0) {
        // if D is negative, then there are no real solutions and the line does not intersect the circle
        return undefined;
      } else if (D === 0) {
        // if D is zero, then there is one real solution and the line is tangent to the circle
        let y = -b / (2 * a); // solution for y
        return [new Coord(c, y)]; // return the point of tangency as an array of one coordinate object
      } else if (D > 0) {
        // if D is positive, then there are two real solutions and the line intersects the circle at two points
        let y1 = (-b + Math.sqrt(D)) / (2 * a); // first solution for y
        let y2 = (-b - Math.sqrt(D)) / (2 * a); // second solution for y
        return [new Coord(c, y1), new Coord(c, y2)]; // return the intersection points as an array of two coordinate objects
      }
    } else {
      let intersections: Coord[] = [];
      let slope = (lineStart.y - lineEnd.y) / (lineStart.x - lineEnd.x);
      let y_intercept = lineStart.y - slope * lineStart.x;

      let a = 1 + slope * slope;
      let b = 2 * slope * (y_intercept - circleCenter.y) - 2 * circleCenter.x;
      let c =
        circleCenter.x * circleCenter.x +
        (y_intercept - circleCenter.y) * (y_intercept - circleCenter.y) -
        circleRadius * circleRadius;

      let discriminant = b * b - 4 * a * c;
      const tolerance = 0.00001;
      if (discriminant < -tolerance) {
        // line doesn't touch circle
        return undefined;
      } else if (discriminant < tolerance) {
        // line is tangent to circle
        let x = -b / (2 * a);
        let y = slope * x + y_intercept;
        intersections.push(new Coord(x, y));
        return intersections;
      } else {
        // line intersects circle in two places
        let x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        let y1 = slope * x1 + y_intercept;
        intersections.push(new Coord(x1, y1));
        let x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
        let y2 = slope * x2 + y_intercept;
        intersections.push(new Coord(x2, y2));
        return intersections;
      }
    }
    return undefined;
  }

  // return the first intersection point between a line and an arc. The first is the one closest to the lineStart point.
  // if the line is tangent to the arc, then return the point of tangency closest to the lineStart point.
  // if the line does not intersect the arc, return undefined.
  lineArcIntersect(lineStart: Coord, lineEnd: Coord, arcStart: Coord, arcEnd: Coord, arcCenter: Coord, findIntersectionCloseTo: Coord, arcRadius: number): Coord | undefined {
    // find the intersection points between the line and the circle defined by the arc
    let intersections: Coord[] | undefined = this.lineCircleIntersect(lineStart, lineEnd, arcCenter, arcRadius);

    intersections = intersections?.filter((intersection) => {
      return this.isPointOnLine(intersection, lineStart, lineEnd);
    });

    if (intersections === undefined || intersections.length === 0) {
      return undefined;
    }

    // check if the intersection points are within the arc
    let closestIntersection: Coord | undefined;
    for (let intersection of intersections) {
      if (
        this.isPointInArc(intersection, arcStart, arcEnd) &&
        !intersection.equals(arcStart, this.scale) &&
        !intersection.equals(arcEnd, this.scale)
      ) {
        // if it is, return closest intersection point
        if (closestIntersection === undefined) {
          closestIntersection = intersection;
        } else if (
          closestIntersection.getDistanceTo(findIntersectionCloseTo) >
          intersection.getDistanceTo(findIntersectionCloseTo)
        ) {
          closestIntersection = intersection;
        }
      }
    }
    return closestIntersection;
  }

  // return the intersection points between two circles.
  // if the circles do not intersect, return undefined.
  circleCircleIntersect(center: Coord, radius: number, center2: Coord, radius2: number): [Coord[] | undefined, boolean] {
    let x1 = center.x;
    let y1 = center.y;
    let x2 = center2.x;
    let y2 = center2.y;

    let dx = x2 - x1;
    let dy = y2 - y1;
    let d = Math.sqrt(dx * dx + dy * dy);

    // Circles are separate
    if (d > radius + radius2) {
      return [undefined, false];
    }

    // One circle is contained within the other
    if (d < Math.abs(radius - radius2)) {
      return [undefined, false];
    }

    // Circles are coincident
    if (d === 0 && radius === radius2) {
      // console.log('Circles are coincident');
      return [undefined, true];
    }

    let a = (radius * radius - radius2 * radius2 + d * d) / (2 * d);
    let h = Math.sqrt(radius * radius - a * a);
    let x3 = x1 + (a * dx) / d;
    let y3 = y1 + (a * dy) / d;
    let x4 = x3 + (h * dy) / d;
    let y4 = y3 - (h * dx) / d;
    let x5 = x3 - (h * dy) / d;
    let y5 = y3 + (h * dx) / d;

    return [[new Coord(x4, y4), new Coord(x5, y5)], false];
  }

  // return the first intersection point between two arcs, the one closest to the startPosition point
  // if the arcs are tangent, then return the point of tangency closest to the startPosition point
  // if the arcs do not intersect, return undefined
  arcArcIntersect(startPosition: Coord, endPosition: Coord, center: Coord, startPosition2: Coord, endPosition2: Coord, center2: Coord, radius: number): Coord | undefined {
    // find the intersection points between the two circles defined by the arcs
    let [intersections, coincident]: [Coord[] | undefined, boolean] = this.circleCircleIntersect(center, radius, center2, radius);

    if (coincident) {
      // circles are coincident, so we need to check if the arcs intersect
      // check if the start and end points of the arcs are within the other arc

      let allImportantIntersections: Coord[] = [];

      if (this.isPointInArc(startPosition, startPosition2, endPosition2)) {
        allImportantIntersections.push(startPosition);
      }
      if (this.isPointInArc(endPosition, startPosition2, endPosition2)) {
        allImportantIntersections.push(endPosition);
      }
      if (this.isPointInArc(startPosition2, startPosition, endPosition)) {
        allImportantIntersections.push(startPosition2);
      }
      if (this.isPointInArc(endPosition2, startPosition, endPosition)) {
        allImportantIntersections.push(endPosition2);
      }

      // if there are no intersections, then the arcs do not intersect.
      if (allImportantIntersections.length === 0) {
        return undefined;
      }

      // else find the intersection closest to the startPosition.
      let closestIntersection: Coord | undefined;
      for (let intersection of allImportantIntersections) {
        if (closestIntersection === undefined) {
          closestIntersection = intersection;
        } else if (
          intersection.getDistanceTo(startPosition) < closestIntersection.getDistanceTo(startPosition)
        ) {
          closestIntersection = intersection;
        }
      }
      return closestIntersection;
    }

    // check if no intersections
    if (intersections === undefined) {
      return undefined;
    }

    // check if intersection points are within the arcs
    let closestIntersection: Coord | undefined;

    for (let intersection of intersections) {
      if (
        this.isPointInArc(intersection, startPosition, endPosition) &&
        this.isPointInArc(intersection, startPosition2, endPosition2) &&
        !intersection.equals(startPosition, this.scale) &&
        !intersection.equals(endPosition, this.scale) &&
        !intersection.equals(startPosition2, this.scale) &&
        !intersection.equals(endPosition2, this.scale)
      ) {
        if (!closestIntersection) {
          // for first iteration only
          closestIntersection = intersection;
        } else if (intersection.getDistanceTo(startPosition) < closestIntersection.getDistanceTo(startPosition)) {
          closestIntersection = intersection;
        }
      }
    }

    return closestIntersection;
  }

  // finds intersection between line/arc and line/arc
  intersectsWith(line1: [Coord, Coord, Coord | null, Link], line2: [Coord, Coord, Coord | null, Link], radius: number): Coord | undefined {
    if (line1[2] === null && line2[2] === null) {
      // line and line intersection
      return this.lineLineIntersect(line1[0], line1[1], line2[0], line2[1]);
    } else if (line1[2] === null && line2[2] !== null) {
      // line and arc intersection
      return this.lineArcIntersect(line1[0], line1[1], line2[0], line2[1], line2[2], line1[0], radius);
    } else if (line1[2] !== null && line2[2] === null) {
      // arc and line intersection
      return this.lineArcIntersect(line2[0], line2[1], line1[0], line1[1], line1[2], line1[0], radius);
    } else if (line1[2] !== null && line2[2] !== null) {
      // arc and arc intersection
      return this.arcArcIntersect(line1[0], line1[1], line1[2], line2[0], line2[1], line2[2], radius);
    } else {
      // error
      return undefined;
    }
  }

  // splits the intersections by which lines each one was in
  groupIntersectionsByPath(lines: [Coord, Coord, Coord | null, Link][], intersections: {point: Coord, i: number}[]): Coord[][] {
    return lines.map((_, index) => {
      return intersections.filter(p => p.i === index)
        .map(p => (p.point));
    });
  }

  // calculates projection of a point on a line
  projectPointOnLine(p: Coord, lineStart: Coord, lineEnd: Coord) {
    const startEndX = lineEnd.x - lineStart.x;
    const startEndY = lineEnd.y - lineStart.y;

    const startPX = p.x - lineStart.x;
    const startPY = p.y - lineStart.y;

    const startEndLenSq = startEndX * startEndX + startEndY * startEndY;
    // is normalized, so between 0 and 1
    return (startPX * startEndX + startPY * startEndY) / startEndLenSq;
  }

  // split a line by the intersection points
  splitLineByIntersections(line: [Coord, Coord, Coord | null, Link], points: Coord[]): [Coord, Coord, Coord | null, Link][] {
    // calculate the projection and filter out any points with t below 0 or above 1
    let tPoints = points.map(point => {
      let t = this.projectPointOnLine(point, line[0], line[1]);
      return {p: point, t: t};
    }).filter(point => {
      return point.t > 0 && point.t < 1;
    });

    // sort according to t, the projection
    tPoints.sort((a, b) => {
      return a.t - b.t;
    });

    // add endpoints
    const orderedPoints = [{p: line[0], t: 0}, ...tPoints, {p: line[1], t: 1}];

    // rebuild line segments
    let segments: [Coord, Coord, Coord | null, Link][] = [];
    for (let i = 0; i < orderedPoints.length - 1; i++) {
      const pointOne = orderedPoints[i];
      const pointTwo = orderedPoints[i + 1];
      segments.push([pointOne.p, pointTwo.p, line[2], line[3]]);
    }
    return segments;
  }

  // split an arc along intersection points
  splitArcByIntersection(arc: [Coord, Coord, Coord | null, Link], points: Coord[]): [Coord, Coord, Coord | null, Link][] {
    if (arc[2] !== null) {
      let intersectionsWithAngles:{p:Coord, angle: number}[] = points.map((p) => ({
        p: p,
        angle: Math.atan2(p.y - (arc[2]?.y ?? 0), p.x - (arc[2]?.x ?? 0))
      }));
      let resultOrderedPoints = intersectionsWithAngles.sort((a, b) => a.angle - b.angle);

      // removes any intersection points that are at the end points
      resultOrderedPoints = resultOrderedPoints.filter((point) => {
        return !((this.twoNumsLooselyEquals(point.p.x, arc[0].x) && this.twoNumsLooselyEquals(point.p.y, arc[0].y)) || (this.twoNumsLooselyEquals(point.p.x, arc[1].x) && this.twoNumsLooselyEquals(point.p.y, arc[1].y)));
      });

      resultOrderedPoints = [{p: arc[0], angle: 0}, ...resultOrderedPoints, {p: arc[1], angle: Math.atan2(arc[1].y - arc[2].y, arc[1].x - arc[2].x)}];

      let segments: [Coord, Coord, Coord | null, Link][] = [];
      for (let i = 0; i < resultOrderedPoints.length - 1; i++) {
        const pointOne = resultOrderedPoints[i];
        const pointTwo = resultOrderedPoints[i + 1];
        segments.push([pointOne.p, pointTwo.p, arc[2], arc[3]]);
      }
      return segments;
    } else {
      return [];
    }
  }

  // This function returns the lines used to calculate and save the lines of a link
  solveForExternalLines(subLinks: Map<number, Link>, radius: number): [Coord, Coord, Coord | null, Link][] {
    // create a list of all the external lines of all the sublinks
    /* First Coord is starting position
      Second Coord is ending position
      boolean is true if the line is an arc
      Last is the center Coord of an arc, null if it is just a line
    */
    //radius = 0.15;
    let externalLines: [Coord, Coord, Coord | null, Link][] = [];
    let allLinkExternalLines: Map<Link, [Coord, Coord, Coord | null, Link][]> = new Map();

    // find and add all external lines for sublinks
    for (let link of subLinks.values()) {
      let allCoords: Coord[] = [];
      for(let joint of link.joints.values()) {
        allCoords.push(joint._coords);
      }
      allCoords = Array.from(allCoords, (coord) => {
        return this.unitConversionService.modelCoordToSVGCoord(coord);
      });

      let linkExternalLines: [Coord, Coord, Coord | null, Link][] = [];

      // find the hull points using the coords
      let hullPoints: Coord[] = this.grahamScan(allCoords);
      let collinearCoords: Coord[] | undefined = this.findCollinearCoords(allCoords);

      if (collinearCoords !== undefined) {
        // Calculate perpendicular direction vectors for the line
        const dirFirstToSecond = this.perpendicularDirection(collinearCoords[0], collinearCoords[1]);
        const dirSecondToFirst = this.perpendicularDirection(collinearCoords[1], collinearCoords[0]);

        // Line from first to second Point
        const point1: Coord = new Coord(collinearCoords[0].x + dirFirstToSecond.x * radius, collinearCoords[0].y + dirFirstToSecond.y * radius);
        const point2: Coord = new Coord(collinearCoords[1].x + dirFirstToSecond.x * radius, collinearCoords[1].y + dirFirstToSecond.y * radius);
        externalLines.push([point1.clone(), point2.clone(), null, link]);
        linkExternalLines.push([point1.clone(), point2.clone(), null, link]);

        // Arc around first joint
        const point3: Coord = new Coord(collinearCoords[1].x + dirSecondToFirst.x * radius, collinearCoords[1].y + dirSecondToFirst.y * radius);
        externalLines.push([point2.clone(), point3.clone(), collinearCoords[1].clone(), link]);
        linkExternalLines.push([point2.clone(), point3.clone(), collinearCoords[1].clone(), link]);

        // Line from second back to first Point
        const point4: Coord = new Coord(collinearCoords[0].x + dirSecondToFirst.x * radius, collinearCoords[0].y + dirSecondToFirst.y * radius);
        externalLines.push([point3.clone(), point4.clone(), null, link]);
        linkExternalLines.push([point3.clone(), point4.clone(), null, link]);

        // Arc around the second joint
        const point5: Coord = new Coord(collinearCoords[0].x + dirFirstToSecond.x * radius, collinearCoords[0].y + dirFirstToSecond.y * radius);
        externalLines.push([point4.clone(), point5.clone(), collinearCoords[0].clone(), link]);
        linkExternalLines.push([point4.clone(), point5.clone(), collinearCoords[0].clone(), link]);
        //console.log(externalLines);
      } else {
        if (hullPoints.length < 3) {
          throw new Error('At least three points are required to create a path with rounded corners.');
        }

        console.log("hull points");
        console.log(hullPoints);

        // Start the path, moving the pointer to the first correct point
        const dirFirstToSecondInit = this.perpendicularDirection(hullPoints[0], hullPoints[1]);

        // last position
        let lastPosition: Coord = new Coord(hullPoints[0].x + dirFirstToSecondInit.x * radius, hullPoints[0].y + dirFirstToSecondInit.y * radius);

        //iterate over all the points, one line and one arc at a time
        for (let i = 0; i < hullPoints.length; i++) {
          //get current points to look at.
          const c0 = hullPoints[i];
          const c1 = hullPoints[(i + 1) % hullPoints.length];
          const c2 = hullPoints[(i + 2) % hullPoints.length];
          //get the Perpendicular Direction for the Path
          const dirFirstToSecond = this.perpendicularDirection(c0, c1);
          const dirSecondToThird = this.perpendicularDirection(c1, c2);

          // Line from first joint to second joint
          let point1: Coord = new Coord(c1.x + dirFirstToSecond.x * radius, c1.y + dirFirstToSecond.y * radius);
          externalLines.push([lastPosition, point1, null, link]);
          linkExternalLines.push([lastPosition, point1, null, link]);

          // Arc around second joint
          let point2: Coord = new Coord(c1.x+ dirSecondToThird.x * radius, c1.y + dirSecondToThird.y * radius);
          let point2Center: Coord = c1.clone();
          externalLines.push([point1, point2, point2Center, link]);
          linkExternalLines.push([point1, point2, point2Center, link]);
          lastPosition = point2.clone();
        }
      }

      allLinkExternalLines.set(link, linkExternalLines);
    }

    // need to process the external lines we got
    let stopCounter = 10000;

    // will hold the intersection points of all external lines
    // x is the x coord of intersection, y is y coord of intersection, and i is index in external lines array
    let allIntersectionPoints: {point: Coord, i: number}[] = [];

    // for each external line, need to check for intersections with all other external lines
    for (let i = 0; i < externalLines.length - 1; i++) {
      const line1: [Coord, Coord, Coord | null, Link] = externalLines[i];
      for (let j = i + 1; j < externalLines.length; j++) {
        if (stopCounter-- < 0) {
          console.error("Error, stop counter is at 0");
          return [];
        }

        const line2: [Coord, Coord, Coord | null, Link] = externalLines[j];

        // check if lines intersect, if they do save the intersections
        const intersection = this.intersectsWith(line1, line2, radius);

        if (intersection !== undefined) {
          if (!(line1[1].equals(intersection, this.scale) || line1[0].equals(intersection, this.scale))) {
            allIntersectionPoints.push({point: intersection, i: i});
          }
          if (!(line2[0].equals(intersection, this.scale) || line2[1].equals(intersection, this.scale))) {
            allIntersectionPoints.push({point: intersection, i: j});
          }
        }

      }
    }

    // checking if there are any duplicate intersection points for each line
    let duplicatePoints: number[] = [];
    allIntersectionPoints.forEach((point, index) => {
      for (let j = index + 1; j < allIntersectionPoints.length; j++) {
        if (this.twoNumsLooselyEquals(point.point.x, allIntersectionPoints[j].point.x) && this.twoNumsLooselyEquals(point.point.y, allIntersectionPoints[j].point.y) && point.i === allIntersectionPoints[j].i) {
          duplicatePoints.push(index);
          break;
        }
      }
    });

    // removing the duplicate intersection points, if any
    let removedDuplicatePoints: {point: Coord, i: number}[] = [];
    allIntersectionPoints.forEach((point, index) => {
      if (!duplicatePoints.includes(index)) {
        removedDuplicatePoints.push(point);
      }
    });

    // grouping intersections by line
    let intersectionsByCoords: Coord[][] = this.groupIntersectionsByPath(externalLines, removedDuplicatePoints);

    // will hold the new external lines with the intersections considered
    let intersectionExternalLines: [Coord, Coord, Coord | null, Link][] = [];

    // splitting each line by intersections
    for (let i = 0; i < externalLines.length; i++) {
      if (externalLines[i][2] === null) {
        // segment is a line
        let lineSegments = this.splitLineByIntersections(externalLines[i], intersectionsByCoords[i]);
        intersectionExternalLines.push(...lineSegments);
      } else {
        // segment is an arc
        let arcSegments = this.splitArcByIntersection(externalLines[i], intersectionsByCoords[i]);
        intersectionExternalLines.push(...arcSegments);
      }
    }

    return externalLines;
  }

  calculateCompoundPath(subLinks: Map<number, Link>, allCoordsList: Coord[], r: number) {
    // allExternalLines will hold the path coordinates for each line and arc for all the coords
    let allExternalLines: [Coord, Coord, Coord | null, Link][] = this.solveForExternalLines(subLinks, r);
    //console.log(allExternalLines);

    if (allExternalLines.length < 1) {
      return '';
    }

    // converting external lines list into a set, which we will delete lines we have used
    const externalLinesSet = new Set(allExternalLines);

    let pathString = '';

    let timeoutCounter = 1000;

    while (externalLinesSet.size > 1) {
      // this is the first line from the set
      let currentLine: [Coord, Coord, Coord | null, Link] = externalLinesSet.values().next().value;

      let beginningPoint: Coord = currentLine[1].clone();

      while (!currentLine[1].equals(beginningPoint, 1) || this.isNewShape(pathString)) {
        if (timeoutCounter-- < 0) {
          return pathString;
        }

        // find the next line that starts at the end of the current line
        const nextLine = [...externalLinesSet].find((line) => {
          return line[0].looselyEquals(currentLine[1], 1);
        });
        //console.log(nextLine);

        if (!nextLine) {
          break;
        }
        externalLinesSet.delete(nextLine);

        // when there are two lines intersecting, create a fillet between them
        if (currentLine[2] === null && nextLine[2] == null &&
          // checking if angle between the two lines is greater than 10 degrees
          Math.abs(this.angleToPI(nextLine, currentLine)) > (10 * Math.PI / 180)) {
          let [currentLineOffsetPoint, nextLineOffsetPoint, radius] = this.computeArcPointsAndRadius(currentLine, nextLine, 1);

          currentLine[1] = currentLineOffsetPoint;
          nextLine[0] = nextLineOffsetPoint;

          if (this.isNewShape(pathString)) {
            pathString += 'M ' + currentLine[1].x + ', ' + currentLine[1].y + ' ';
          } else {
            pathString = this.pathStringForLine(currentLine, pathString);
          }

          // !!! is 0 0 0 correct?
          pathString += 'A ' + radius + ', ' + radius + ' 0 0 0 ' + nextLine[0].x + ', ' + nextLine[0].y + ' ';
        } else {
          // otherwise, just draw a line between the two points
          if (this.isNewShape(pathString)) {
            pathString += 'M ' + currentLine[1].x + ', ' + currentLine[1].y + ' ';
          } else {
            pathString = this.pathStringForLine(currentLine, pathString);
          }
        }
        currentLine = nextLine;
      }
      pathString = this.pathStringForLine(currentLine, pathString);
      pathString += 'Z ';
    }
    //console.log(pathString);
    return pathString;
  }

  // calculate and return the path string plus the path of the line
  pathStringForLine(line: [Coord, Coord, Coord | null, Link], pathString: string):string {
    if (line[2] !== null) {
      // if the line is an arc
      pathString += 'A ' + line[0].getDistanceTo(line[2]) + ', ' + line[0].getDistanceTo(line[2]) + ' 0 0 1 ' + line[1].x + ', ' + line[1].y + ' ';
    } else {
      // if the line is just a line
      pathString += 'L ' + line[1].x + ', ' + line[1].y + ' ';
    }
    return pathString;
  }


}
