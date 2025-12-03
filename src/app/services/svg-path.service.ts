import {Injectable} from '@angular/core';
import {Coord} from 'src/app/model/coord'
import {Link} from "../model/link";
import {UnitConversionService} from "./unit-conversion.service";

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
