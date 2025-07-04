import { StateService } from './state.service';
import LZString from 'lz-string';
import { PanZoomService } from './pan-zoom.service';
import { Joint } from '../model/joint';
import { UndoRedoService } from './undo-redo.service';

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
 * during encoding, along with other compression steps
 */
export class DecoderService {
  constructor(private panZoomService: PanZoomService) {}

  /**
   * Decodes an encoded URL string, reconstructs the mechanism data, and passes
   * it to the state service for rebuilding the mechanism.
   *
   * @param encoded The URL-encoded string from the EncoderService.
   *
   * @param stateService
   * @param panZoomService
   * @param undoRedoService
   */
  static decodeFromURL(
    encoded: string,
    stateService: StateService,
    panZoomService: PanZoomService,
    undoRedoService: UndoRedoService
  ) {


    try {
      const decodedJson = LZString.decompressFromEncodedURIComponent(encoded);
      console.log(decodedJson);
      let decompressedJSON = decodedJson
        .replaceAll('--', '"]_["')
        .replaceAll('RP', 'Reference Point')
        .replaceAll('_', ',')
        .replaceAll('~', '","');
      console.log(decompressedJSON);


      const compactData = JSON.parse(decompressedJSON, (key, value) => {
        if (typeof value === 'string') {
          if (/^[0-9a-f]+$/i.test(value)) {
            return parseInt(value, 16);
          }
          if (value === 'y') return true;
          if (value === 'n') return false;
          }
        return value;
        });

      // Expand the compact data into full objects.
      console.log(compactData);
      const fullData = this.expandMechanismData(compactData);

      if (compactData.z && compactData.z[0][0]) {
        const zoom = parseFloat(compactData.z[0][0]);
        if (!isNaN(zoom)) {
          panZoomService.setZoom(zoom);
        }
      }

      if (compactData.z && compactData.z[0][1] && compactData.z[0][2]) {
        const panX = parseFloat(compactData.z[0][1]);
        const panY = parseFloat(compactData.z[0][2]);
        if (!isNaN(panX) && !isNaN(panY)) {
          panZoomService.setPan(panX, panY);
        }
      }
      if (compactData.fb && compactData.fb[0][0] && compactData.fb[0][1]) {
        stateService.sixBarGenerated = compactData.fb[0][0] !== 'n';
        stateService.fourBarGenerated = compactData.fb[0][1] !== 'n';
      }

      // Pass the reconstructed mechanism data to the state service.
      stateService.reconstructMechanism(fullData);

      if (compactData.u) {
        undoRedoService.clearStacks();
        undoRedoService.restoreStacks(compactData.u, compactData.r);
      }

    } catch (error) {
      console.error('Error decoding mechanism data:', error);
    }


  }

  /**
   * Decodes data in a csv file, reconstructs the mechanism data, and passes
   * it to the state service for rebuilding the mechanism.
   *
   * @param csvContent
   * @param stateService
   */
  static decodeFromCSV(
    csvContent: string,
    stateService: StateService,
    panZoomService: PanZoomService
  ): void {
    try {
      // Step 1: Parse lines into a 'compactData' structure
      const compactData: { [section: string]: any[][] } = {};
      const lines = csvContent.split(/\r?\n/);
      let currentSection: string | null = null;
      let skipNextLine = false; // Add this flag

      for (const rawLine of lines) {
        const line = rawLine.trim();

        // Skip this line if flagged
        if (skipNextLine) {
          skipNextLine = false;
          continue;
        }

        // Detect section headers like --- j ---
        if (line.startsWith('---') && line.endsWith('---')) {
          currentSection = line.slice(3, -3).trim();
          compactData[currentSection] = [];
          skipNextLine = true; // Flag to skip the next line
          continue;
        }

        // Skip if no section yet or blank line
        if (!currentSection || !line) {
          continue;
        }

        // Split by commas; no quotes unescaping if not needed
        const fields = line.split(',');
        compactData[currentSection].push(fields);
      }

      //Expand the compact data into a fully built object
      const fullData = this.expandMechanismData(compactData, false);
      if (compactData['z'][0][0]) {
        const zoom = parseFloat(compactData['z'][0][0]);
        if (!isNaN(zoom)) {
          panZoomService.setZoom(zoom);
        }
      }

      if (compactData['z'][0][1] && compactData['z'][0][2]) {
        const panX = parseFloat(compactData['z'][0][1]);
        const panY = parseFloat(compactData['z'][0][2]);
        if (!isNaN(panX) && !isNaN(panY)) {
          panZoomService.setPan(panX, panY);
        }
      }
      if (compactData['fb'][0][0] && compactData['fb'][0][1]) {
        stateService.sixBarGenerated = compactData['fb'][0][0] === 'true';
        stateService.fourBarGenerated = compactData['fb'][0][1] === 'true';
      }
      // Step 3: Pass to the state service, same as decodeFromURL
      // (Replace reconstructFromUrl with whatever your real method is)
      stateService.reconstructMechanism(fullData);
    } catch (error) {
      console.error('Error decoding mechanism CSV:', error);
    }
  }

  /**
   * Expands the compact mechanism data back into full objects.
   * Converts hex strings to numbers and "1"/"0" strings to booleans.
   */
  private static expandMechanismData(
    compactData: any,
    useDecoding: boolean = true
  ): any {
    const decodedJoints: Joint[] = (compactData.j || []).map((row: any[]) => ({
      id: this.convertNumber(row[0], useDecoding),
      name: row[1],
      x: Number(row[2]),
      y: Number(row[3]),
      type: this.convertNumber(row[4], useDecoding),
      angle: this.convertNumber(row[5], useDecoding),
      isGrounded: this.convertBoolean(row[6]),
      isInput: this.convertBoolean(row[7]),
      inputSpeed: this.convertNumber(row[8], useDecoding),
      isWelded: this.convertBoolean(row[9]),
      locked: this.convertBoolean(row[10]),
      isHidden: this.convertBoolean(row[11]),
      isReference: this.convertBoolean(row[12]),
      isGenerated: this.convertBoolean(row[13]),
    }));

    const decodedLinks: any[] = (compactData.l || []).map((row: any[]) => ({
      id: this.convertNumber(row[0], useDecoding),
      name: row[1],
      mass: this.convertNumber(row[2], useDecoding),
      color: row[3],
      x: this.convertNumber(row[4], useDecoding),
      y: this.convertNumber(row[5], useDecoding),
      joints: row[6] as string,
      forces: row[7] as string,
      locked: this.convertBoolean(row[8]),
      length: this.convertNumber(row[9], useDecoding),
      angle: this.convertNumber(row[10], useDecoding),
    }));

    const decodedCompoundLinks: any[] = (compactData.c || []).map(
      (row: any[]) => ({
        id: this.convertNumber(row[0], useDecoding),
        name: row[1],
        mass: this.convertNumber(row[2], useDecoding),
        x: this.convertNumber(row[3], useDecoding),
        y: this.convertNumber(row[4], useDecoding),
        links: row[5],
        lock: this.convertBoolean(row[6]),
      })
    );

    const decodedTrajectories: any[] = (compactData.t || []).map(
      (row: any[]) => ({
        id: this.convertNumber(row[0], useDecoding),
        x: this.convertNumber(row[1], useDecoding),
        y: this.convertNumber(row[2], useDecoding),
      })
    );

    const decodedForces: any[] = (compactData.f || []).map((row: any[]) => ({
      id: this.convertNumber(row[0], useDecoding),
      name: row[1],
      startx: this.convertNumber(row[2], useDecoding),
      starty: this.convertNumber(row[3], useDecoding),
      endx: this.convertNumber(row[4], useDecoding),
      endy: this.convertNumber(row[5], useDecoding),
      magnitude: this.convertNumber(row[6], useDecoding),
      angle: this.convertNumber(row[7], useDecoding),
      frameOfReference: this.convertNumber(row[8], useDecoding),
    }));

    const decodedPositions: any[] = (compactData.p || []).map((row: any[]) => ({
      id: this.convertNumber(row[0], useDecoding),
      name: row[1],
      mass: this.convertNumber(row[2], useDecoding),
      color: row[3],
      x: this.convertNumber(row[4], useDecoding),
      y: this.convertNumber(row[5], useDecoding),
      joints: row[6] ? row[6].split('|') : [],
      forces: row[7] ? row[7].split('|') : [],
      locked: this.convertBoolean(row[8]),
      refPoint: row[9],
      length: this.convertNumber(row[10], useDecoding),
      angle: this.convertNumber(row[11], useDecoding),
    }));

    return {
      decodedJoints,
      decodedLinks,
      decodedCompoundLinks,
      decodedTrajectories,
      decodedForces,
      decodedPositions,
    };
  }

  /**
   * Converts a hex string to a number.
   * If the value is not a string, it falls back to a number conversion.
   */
  private static convertNumber(
    value: any,
    useDecoding: boolean = true
  ): number {
    return useDecoding ? parseInt(value, 16) : value;
  }

  /**
   * Converts a string "1" or "0" to a boolean.
   */
  private static convertBoolean(value: any): boolean {
    if (typeof value === 'string') {
      return value === 'y' || value === 'true';
    }
    return Boolean(value);
  }
}
