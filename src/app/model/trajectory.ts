import { Coord } from './coord';

export class Trajectory {
  constructor(
    private _coords: Coord[],
    public jointId: number
  ) {}

  /**
   * Clears all trajectory coordinates.
   */
  clear() {
    this._coords = [];
  }

  /**
   * Converts the trajectory coordinates to a path string using the SVGPathService.
   * @param svgPathService - The service to create the SVG path.
   * @returns The SVG path string.
   */
  getPathString(svgPathService: any): string {
    if (this.coords.length === 0) {
      return '';
    }
    return svgPathService.getSingleLinkDrawnPath(this.coords, 2); // Adjust radius as needed
  }

  //Getters
  get coords(): Coord[] {
    return this._coords;
  }
}
