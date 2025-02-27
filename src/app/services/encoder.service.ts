import { Mechanism } from '../model/mechanism';
import { Joint } from "../model/joint";
import { Link } from "../model/link";
import { Coord } from "../model/coord";
import { CompoundLink } from "../model/compound-link";
import { Trajectory } from "../model/trajectory";
import { Force } from "../model/force";
import { Position } from "../model/position";
import { StateService } from "./state.service";

export class EncoderService {


  constructor(private stateService: StateService) {
    //this._mechanism = this.stateService.getMechanism();
  }

  get mechanism() {
    return this.stateService.getMechanism();
  }
  /**
   * Encodes the mechanism into a one-line, URL-friendly string.
   * This method:
   * - Directly aggregates and compacts the mechanism data (dropping field names).
   * - Uses a custom replacer to convert numbers to hexadecimal strings and booleans to "1"/"0".
   * - Produces a JSON string that is then URL-encoded.
   */
  public encodeForURL(): string {
    try {
      const compactData = this.compactMechanismData(this.mechanism);
      console.log(compactData);
      const jsonData = JSON.stringify(compactData, this.compressionReplacer);
      let compressedjsonData = jsonData.replaceAll('","',"~").replaceAll(',',"_").replaceAll("Reference Point", "RP").replaceAll('"]_["',"--")
      console.log(compressedjsonData);
      return encodeURIComponent(compressedjsonData);
    } catch (error) {
      console.error("Error encoding mechanism data:", error);
      return "";
    }
  }

  /**
   * Exports the mechanism data as a CSV string.
   * The data is produced in a compact form (arrays in a fixed order) and then converted to CSV.
   */
  public exportMechanismDataToCSV(): string {
    const data = this.compactMechanismData(this.mechanism);
    let csvOutput = "";
    // For each section (joints, links, etc.) use its short key.
    for (const section of Object.keys(data)) {
      csvOutput += `--- ${section} ---\n`;
      // For each row, run each field through csvEscape to protect against commas, quotes, or newlines.
      csvOutput += data[section]
        .map((row: any[]) => row.map(value => this.csvEscape(value)).join(","))
        .join("\n");
      csvOutput += "\n\n";
    }
    return csvOutput;
  }

  /**
   * Produces a compact representation of the mechanism data.
   *
   * The output object has the following keys:
   * - j: joints, as arrays in the order:
   *      [id, name, coordX, coordY, type, angle, isGrounded, inputSpeed, isWelded, locked, isHidden, isReference]
   * - l: links, as arrays in the order:
   *      [id, name, mass, color, centerOfMassX, centerOfMassY, joints (joined by "|"), forces (joined by "|"), locked, length, angle]
   * - c: compoundLinks, as arrays in the order:
   *      [id, name, mass, centerOfMassX, centerOfMassY, links (joined by "|"), lock]
   * - t: trajectories, as arrays in the order (assuming one-point trajectories):
   *      [id, pointX, pointY]
   * - f: forces, as arrays in the order:
   *      [id, name, startX, startY, endX, endY, magnitude, angle, frameOfReference]
   * - p: positions, as arrays in the order:
   *      [id, name, mass, color, centerOfMassX, centerOfMassY, joints (joined by "|"), forces (joined by "|"), locked, refPoint, length, angle]
   *
   * For fields that are arrays (like joints on a link) the array of IDs is joined by a "|" delimiter.
   * If `refPoint` is an object (with x and y) it is also compacted into a string.
   */
  private compactMechanismData(mechanism: Mechanism): any {
    return {
      j: mechanism.getArrayOfJoints().map((j: Joint) => [
        j.id,
        j.name,
        j.coords.x,
        j.coords.y,
        j.type,
        j.angle,
        j.isGrounded,
        j.isInput,
        j.inputSpeed,
        j.isWelded,
        j.locked,
        j.isHidden,
        j.isReference
      ]),
      l: mechanism.getArrayOfLinks().map((l: Link) => [
        l.id,
        l.name,
        l.mass,
        l.color,
        l.centerOfMass.x,
        l.centerOfMass.y,
        Array.from(l.joints.values()).map((j: Joint) => j.id).join("|"),
        Array.from(l.forces.values()).map((f: Force) => f.id).join("|"),
        l.locked,
        l.length,
        l.angle
      ]),
      c: mechanism.getArrayOfCompoundLinks().map((cl: CompoundLink) => [
        cl.id,
        cl.name,
        cl.mass,
        cl.centerOfMass.x,
        cl.centerOfMass.y,
        Array.from(cl.links.values()).map((l: Link) => l.id).join("|"),
        cl.lock
      ]),
      t: mechanism.getArrayOfTrajectories().map((t: Trajectory) => [
        t.id,
        t.coords[0].x,  // assuming one-point trajectory, might be TODO
        t.coords[0].y
      ]),
      f: mechanism.getArrayOfForces().map((f: Force) => [
        f.id,
        f.name,
        f.start.x,
        f.start.y,
        f.end.x,
        f.end.y,
        f.magnitude,
        f.angle,
        f.frameOfReference
      ]),
      p: mechanism.getArrayOfPositions().map((p: Position) => [
        p.id,
        p.name,
        p.mass,
        p.color,
        p.centerOfMass.x,
        p.centerOfMass.y,
        Array.from(p.joints.values()).map((j: Joint) => j.id).join("|"),
        Array.from(p.forces.values()).map((f: Force) => f.id).join("|"),
        p.locked,
        p.refPoint,
        p.length,
        p.angle
      ])
    };
  }

  /**
   * A custom replacer for JSON.stringify that converts numbers to hexadecimal strings
   * and booleans to "1" or "0" for additional compression.
   *
   * Note: On decoding, you'll need to reverse these transformations.
   */
  private compressionReplacer(key: string, value: any): any {
    if (typeof value === "number") {
      if (Number.isInteger(value)) {
        return value.toString(16);
      } else {
        // Keep floating‐point numbers in normal decimal string form:
        return value;//.toString();
        // or simply `return value;` if you don’t even want to stringify floats.
      }
    }
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }
    return value;
  }

  /**
   * If the field contains a comma, newline, or quotes, the field is wrapped in quotes
   * and inner quotes are doubled. Prevents issues with CSV format.
   */
  private csvEscape(value: any): string {
    if (value === null || value === undefined) return '';
    const str = value.toString();
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

}
