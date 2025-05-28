export class Coord {
    private _x: number;
    private _y: number;

    constructor(x: number, y: number) {
        this._x = x;
        this._y = y;
    }

    get x(): number {
        return this._x;
    }

    set x(value: number) {
        this._x = value;
    }

    get y(): number {
        return this._y;
    }

    set y(value: number) {
        this._y = value;
    }

    // Applies a DOMMatrix transformation to this coordinate
    applyMatrix(inverseCTM: DOMMatrix) {
        const x = this.x * inverseCTM.a + this.y * inverseCTM.c + inverseCTM.e;
        const y = this.x * inverseCTM.b + this.y * inverseCTM.d + inverseCTM.f;
        return new Coord(x, y);
    }

    // Calculates the distance to another coordinate
    getDistanceTo(coord: Coord): number {
        return Math.sqrt(Math.pow(this.x - coord.x, 2) + Math.pow(this.y - coord.y, 2));
    }

    // Calculates the angle (in radians) between this coordinate and another
    getAngleTo(arcStart: Coord) {
        return Math.atan2(this.y - arcStart.y, this.x - arcStart.x);
    }

    // Checks if this coordinate is approximately equal to another, scaled by objectScale
    equals(coord: Coord, objectScale: number) {
        return this.getDistanceTo(coord) < 0.0001 * objectScale;
    }

    // Loosely checks equality to another coordinate using a larger threshold
    looselyEquals(coord: Coord, objectScale: number) {
        return this.getDistanceTo(coord) < 0.04 * objectScale;
    }

    // Returns a new Coord that is the sum of this and another vector
    add(vector: Coord) {
        //Add a vector to this coordinate
        return new Coord(this.x + vector.x, this.y + vector.y);
    }

    // Returns a new Coord that is the difference between this and another vector
    subtract(vector: Coord) {
        //Subtract a vector from this coordinate
        return new Coord(this.x - vector.x, this.y - vector.y);
    }

    // Returns a new Coord with the same values as this one
    clone() {
        return new Coord(this.x, this.y);
    }

    // Returns a new Coord scaled by the given multiplier
    scale(shortenBy: number) {
        return new Coord(this.x * shortenBy, this.y * shortenBy);
    }

    // Returns a normalized version of this coordinate (unit vector in same direction)
    normalize() {
        const length = Math.sqrt(this.x * this.x + this.y * this.y);
        return new Coord(this.x / length, this.y / length);
    }

    //multiplies both x and y by the given factor
    multiply(scale: number) {
        return this.scale(scale);
    }


}
