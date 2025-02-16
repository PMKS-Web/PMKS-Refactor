import { Mechanism } from '../model/mechanism';
import { Joint } from "../model/joint";
import { Link } from "../model/link";
import { CompoundLink } from "../model/compound-link";
import { Trajectory } from "../model/trajectory";
import { Force } from "../model/force";
import { Position } from "../model/position";

/**
 * DecoderService is the reverse of the EncoderService.
 * It accepts a URL-encoded string that was produced by the EncoderService,
 * decodes and parses it, and then reconstructs the full mechanism data.
 *
 * The encoding/decoding process assumes that data was compacted into fixed-order arrays:
 *
 * - For joints (key "j"):
 *    [id, name, coordX, coordY, type, angle, isGrounded, inputSpeed, isWelded, locked, isHidden, isReference]
 *
 * - For links (key "l"):
 *    [id, name, mass, color, centerOfMassX, centerOfMassY, joints (joined by "|"), forces (joined by "|"), locked, length, angle]
 *
 * - For compoundLinks (key "c"):
 *    [id, name, mass, centerOfMassX, centerOfMassY, links (joined by "|"), lock]
 *
 * - For trajectories (key "t"):
 *    [id, pointX, pointY]  (assumes one-point trajectories)
 *
 * - For forces (key "f"):
 *    [id, name, startX, startY, endX, endY, magnitude, angle, frameOfReference]
 *
 * - For positions (key "p"):
 *    [id, name, mass, color, centerOfMassX, centerOfMassY, joints (joined by "|"), forces (joined by "|"), locked, refPoint, length, angle]
 *
 * Note that numbers were converted to hexadecimal strings and booleans to "1" or "0"
 * during encoding.
 */
export class DecoderService {
  /**
   * Decodes an encoded URL string, reconstructs the mechanism data, and passes
   * it to the state service for rebuilding the mechanism.
   *
   * @param encoded The URL-encoded string from the EncoderService.
   * @param stateService An instance of your state service that has a method (e.g., rebuildMechanism)
   *                     to accept the reconstructed mechanism.
   */
  static decode(encoded: string, stateService: { rebuildMechanism: (data: any) => void }): void {
    try {
      // Step 1. URL-decode and parse the JSON.
      const decodedJson = decodeURIComponent(encoded);
      const compactData = JSON.parse(decodedJson);

      // Step 2. Expand the compact data into full objects.
      const fullData = this.expandMechanismData(compactData);

      // Step 3. Pass the reconstructed mechanism data to the state service.
      stateService.rebuildMechanism(fullData);
    } catch (error) {
      console.error("Error decoding mechanism data:", error);
    }
  }

  /**
   * Expands the compact mechanism data back into full objects.
   * Converts hex strings to numbers and "1"/"0" strings to booleans.
   */
  private static expandMechanismData(compactData: any): {
    joints: Joint[],
    links: Link[],
    compoundLinks: CompoundLink[],
    trajectories: Trajectory[],
    forces: Force[],
    positions: Position[]
  } {
    const joints = (compactData.j || []).map((row: any[]) => ({
      id: row[0],
      name: row[1],
      coords: {
        x: this.convertNumber(row[2]),
        y: this.convertNumber(row[3])
      },
      type: row[4],
      angle: this.convertNumber(row[5]),
      isGrounded: this.convertBoolean(row[6]),
      inputSpeed: this.convertNumber(row[7]),
      isWelded: this.convertBoolean(row[8]),
      locked: this.convertBoolean(row[9]),
      isHidden: this.convertBoolean(row[10]),
      isReference: this.convertBoolean(row[11])
    }));

    const links = (compactData.l || []).map((row: any[]) => ({
      id: row[0],
      name: row[1],
      mass: this.convertNumber(row[2]),
      color: row[3],
      centerOfMass: {
        x: this.convertNumber(row[4]),
        y: this.convertNumber(row[5])
      },
      joints: row[6] ? row[6].split("|") : [],
      forces: row[7] ? row[7].split("|") : [],
      locked: this.convertBoolean(row[8]),
      length: this.convertNumber(row[9]),
      angle: this.convertNumber(row[10])
    }));

    const compoundLinks = (compactData.c || []).map((row: any[]) => ({
      id: row[0],
      name: row[1],
      mass: this.convertNumber(row[2]),
      centerOfMass: {
        x: this.convertNumber(row[3]),
        y: this.convertNumber(row[4])
      },
      links: row[5] ? row[5].split("|") : [],
      lock: this.convertBoolean(row[6])
    }));

    const trajectories = (compactData.t || []).map((row: any[]) => ({
      id: row[0],
      coords: [{
        x: this.convertNumber(row[1]),
        y: this.convertNumber(row[2])
      }]
    }));

    const forces = (compactData.f || []).map((row: any[]) => ({
      id: row[0],
      name: row[1],
      start: {
        x: this.convertNumber(row[2]),
        y: this.convertNumber(row[3])
      },
      end: {
        x: this.convertNumber(row[4]),
        y: this.convertNumber(row[5])
      },
      magnitude: this.convertNumber(row[6]),
      angle: this.convertNumber(row[7]),
      frameOfReference: row[8]
    }));

    const positions = (compactData.p || []).map((row: any[]) => ({
      id: row[0],
      name: row[1],
      mass: this.convertNumber(row[2]),
      color: row[3],
      centerOfMass: {
        x: this.convertNumber(row[4]),
        y: this.convertNumber(row[5])
      },
      joints: row[6] ? row[6].split("|") : [],
      forces: row[7] ? row[7].split("|") : [],
      locked: this.convertBoolean(row[8]),
      refPoint: row[9] && row[9].indexOf("|") > -1 ? {
        x: this.convertNumber(row[9].split("|")[0]),
        y: this.convertNumber(row[9].split("|")[1])
      } : row[9],
      length: this.convertNumber(row[10]),
      angle: this.convertNumber(row[11])
    }));

    return { joints, links, compoundLinks, trajectories, forces, positions };
  }

  /**
   * Converts a hex string to a number.
   * If the value is not a string, it falls back to a number conversion.
   */
  private static convertNumber(value: any): number {
    if (typeof value === 'string') {
      return parseInt(value, 16);
    }
    return Number(value);
  }

  /**
   * Converts a string "1" or "0" to a boolean.
   */
  private static convertBoolean(value: any): boolean {
    if (typeof value === 'string') {
      return value === "1";
    }
    return Boolean(value);
  }
}
