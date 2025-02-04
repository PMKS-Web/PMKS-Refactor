import { Mechanism } from '../model/mechanism';
import { Joint } from "../model/joint";
import { Link } from "../model/link";
import { Coord } from "../model/coord";
import { CompoundLink } from "../model/compound-link";
import { Trajectory } from "../model/trajectory";
import { Force } from "../model/force";
import { Position } from "../model/position";
import { Utils } from "../model/utils";

export class Encoder {
  static encode(mechanism: Mechanism): string {
    try {
      const mechanismData = this.extractMechanismData(mechanism);
      const jsonData = JSON.stringify(mechanismData);
      return btoa(jsonData);
    } catch (error) {
      console.error("Error encoding mechanism data:", error);
      return "";
    }
  }

  static LegacytoCSV(mechanism: Mechanism): string {
    const mechanismData = this.extractMechanismData(mechanism);
    let csv = "Type,ID,Data\n";

    mechanismData.joints.forEach((j: any) => {
      csv += `Joint,${j.id},${j.name},${j.coords.x},${j.coords.y},${j.type},${j.angle},${j.isGrounded},${j.isInput},${j.inputSpeed},${j.isWelded},${j.locked},${j.isHidden},${j.isReference},\n`;
    });

    mechanismData.links.forEach((l: any) => {
      csv += `Link,${l.id},${l.jointIds.join(";")},${l.isGrounded}\n`;
    });

    mechanismData.compoundLinks.forEach((cl: any) => {
      csv += `CompoundLink,${cl.id},${cl.linkIds.join(";")}\n`;
    });

    mechanismData.trajectories.forEach((t: any) => {
      csv += `Trajectory,${t.id},${t.points.map((p: any) => `${p.x}:${p.y}`).join(";")}\n`;
    });

    mechanismData.forces.forEach((f: any) => {
      csv += `Force,${f.id},${f.coord.x},${f.coord.y},${f.magnitude},${f.angle}\n`;
    });

    mechanismData.positions.forEach((p: any) => {
      csv += `Position,${p.id},${p.coord.x},${p.coord.y}\n`;
    });

    return csv;
  }

  /**
   * Exports the entire mechanism data (joints, links, compoundLinks, trajectories,
   * forces, positions) into one CSV string. Each section is marked by a header (e.g. "--- joints ---")
   * so that it can be later split and reloaded if needed.
   */
  public static exportMechanismDataToCSV(mechanism: Mechanism): string {
    const data = this.extractMechanismData(mechanism);
    let csvOutput = '';

    // Loop through each property in the extracted data (e.g. joints, links, etc.)
    for (const section in data) {
      if (data.hasOwnProperty(section)) {
        csvOutput += `--- ${section} ---\n`;
        csvOutput += this.arrayToCSV(data[section]) + '\n\n';
      }
    }
    return csvOutput;
  }

  /**
   * Converts an array of objects to CSV format.
   * It first finds all keys (columns) used in the array, then writes a header row,
   * followed by a row for each object. Any nested objects/arrays are stringified.
   */
  private static arrayToCSV(dataArray: any[]): string {
    if (!dataArray || dataArray.length === 0) return '';

    // Get the union of all keys used in the array.
    const headers = Array.from(
      dataArray.reduce((set, obj) => {
        Object.keys(obj).forEach(key => set.add(key));
        return set;
      }, new Set<string>())
    );

    // Start with the header row.
    let csv = headers.join(',') + '\n';

    // Process each object in the array.
    dataArray.forEach(item => {
      const row = headers.map(key => {
        let value = item[key];
        // For nested objects or arrays, use JSON.stringify.
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        return this.csvEscape(value);
      });
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Escapes a field for CSV output. If the field contains a comma, newline, or quotes,
   * the field is wrapped in quotes and inner quotes are doubled.
   */
  private static csvEscape(value: any): string {
    if (value === null || value === undefined) return '';
    const str = value.toString();
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private static extractMechanismData(mechanism: Mechanism): any {
    return { //multiple Array objects together
      joints: mechanism.getArrayOfJoints().map((j: Joint) => ({
        id: j.id,
        name: j.name,
        coords: { x: j.coords.x, y: j.coords.y },
        type: j.type,
        angle: j.angle,
        isGrounded: j.isGrounded,
        isInput: j.inputSpeed,
        inputSpeed: j.inputSpeed,
        isWelded: j.isWelded,
        locked: j.locked,
        isHidden: j.isHidden,
        isReference: j.isReference
      })),

      links: mechanism.getArrayOfLinks().map((l: Link) => ({
        id: l.id,
        name: l.name,
        mass: l.mass,
        color: l.color,
        centerOfMass: l.centerOfMass,
        joints: Array.from(l.joints.values()).map((j: Joint)=> j.id ), //l.joints, //todo CANNOT STORE JOINTS LIKE THIS, GET ID
        forces: l.forces, //todo same with above
        locked: l.locked,
        length: l.length,
        angle: l.angle
      })),

      compoundLinks: mechanism.getArrayOfCompoundLinks().map((cl: CompoundLink) => ({
        id: cl.id,
        name: cl.name,
        mass: cl.mass,
        centerOfMass: cl.centerOfMass,
        links: cl.links, //todo for IDs
        lock: cl.lock
      })),

      trajectories: mechanism.getArrayOfTrajectories().map((t: Trajectory) => ({
        /*
        TODO fill in with trajectory data
        id: t.id,
        points: t.getArrayOfPoints.map((p: Coord) => ({ x: p.x, y: p.y }))
      */
      })),


      forces: mechanism.getArrayOfForces().map((f: Force) => ({
        id: f.id,
        name: f.name,
        start: { x: f.start.x, y: f.start.y },
        end: { x: f.end.x, y: f.end.y },
        magnitude: f.magnitude,
        angle: f.angle,
        frameOfReference: f.frameOfReference,
      })),

      positions: mechanism.getArrayOfPositions().map((p: Position) => ({
        id: p.id,
        name: p.name,
        mass: p.mass,
        color: p.color,
        centerOfMass: { x: p.centerOfMass.x, y: p.centerOfMass.y },
        joints: p.joints, //todo IDS
        forces: p.forces, //todo ids
        locked: p.locked,
        refPoint: p.refPoint,
        length: p.length,
        angle: p.angle
      }))
    };
  }
}
