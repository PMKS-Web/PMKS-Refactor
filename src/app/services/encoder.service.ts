import { Mechanism } from '../model/mechanism';
import { Joint } from '../model/joint';
import { Link } from '../model/link';
import { CompoundLink } from '../model/compound-link';
import { Trajectory } from '../model/trajectory';
import { Force } from '../model/force';
import { Position } from '../model/position';
import { StateService } from './state.service';
import LZString from 'lz-string';
import { PanZoomService } from './pan-zoom.service';
import { UndoRedoService } from './undo-redo.service';

export class EncoderService {
  constructor(
    private stateService: StateService,
    private panZoomService: PanZoomService,
    private undoRedoService: UndoRedoService
  ) {}

  // Retrieves the current Mechanism instance from the StateService.
  get mechanism() {
    return this.stateService.getMechanism();
  }

  private sectionHeaders: Record<string, string[]> = {
    j: [
      'Joint ID',
      'Joint Name',
      'X Position',
      'Y Position',
      'Joint Type',
      'Angle',
      'Grounded?',
      'Is Input?',
      'Input Speed',
      'Is Welded?',
      'Locked?',
      'Hidden?',
      'Is Reference?',
      'Is Generated?',
    ],
    l: [
      'Link ID',
      'Link Name',
      'Mass',
      'Color',
      'Center of Mass X',
      'Center of Mass Y',
      'Joint IDs',
      'Force IDs',
      'Locked?',
      'Length',
      'Angle',
    ],
    c: [
      'Compound Link ID',
      'Name',
      'Mass',
      'Center of Mass X',
      'Center of Mass Y',
      'Sub-Link IDs',
      'Lock',
    ],
    t: [
      'Trajectory ID',
      'X Position', // If you have more than one point, expand as needed
      'Y Position',
    ],
    f: [
      'Force ID',
      'Force Name',
      'Start X',
      'Start Y',
      'End X',
      'End Y',
      'Magnitude',
      'Angle',
      'Frame of Reference',
      'Parent Link',
    ],
    p: [
      'Position ID',
      'Position Name',
      'Mass',
      'Color',
      'Center of Mass X',
      'Center of Mass Y',
      'Joint IDs',
      'Force IDs',
      'Locked?',
      'Reference Point',
      'Length',
      'Angle',
    ],
    z: ['Zoom', 'Pan X', 'Pan Y'],
    fb: ['sixBarGenerated', 'fourBarGenerated'],
    u: ['undoStack'],
    r: ['redoStack'],
  };

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
      console.log('Data: ');
      console.log(compactData);
      const jsonData = JSON.stringify(compactData, this.compressionReplacer);
      console.log(jsonData);
      let compressedjsonData = jsonData
        .replaceAll('","', '~')
        .replaceAll(',', '_')
        .replaceAll('Reference Point', 'RP')
        .replaceAll('"]_["', '--');
      console.log(compressedjsonData);
      return LZString.compressToEncodedURIComponent(compressedjsonData);
    } catch (error) {
      console.error('Error encoding mechanism data:', error);
      return '';
    }
  }

  /**
   * Exports the mechanism data as a CSV string.
   * The data is produced in a compact form (arrays in a fixed order) and then converted to CSV.
   */
  public exportMechanismDataToCSV(): string {
    const data = this.compactMechanismData(this.mechanism);
    console.log(data);
    let csvOutput = '';
    // For each section (joints, links, etc.) use its short key.
    for (const section of Object.keys(data)) {
      csvOutput += `--- ${section} ---\n`;
      // For each row, run each field through csvEscape to protect against commas, quotes, or newlines.

      // Inject the header row if present
      if (this.sectionHeaders[section]) {
        csvOutput +=
          this.sectionHeaders[section]
            .map((header) => this.csvEscape(header))
            .join(',') + '\n';
      }

      csvOutput += data[section]
        .map((row: any[]) =>
          row.map((value) => this.csvEscape(value)).join(',')
        )
        .join('\n');
      csvOutput += '\n\n';
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
      j: mechanism
        .getArrayOfJoints()
        .map((j: Joint) => [
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
          j.isReference,
          j.isGenerated,
        ]),
      l: mechanism.getArrayOfLinks().map((l: Link) => [
        l.id,
        l.name,
        l.mass,
        l.color,
        l.centerOfMass.x,
        l.centerOfMass.y,
        Array.from(l.joints.values())
          .map((j: Joint) => j.id)
          .join('|'),
        Array.from(l.forces.values())
          .map((f: Force) => f.id)
          .join('|'),
        l.locked,
        l.length,
        l.angle,
      ]),
      c: mechanism.getArrayOfCompoundLinks().map((cl: CompoundLink) => [
        cl.id,
        cl.name,
        cl.mass,
        cl.centerOfMass.x,
        cl.centerOfMass.y,
        Array.from(cl.links.values())
          .map((l: Link) => l.id)
          .join('|'),
        cl.lock,
      ]),
      t: mechanism.getArrayOfTrajectories().map((t: Trajectory) => [
        t.id,
        t.coords[0].x, // assuming one-point trajectory, might be TODO
        t.coords[0].y,
      ]),
      f: mechanism
        .getArrayOfForces()
        .map((f: Force) => [
          f.id,
          f.name,
          f.start.x,
          f.start.y,
          f.end.x,
          f.end.y,
          f.frameOfReference,
          f.parentLink.id,
        ]),
      p: mechanism.getArrayOfPositions().map((p: Position) => [
        p.id,
        p.name,
        p.mass,
        p.color,
        p.centerOfMass.x,
        p.centerOfMass.y,
        Array.from(p.joints.values())
          .map((j: Joint) => j.id)
          .join('|'),
        Array.from(p.forces.values())
          .map((f: Force) => f.id)
          .join('|'),
        p.locked,
        p.refPoint,
        p.length,
        p.angle,
      ]),
      z: [
        [
          this.panZoomService.getCurrentZoom().toFixed(2),
          this.panZoomService.getViewBoxX().toFixed(2),
          this.panZoomService.getViewBoxY().toFixed(2),
        ],
      ],
      fb: [
        [this.stateService.sixBarGenerated, this.stateService.fourBarGenerated],
      ],
      u: this.undoRedoService
        .getUndoStack()
        .map(action => ({ ...action })),
      r: this.undoRedoService
        .getRedoStack()
        .map(action => ({ ...action })),
    };
  }
  /**
   * A custom replacer for JSON.stringify that converts numbers to hexadecimal strings
   * and booleans to y/n
   *
   * Note: On decoding, you'll need to reverse these transformations.
   */

  private compressionReplacer(key: string, value: any): any {
    //DO NOT REMOVE KEY
    if (typeof value === 'boolean') {
      return value ? 'y' : 'n';
    }
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value.toString(16);
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
