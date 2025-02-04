import { Mechanism } from "./mechanism";
import { Joint } from "./joint";
import { Link } from "./link";
import { Coord } from "./coord";
import { CompoundLink } from "./compound-link";
import { Trajectory } from "./trajectory";
import { Force } from "./force";
import { Position } from "./position";
import { Utils } from "./utils";

export class Decoder {
  static decode(encodedData: string): Mechanism | null {
    try {
      const decodedJson = atob(encodedData);
      const mechanismData = JSON.parse(decodedJson);

      return this.reconstructMechanism(mechanismData);
    } catch (error) {
      console.error("Error decoding mechanism data:", error);
      return null;
    }
  }

  private static reconstructMechanism(data: any): Mechanism {
    const mechanism = new Mechanism();

    mechanism.joints = data.joints.map((j: any) =>
      new Joint(j.id, new Coord(j.coord.x, j.coord.y), j.type)
    );

    mechanism.links = data.links.map((l: any) =>
      new Link(l.id, l.jointIds, l.isGrounded)
    );

    mechanism.compoundLinks = data.compoundLinks.map((cl: any) =>
      new CompoundLink(cl.id, cl.linkIds)
    );

    mechanism.trajectories = data.trajectories.map((t: any) =>
      new Trajectory(t.id, t.points.map((p: any) => new Coord(p.x, p.y)))
    );

    mechanism.forces = data.forces.map((f: any) =>
      new Force(f.id, new Coord(f.coord.x, f.coord.y), f.magnitude, f.angle)
    );

    mechanism.positions = data.positions.map((p: any) =>
      new Position(p.id, new Coord(p.coord.x, p.coord.y))
    );

    return mechanism;
  }
}
