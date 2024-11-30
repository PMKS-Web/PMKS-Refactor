import { Injectable } from '@angular/core';
import { Coord } from 'src/app/model/coord'
import { Joint } from 'src/app/model/joint'
@Injectable({
  providedIn: 'root',
})
export class SVGPathService {

  constructor() {}

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

//performs a XOR on the direction of the path between two coordinates
 arcDirection(coord1: Coord, coord2: Coord): number{
	return (coord2.x-coord1.x < 0) !== (coord2.y-coord1.y < 0) ? 0 : 1;
 }

// Function to calculate the correct perpendicular direction vector between two points
perpendicularDirection(c1: Coord, c2: Coord): Coord {
  const dir: Coord = this.direction(c1,c2);
  let xStatus = (dir.x > 0) ? 'pos' : (dir.x < 0) ? 'neg' : 'zero';
  let yStatus = (dir.y > 0) ? 'pos' : (dir.y < 0) ? 'neg' : 'zero';
  const caseKey = `${xStatus}_${yStatus}`;
  let pointAtRadiusPerpToDir = new Coord(dir.y,-dir.x)
  return pointAtRadiusPerpToDir;
}

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

  getCompoundLinkSVG(): string{
    return ``;
  }

  calculateLengthSVGPath(coord1: Coord, coord2: Coord): string {
    // Calculate perpendicular direction vectors for the line
    const dirFirstToSecond = this.perpendicularDirection(coord1, coord2);
    const dirSecondToFirst = this.perpendicularDirection(coord2, coord1);
    // Create the rounded line path
    let pathData = `M ${coord1.x},${coord1.y - 100} `; // Move to the first point
    pathData += `V ${coord1.y - 50} `;
    pathData += `M ${coord1.x},${coord1.y - 75} `;
    pathData += `L ${coord2.x},${coord2.y - 75} `;
    pathData += `M ${coord2.x},${coord2.y - 100} `;
    pathData += `V ${coord2.y - 50} `;
    //Need to generalize
    return pathData;
  }


}
