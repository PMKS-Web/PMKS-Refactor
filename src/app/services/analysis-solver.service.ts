import { Injectable } from '@angular/core';
import { Coord } from '../model/coord';
import { PositionSolverService, SolveOrder, SolvePrerequisite, SolveType } from './kinematic-solver.service';
import { AnimationPositions } from './kinematic-solver.service';
import { StateService } from './state.service';
import { create, all, MathJsInstance } from 'mathjs';
const math: MathJsInstance = create(all, {});
import { RigidBody } from '../model/link';
import { Link } from '../model/link';
import { CompoundLink } from '../model/compound-link';

export interface JointAnalysis {
  timeIncrement: number,
  positions: Coord[],
  velocities: Coord[],
  accelerations: Coord[],
}

export interface LinkAnalysis {
  timeIncrement: number,
  COMpositions: Coord[],
  COMvelocities: Coord[],
  COMaccelerations: Coord[],
  angle: number[],
  angularVelocity: number[],
  angularAcceleration: number[],
}

// ─── Graph types for the generalized loop solver ──────────────────────────────

/** One joint (node) in the mechanism graph. */
export interface LinkGraphNode {
  id:         number;
  isGrounded: boolean;  // joint.isGrounded from the model
  isInput:    boolean;  // joint.isInput — true only for the grounded motor pivot
}

/**
 * One link (undirected edge) connecting joints idA and idB.
 * The canonical traversal direction is idA → idB.
 * aGrounded / bGrounded / aIsInput / bIsInput mirror the corresponding
 * node flags and are stored here so the loop solver never has to look
 * them up again.
 */
export interface LinkGraphEdge {
  idA:       number;
  idB:       number;
  aGrounded: boolean;
  bGrounded: boolean;
  aIsInput:  boolean;
  bIsInput:  boolean;
}

/**
 * Undirected adjacency graph for one submechanism.
 *
 * NOTE: this graph contains only the links that are explicit in the
 * SolveOrder prerequisites (crank, couplers, followers).
 * Ground-to-ground closing edges and prismatic-closing edges are
 * NOT added here — that is Step 2 (spanning tree + loop detection).
 */
export interface LinkGraph {
  /** Joint-id → node metadata. */
  nodes: Map<number, LinkGraphNode>;
  /** All edges derived from the solve prerequisites. */
  edges: LinkGraphEdge[];
  /**
   * Undirected adjacency list.
   * adj.get(id) is a list of { neighbor, edgeIndex } entries so the
   * DFS in Step 2 can traverse edges in O(1) and look up edge metadata
   * by index.
   */
  adj: Map<number, Array<{ neighbor: number; edgeIndex: number }>>;
}

/**
 * One directed step within a velocity loop.
 *
 * idA / idB are the canonical endpoints of the underlying physical link
 * exactly as stored in the augmented edge list (graph edges + ground-chain
 * closing edges).  The direction flag records which way the loop walks
 * across that link:
 *
 *   direction = +1  →  step traverses the link idA → idB (canonical)
 *   direction = −1  →  step traverses the link idB → idA (reversed)
 *
 * Sign convention for matrix assembly (Step 4):
 *   revolute link:  X += direction * (−r sinθ) * ω
 *                   Y += direction * ( r cosθ) * ω
 *   prismatic link: X += direction * cosθ_slide * ṡ
 *                   Y += direction * sinθ_slide * ṡ
 * where θ is always atan2(idB.pos − idA.pos) regardless of direction.
 */
export interface LoopEdge {
  idA:       number;
  idB:       number;
  direction: 1 | -1;
}


@Injectable({
  providedIn: 'root'
})
export class AnalysisSolveService {
    private solveOrders: SolveOrder[] = [];
    private jointPositions: AnimationPositions[] = [];
    private jointKinematics: Map<number, JointAnalysis> = new Map();

    // Cache of link angular velocities keyed by sorted joint-ID pair, e.g. "2_5".
    // Populated by computeVelocityLoopOmegas() after each submechanism is solved.
    private linkAngularVelocityCache: Map<string, number[]> = new Map();
    // Cache of link angular accelerations keyed by sorted joint-ID pair.
    private linkAngularAccelerationCache: Map<string, number[]> = new Map();

    // Most-recently solved SolveOrder, retained so exportLinkKinematicsCSV() can be
    // called on demand without needing a parameter.
    private lastSolveOrder: SolveOrder | null = null;

    // save the COM of every link in the sub-mechanism 
    private comPositions: Map<number, Coord>[][] = []; // Added by MQP 25-26
    
    constructor(
        private positionSolver: PositionSolverService, 
        private stateService: StateService
    ) {}

    // Updates kinematic data by fetching solve orders and joint positions, then solving submechanism kinematics.
    updateKinematics() {
        /**Order of operations
         * 1. First we need the Solve Orders and Positions of the joints from position solver
         * 2. For solving links we need to associate model links with the joints being solved for, we can do so by using the
         * 3. Iterate over each position, solving for the needed information for both links and joints.
         * 4. Update the Information
         */
        this.solveOrders = this.positionSolver.getSolveOrders(); // use solveOrders.length is one of many ways to show how many sub-mechanisms you have on screen
        console.log("solve order: ", this.solveOrders);
        this.jointPositions = this.positionSolver.getAnimationFrames();
        this.jointKinematics = new Map();

        const subMechanisms = this.stateService.getMechanism().getSubMechanisms();

        for (let i = 0; i < this.solveOrders.length; i++) { 
            this.solveSubmechanimsKinematics(this.solveOrders[i], this.jointPositions[i]);

            // After joint kinematics are solved, compute COM positions for this sub-mechanism 
            if (i < subMechanisms.length) {
                const uniqueRigidBodies = this.getUniqueRigidBodies(subMechanisms[i]);
                this.solveCOMPositions(i, uniqueRigidBodies, this.jointPositions[i]);
            }
        }
    }

  // Solves kinematics for a specific submechanism given its solve order and joint positions.
  solveSubmechanimsKinematics(solveOrder: SolveOrder, jointPositions: AnimationPositions) {
    /**we are given the animation positions and solve order for a submechanism
     * 1. iterate over each set of positions to solve
     * 2. call a function that returns all relevant calculations
     * 3. update jointKinematics
     * 4. calls velocity loop solver to compute link angular velocities and accelerations for the submechanism
     */
    let mechanismVelocities: Coord[][] = [];
    let mechanismAccelerations: Coord[][] = [];
    for (let time = 0; time < jointPositions.positions.length; time++) {
      let solutions = this.solveJointKinematics(solveOrder, jointPositions.positions[time]);
      mechanismVelocities.push(solutions.velocities);
      mechanismAccelerations.push(solutions.accelerations);
    }
    const arrayColumn = (array: Coord[][], columnIndex: number) => array.map(row => row[columnIndex])
    this.jointKinematics = new Map();
    let inputspeed: number = solveOrder.prerequisites.get(solveOrder.order[0])!.jointToSolve.inputSpeed;
    let timeIncrement: number = 60 / (inputspeed * 360);
    for (let i = 0; i < solveOrder.order.length; i++) {
      let accelerations = arrayColumn(mechanismAccelerations, i);
      let velocities = arrayColumn(mechanismVelocities, i);
      let positions = arrayColumn(jointPositions.positions, i);
      let joint: JointAnalysis = { timeIncrement: timeIncrement, positions: positions, velocities: velocities, accelerations: accelerations }
      this.jointKinematics.set(solveOrder.order[i], joint);
    }

    // compute link angular velocities using velocity-loop matrix method
    this.computeVelocityLoopOmegas(solveOrder);
    this.lastSolveOrder = solveOrder;
  }

  // Computes velocities and accelerations for all joints in a solve order at a single time step.
  solveJointKinematics(solveOrder: SolveOrder, positions: Coord[]): { velocities: Coord[], accelerations: Coord[] } {
    let velocities: Coord[] = [];
    let accelerations: Coord[] = [];

    for (let index = 0; index < solveOrder.order.length; index++) {
      let id = solveOrder.order[index];
      let prereq = solveOrder.prerequisites.get(id)!;
      let velocity_acceleration: { velocity: Coord, acceleration: Coord };
      switch (prereq.solveType) {
        case SolveType.Ground:
          velocities.push(new Coord(0, 0));
          accelerations.push(new Coord(0, 0));
          break;
        case SolveType.RevoluteInput:
          velocity_acceleration = this.solveRevInputJointKinematics(index, prereq, positions);
          velocities.push(velocity_acceleration.velocity);
          accelerations.push(velocity_acceleration.acceleration);
          break;
        case SolveType.PrismaticInput:
          velocity_acceleration = this.solvePrisInputJointKinematics(prereq);
          velocities.push(velocity_acceleration.velocity);
          accelerations.push(velocity_acceleration.acceleration);
          break;
        case SolveType.CircleCircle: {
          const knownIndex1 = solveOrder.order.indexOf(prereq.knownJointOne!.id);
          const knownIndex2 = solveOrder.order.indexOf(prereq.knownJointTwo!.id);
          velocity_acceleration = this.solveCircleCirlceJointKinematics(index, knownIndex1, knownIndex2, positions, velocities, accelerations);
          velocities.push(velocity_acceleration.velocity);
          accelerations.push(velocity_acceleration.acceleration);
          break;
        }

        case SolveType.CircleLine: {
          const knownIndex1 = solveOrder.order.indexOf(prereq.knownJointOne!.id);
          velocity_acceleration = this.solveCircleLineJointKinematics(index, knownIndex1, prereq, positions, velocities, accelerations)
          velocities.push(velocity_acceleration.velocity);
          accelerations.push(velocity_acceleration.acceleration);
          break;
        }
      }
    }
    return { velocities: velocities, accelerations: accelerations };
  }

  //need to account for switching directions
  /**
   * Solves for the velocity and acceleration of a joint connected to a grounded revolute input
   * @param jointIndex - an index for the joint to be solved within with positions array.
   * @param prereq - a SolvePrerequisite that corresponds to that joint.
   * @param positions - an array of joint positions for a particular timestep.
   * @returns
   */
  solveRevInputJointKinematics(jointIndex: number, prereq: SolvePrerequisite, positions: Coord[]): { velocity: Coord, acceleration: Coord } {

    const xDifference = positions[jointIndex].x - positions[0].x;
    const yDifference = positions[jointIndex].y - positions[0].y;
    const angleToInput: number = Math.atan2(yDifference, xDifference);
    const omega: number = 2 * Math.PI * (prereq.knownJointOne!.inputSpeed / 60); //Angular Velocity of Link in Radians
    const r: number = prereq.distFromKnownJointOne!;

    //velocity
    const velocityMagnitude = r * omega; //Velocity magnitude
    const velocityTheta = omega > 0 ? angleToInput + Math.PI / 2 : angleToInput - Math.PI / 2;
    const xVelocity: number = Math.cos(velocityTheta) * velocityMagnitude;
    const yVelocity: number = Math.sin(velocityTheta) * velocityMagnitude;
    const jointVelocity: Coord = new Coord(xVelocity, yVelocity);
    //acceleration
    const xAcceleration: number = -Math.cos(angleToInput) * velocityMagnitude * omega;
    const yAcceleration: number = -Math.sin(angleToInput) * velocityMagnitude * omega;
    const jointAcceleration: Coord = new Coord(xAcceleration, yAcceleration);
    return { velocity: jointVelocity, acceleration: jointAcceleration };
  }

  // Calculates velocity and acceleration for a prismatic input joint from its prerequisites.
  solvePrisInputJointKinematics(prereq: SolvePrerequisite): { velocity: Coord, acceleration: Coord } {
    const velocityMag = prereq.jointToSolve.inputSpeed * (0.05 * 6) //Kinematic solver generates frames for 0.05m increments, and animator uses Rev-Input timeInterval calculation
    const velocityTheta = prereq.jointToSolve.angle;
    const deltaX: number = Math.cos(velocityTheta) * velocityMag;
    const deltaY: number = Math.sin(velocityTheta) * velocityMag;
    const jointVelocity: Coord = new Coord(deltaX, deltaY);
    const jointAcceleration: Coord = new Coord(0, 0);
    return { velocity: jointVelocity, acceleration: jointAcceleration };
  }

  // Determines velocity and acceleration for a joint constrained by two circular motions using known indices, positions, velocities, and accelerations.
  solveCircleCirlceJointKinematics(jointIndex: number, known1Index: number, known2Index: number, positions: Coord[], velocities: Coord[], accelerations: Coord[]): { velocity: Coord, acceleration: Coord } {
    //velocity
    const v_k1: Coord = velocities[known1Index];
    const v_k2: Coord = velocities[known2Index];
    const pos_j: Coord = positions[jointIndex];
    const diff_jk1: Coord = new Coord(pos_j.x - positions[known1Index].x, pos_j.y - positions[known1Index].y);
    const diff_jk2: Coord = new Coord(pos_j.x - positions[known2Index].x, pos_j.y - positions[known2Index].y);
    const perp_angle_jk1: number = Math.atan2(diff_jk1.y, diff_jk1.x) + Math.PI / 2;
    const perp_angle_jk2: number = Math.atan2(diff_jk2.y, diff_jk2.x) + Math.PI / 2;
    const jointVelocity: Coord = this.parametricLineIntersection(v_k1, perp_angle_jk1, v_k2, perp_angle_jk2);
    //acceleration of k1 + (V_k1j^2 / (k1-j)) for centripetal,
    const x_centripetal_accel_jk1: number = accelerations[known1Index].x + Math.pow(jointVelocity.x, 2) / (-diff_jk1.x);
    const y_centripetal_accel_jk1: number = accelerations[known1Index].y + Math.pow(jointVelocity.y, 2) / (-diff_jk1.y);
    const x_centripetal_accel_jk2: number = accelerations[known2Index].x + Math.pow(jointVelocity.x, 2) / (-diff_jk2.x);
    const y_centripetal_accel_jk2: number = accelerations[known2Index].y + Math.pow(jointVelocity.y, 2) / (-diff_jk2.y);
    const centripetal_accel_jk1: Coord = new Coord(x_centripetal_accel_jk1, y_centripetal_accel_jk1);
    const centripetal_accel_jk2: Coord = new Coord(x_centripetal_accel_jk2, y_centripetal_accel_jk2);
    const jointAcceleration: Coord = this.parametricLineIntersection(centripetal_accel_jk1, perp_angle_jk1, centripetal_accel_jk2, perp_angle_jk2);
    return { velocity: jointVelocity, acceleration: jointAcceleration };
  }

  // Determines velocity and acceleration for a joint constrained by a circle and a line using known index, prerequisites, positions, velocities, and accelerations.
  solveCircleLineJointKinematics(jointIndex: number, known1Index: number, prereq: SolvePrerequisite, positions: Coord[], velocities: Coord[], accelerations: Coord[]): { velocity: Coord, acceleration: Coord } {
    //velocity
    const v_k1: Coord = velocities[known1Index];
    const diff_jk1: Coord = new Coord(positions[jointIndex].x - positions[known1Index].x, positions[jointIndex].y - positions[known1Index].y);
    const perp_angle_jk1: number = Math.atan2(diff_jk1.y, diff_jk1.x) + Math.PI / 2;
    const jointVelocity: Coord = this.parametricLineIntersection(v_k1, perp_angle_jk1, new Coord(0, 0), prereq.jointToSolve.angle);
    //acceleration
    const x_centripetal_accel_jk1: number = accelerations[known1Index].x + Math.pow(jointVelocity.x, 2) / (-diff_jk1.x);
    const y_centripetal_accel_jk1: number = accelerations[known1Index].y + Math.pow(jointVelocity.y, 2) / (-diff_jk1.y);
    const centripetal_accel_jk1: Coord = new Coord(x_centripetal_accel_jk1, y_centripetal_accel_jk1);
    const jointAcceleration: Coord = this.parametricLineIntersection(centripetal_accel_jk1, perp_angle_jk1, new Coord(0, 0), prereq.jointToSolve.angle);
    return { velocity: jointVelocity, acceleration: jointAcceleration };
  }
  // Finds the intersection point of two parametric lines defined by starting coordinates and angles.
  parametricLineIntersection(pos1: Coord, theta1: number, pos2: Coord, theta2: number): Coord {
    const t_2 = ((pos1.y - pos2.y) + ((pos2.x - pos1.x) / Math.cos(theta1))) / ((Math.sin(theta2)) - (Math.cos(theta2) / Math.cos(theta1)));
    const x_intersection = pos2.x + (t_2 * Math.cos(theta2));
    const y_intersection = pos2.y + (t_2 * Math.sin(theta2));
    return new Coord(x_intersection, y_intersection);
  }

  // Retrieves stored kinematic analysis (positions, velocities, accelerations) for a specific joint ID.
  getJointKinematics(jointID: number): JointAnalysis {
    return this.jointKinematics.get(jointID)!;
  }

  // Converts joint kinematic data into arrays suitable for plotting, based on requested data type (position, velocity, or acceleration).
  transformJointKinematicGraph(jointAnalysis: JointAnalysis, dataOf: string): { xData: any[], yData: any[], timeLabels: string[] } {
    const xData: any[] = [];
    const yData: any[] = [];
    const timeLabels: string[] = [];

    switch (dataOf) {
      case ("Position"):
        xData.push({ data: jointAnalysis.positions.map(coord => coord.x), label: "X data of Position" });
        yData.push({ data: jointAnalysis.positions.map(coord => coord.y), label: "Y data of Position" });
        timeLabels.push(...jointAnalysis.positions.map((_, index) => String(index)));

        return { xData, yData, timeLabels };

      case ("Velocity"):
        xData.push({ data: jointAnalysis.velocities.map(coord => coord.x), label: "X data of Velocity" });
        yData.push({ data: jointAnalysis.velocities.map(coord => coord.y), label: "Y data of Velocity" });
        timeLabels.push(...jointAnalysis.velocities.map((_, index) => String(index)));

        return { xData, yData, timeLabels };

      case ("Acceleration"):
        xData.push({ data: jointAnalysis.accelerations.map(coord => coord.x), label: "X data of Acceleration" });
        yData.push({ data: jointAnalysis.accelerations.map(coord => coord.y), label: "Y data of Acceleration" });
        timeLabels.push(...jointAnalysis.accelerations.map((_, index) => String(index)));

        return { xData, yData, timeLabels };

      default:
        console.error("Invalid Graph type detected! Returning default values.")
        return { xData, yData, timeLabels };
    }

  }

  // Converts link kinematic data into arrays suitable for plotting, based on requested data type (angle, velocity, or acceleration).
  transformLinkKinematicGraph(linkAnalysis: LinkAnalysis, dataOf: string): { xData: any[], yData: any[], timeLabels: string[] } {
    const xData: any[] = [];
    const yData: any[] = [];
    const timeLabels: string[] = [];

    switch (dataOf) {
      case ("Angle"):
        xData.push({ data: linkAnalysis.angle, label: "Angle of Reference Joint" });
        timeLabels.push(...linkAnalysis.angle.map((_, index) => String(index)));

        return { xData, yData, timeLabels };

      case ("Velocity"):
        xData.push({ data: linkAnalysis.angularVelocity, label: "Angular Velocity" });
        timeLabels.push(...linkAnalysis.angularVelocity.map((_, index) => String(index)));

        return { xData, yData, timeLabels };

      case ("Acceleration"):
        xData.push({ data: linkAnalysis.angularAcceleration, label: "Angular Acceleration" });
        timeLabels.push(...linkAnalysis.angularAcceleration.map((_, index) => String(index)));

        return { xData, yData, timeLabels };

      default:
        console.error("Invalid Graph type detected! Returning default values.")
        return { xData, yData, timeLabels };
    }

  }

  // Computes center-of-mass and angular kinematics for a link given its associated joint IDs.
  getLinkKinematics(jointIDs: number[]): LinkAnalysis {
    let subJoints: JointAnalysis[] = [];
    for (let id of jointIDs) {
      subJoints.push(this.jointKinematics.get(id)!);
    }
    let com_solutions: { pos: Coord[], vel: Coord[], acc: Coord[] } = this.getLinkCOMSolutions(subJoints);
    let angle_solutions: { ang: number[], vel: number[], acc: number[] } = this.getLinkAngularSolutions(subJoints, jointIDs);
    return {
      timeIncrement: subJoints[0].timeIncrement,
      COMpositions: com_solutions.pos,
      COMvelocities: com_solutions.vel,
      COMaccelerations: com_solutions.acc,
      angle: angle_solutions.ang,
      angularVelocity: angle_solutions.vel,
      angularAcceleration: angle_solutions.acc,
    } as LinkAnalysis

  }

  // Calculates center-of-mass positions, velocities, and accelerations from joint-level kinematic data for a link.
  getLinkCOMSolutions(subJoints: JointAnalysis[]) {
    let com_positions: Coord[] = [];
    let com_velocities: Coord[] = [];
    let com_accelerations: Coord[] = [];
    for (let time = 0; time < subJoints[0].positions.length; time++) {
      let x_pos: number = 0;
      let y_pos: number = 0;
      let x_vel: number = 0;
      let y_vel: number = 0;
      let x_acc: number = 0;
      let y_acc: number = 0;
      let denominator: number = subJoints.length;
      for (let joint of subJoints) {
        x_pos += joint.positions[time].x;
        y_pos += joint.positions[time].y;
        x_vel += joint.velocities[time].x;
        y_vel += joint.velocities[time].y;
        x_acc += joint.accelerations[time].x;
        y_acc += joint.accelerations[time].y;
      }
      com_positions.push(new Coord(x_pos / denominator, y_pos / denominator));
      com_velocities.push(new Coord(x_vel / denominator, y_vel / denominator));
      com_accelerations.push(new Coord(x_acc / denominator, y_acc / denominator))
    }
    return { pos: com_positions, vel: com_velocities, acc: com_accelerations }
  }

  /**
   * Calculates angular position, velocity, and acceleration for a link.
   *
   * Angle:    theta = atan2(yB - yA, xB - xA) using the first two joints at each timestep.
   * Velocity: omega from the pre-computed velocity-loop cache (see computeVelocityLoopOmegas).
   * Acceleration: prefers loop-solved alpha, otherwise 0.
   *
   * @param subJoints - JointAnalysis objects for the joints on this link (at least 2).
   * @param jointIDs  - Corresponding joint IDs, used to look up the velocity-loop cache.
   */
  getLinkAngularSolutions(subJoints: JointAnalysis[], jointIDs?: number[]): { ang: number[], vel: number[], acc: number[] } {
    const numSteps = subJoints[0].positions.length;

    if (subJoints.length < 2) {
      return {
        ang: new Array(numSteps).fill(0),
        vel: new Array(numSteps).fill(0),
        acc: new Array(numSteps).fill(0),
      };
    }

    const j0 = subJoints[0];
    const j1 = subJoints[1];

    // Step 1: link orientation angle theta = atan2(yB - yA, xB - xA)
    const ang: number[] = [];
    for (let t = 0; t < numSteps; t++) {
      ang.push(Math.atan2(
        j1.positions[t].y - j0.positions[t].y,
        j1.positions[t].x - j0.positions[t].x,
      ));
    }

    if (!jointIDs || jointIDs.length < 2) {
      return {
        ang,
        vel: new Array(numSteps).fill(0),
        acc: new Array(numSteps).fill(0),
      };
    }

    const key = this.linkKey(jointIDs[0], jointIDs[1]);

    const cachedOmega = this.linkAngularVelocityCache.get(key);
    const vel: number[] = cachedOmega ?? new Array(numSteps).fill(0);

    const cachedAlpha = this.linkAngularAccelerationCache.get(key);
    const acc: number[] = (cachedAlpha && cachedAlpha.length === numSteps)
      ? cachedAlpha
      : new Array(numSteps).fill(0);

    return { ang, vel, acc };
  }

  /**
   * Step 1 in solveGeneralVelocityLoops()
   * Maps each joint and link in a mechanism to nodes and edges
   * Identifies grounded and input joints, which joints connect to each other, and which joint pair IDs belong
   * to each link
   *
   * So that solveGeneralVelocityLoops() can know:
   * what joints exist
   * what links connect them
   * which joints are grounded
   * which link is the input crank
   * what closed loops can be formed
   *
   * returns graph with:
   * a collection of nodes for the joints
   * a collection of edges for the links
   * adjacency information showing which joints are connected
   * flags or metadata for grounded/input joints
   */
  private buildLinkGraph(solveOrder: SolveOrder): LinkGraph {

    // Build nodes (joints)
    const nodes = new Map<number, LinkGraphNode>();
    for (const id of solveOrder.order) {
      const joint = solveOrder.prerequisites.get(id)!.jointToSolve;
      nodes.set(id, { // Store joint ID, if it's grounded, if it's an input
        id,
        isGrounded: joint.isGrounded,
        isInput:    joint.isInput,
      });
    }

    // Build edges (links)
    const edges: LinkGraphEdge[] = [];

    // addEdge creates an edge between two joints (a link) to store the joint information in each link
    const addEdge = (aId: number, bId: number): void => {
      const a = nodes.get(aId)!;
      const b = nodes.get(bId)!;
      edges.push({ // Store the endpoint joint IDs, if joint A & B are grounded and/or inputs
        idA: aId, idB: bId,
        aGrounded: a.isGrounded, bGrounded: b.isGrounded,
        aIsInput:  a.isInput,    bIsInput:  b.isInput,
      });
    };

    // Based on the solve type of each joint (revolute, circle-circle, circle-line),
    for (const id of solveOrder.order) {
      const prereq = solveOrder.prerequisites.get(id)!;
      switch (prereq.solveType) {
        case SolveType.RevoluteInput:
          addEdge(prereq.knownJointOne!.id, id);
          break;
        case SolveType.CircleCircle:
          addEdge(prereq.knownJointOne!.id, id);
          addEdge(prereq.knownJointTwo!.id, id);
          break;
        case SolveType.CircleLine:
          addEdge(prereq.knownJointOne!.id, id);
          break;
      }
    }

    // Build adjacency list - for each joint, creates array of neighbor joints. Then maps neighbors to an edge
    // Used for DFS
    const adj = new Map<number, Array<{ neighbor: number; edgeIndex: number }>>();
    for (const id of solveOrder.order) adj.set(id, []);
    for (let i = 0; i < edges.length; i++) {
      adj.get(edges[i].idA)!.push({ neighbor: edges[i].idB, edgeIndex: i });
      adj.get(edges[i].idB)!.push({ neighbor: edges[i].idA, edgeIndex: i });
    }

    return { nodes, edges, adj };
  }

  /**
   * Uses the graph created in buildLinkGraph() and finds the independent closed loops of the mechanism
   * Velocity solver needs to know:
   * which loops exist
   * which links belong to each loop
   * what direction each link has within the loop.
   *
   * Uses DFS to detect loops in the mechanism grpah and return ordered sequence of directed edges for the loop equations
   * Returns ordered set of loops for the velocity solver
   */
  private findVelocityLoops(graph: LinkGraph, solveOrder: SolveOrder): LoopEdge[][] {

    // get the grounded joints from the graph to identify when the loops are closed through the ground
    const groundIds: number[] = [];
    for (const id of solveOrder.order) {
      const t = solveOrder.prerequisites.get(id)!.solveType;
      if (t === SolveType.Ground || t === SolveType.PrismaticInput) {
        groundIds.push(id);
      }
    }

    // need ≥ 2 ground joints for a closing edge
    if (groundIds.length < 2) return [];

    // create temporary edge between grounded joints to close paths for complete loops for the DFS to detect
    interface AugEdge { idA: number; idB: number; }
    const augEdges: AugEdge[] = graph.edges.map(e => ({ idA: e.idA, idB: e.idB }));
    for (let i = 0; i < groundIds.length - 1; i++) {
      augEdges.push({ idA: groundIds[i], idB: groundIds[i + 1] });
    }

    // build new adjacency list using the aug edges
    const adj = new Map<number, Array<{ neighbor: number; edgeIdx: number }>>();
    for (const id of solveOrder.order) adj.set(id, []);
    for (let i = 0; i < augEdges.length; i++) {
      adj.get(augEdges[i].idA)!.push({ neighbor: augEdges[i].idB, edgeIdx: i });
      adj.get(augEdges[i].idB)!.push({ neighbor: augEdges[i].idA, edgeIdx: i });
    }

    // DFS
    const visited    = new Map<number, boolean>();
    const depth      = new Map<number, number>();
    const parentEdge = new Map<number, number>();
    const backEdges: Array<{ from: number; to: number; edgeIdx: number }> = [];

    const dfs = (nodeId: number): void => {
      visited.set(nodeId, true);
      for (const { neighbor, edgeIdx } of adj.get(nodeId)!) {
        if (!visited.get(neighbor)) {
          depth.set(neighbor, depth.get(nodeId)! + 1);
          parentEdge.set(neighbor, edgeIdx);
          dfs(neighbor);
        } else if (
          edgeIdx !== parentEdge.get(nodeId) &&
          depth.get(neighbor)! < depth.get(nodeId)!
        ) {
          backEdges.push({ from: nodeId, to: neighbor, edgeIdx });
        }
      }
    };

    const startId = groundIds[0];
    depth.set(startId, 0);
    dfs(startId);

    const loops: LoopEdge[][] = [];

    for (const be of backEdges) {
      const pathNodes: number[] = [];
      let cursor = be.from;
      while (cursor !== be.to) {
        pathNodes.push(cursor);
        const pei = parentEdge.get(cursor)!;
        const e   = augEdges[pei];
        cursor = (e.idA === cursor) ? e.idB : e.idA;
      }
      pathNodes.push(be.to);
      pathNodes.reverse();

      const loop: LoopEdge[] = [];

      for (let i = 0; i < pathNodes.length - 1; i++) {
        const x  = pathNodes[i];
        const y  = pathNodes[i + 1];
        const ei = parentEdge.get(y)!;
        const e  = augEdges[ei];
        loop.push({ idA: e.idA, idB: e.idB, direction: e.idA === x ? 1 : -1 });
      }

      const be_e = augEdges[be.edgeIdx];
      loop.push({ idA: be_e.idA, idB: be_e.idB, direction: be_e.idA === be.from ? 1 : -1 });

      loops.push(loop);
    }

    return loops;
  }

  /**
   * Computes link angular velocuty and acceleration for a submechanism
   * 1. clears previous angular results (in the caches)
   * 2. runs loop solver for angular velocity, then acceleration
   * 3. results are stored in the cache to be reused later so links don't need to be re-calculated
   */
  private computeVelocityLoopOmegas(solveOrder: SolveOrder): void {
    this.linkAngularVelocityCache = new Map();
    this.linkAngularAccelerationCache = new Map();
    this.solveGeneralVelocityLoops(solveOrder);
    this.solveGeneralAccelerationLoops(solveOrder);
  }

  /**
   * Main function that solves link angular velocity
   * Step 1: Convert mechanism into general graph where joints are nodes and links are edges
   * allows multiple types of linkages to be solved
   *
   * Step 2: Find the independent closed loops of the mechanism from the graph to form the velocity equations
   *
   * Step 3: Classify each link in the mechanism as ground, input, or unknown. Ground links have zero angular velocity, input
   * links use the known motor speed, and unknown links become the variables of the solver matrix
   *
   * Step 4: Loop through each timestep and build the linear system A x omega = B. Unknown links become the matrix
   * columns and the input link is moved to the right-hand side
   *
   * Step 5: Solve the system using math.lusolve() and store the results in the cache
   *
   */
  private solveGeneralVelocityLoops(solveOrder: SolveOrder): void {

    // ----------------------- Steps 1 + 2: build mechanism graph and find loops -----------------------
    const graph = this.buildLinkGraph(solveOrder);
    const loops = this.findVelocityLoops(graph, solveOrder);
    if (loops.length === 0) return;

    // Input joint and motor speed
    const inputJointId = solveOrder.order[0];
    const inputSpeed   = solveOrder.prerequisites.get(inputJointId)!.jointToSolve.inputSpeed;
    const omega2       = 2 * Math.PI * (inputSpeed / 60);

    let crankEndId: number | null = null;
    for (const id of solveOrder.order) {
      if (solveOrder.prerequisites.get(id)!.solveType === SolveType.RevoluteInput) {
        crankEndId = id;
        break;
      }
    }
    if (crankEndId === null) return;

    const numSteps = this.jointKinematics.get(inputJointId)?.positions.length ?? 0;
    if (numSteps === 0) return;

    // ----------------------- Step 3: classify links -----------------------
    // classify each link as grounded, input, or unknown based on the mechanism graph
    const nodes = graph.nodes;
    const unknownKeys: string[] = [];
    const seenKeys    = new Set<string>();

    for (const loop of loops) {
      for (const step of loop) {
        const nA = nodes.get(step.idA)!;
        const nB = nodes.get(step.idB)!;

        // skip ground link
        if (nA.isGrounded && nB.isGrounded) continue;

        // skip input link
        if ((nA.isGrounded && nA.isInput) || (nB.isGrounded && nB.isInput)) continue;

        // unknown links: each unknown becomes a column in the solver matrix
        const k = this.linkKey(step.idA, step.idB); // make link key for unknown link
        if (!seenKeys.has(k)) {
          seenKeys.add(k);
          unknownKeys.push(k);
        }
      }
    }

    const numLoops    = loops.length;
    const numUnknowns = unknownKeys.length;

    const unknownCol = new Map<string, number>();
    unknownKeys.forEach((k, i) => unknownCol.set(k, i));

    const omegaArrays: number[][] = unknownKeys.map(() => []);
    let lastSol: number[] = new Array(numUnknowns).fill(0);

    // Store input link first (constant)
    this.linkAngularVelocityCache.set(
      this.linkKey(inputJointId, crankEndId),
      new Array(numSteps).fill(omega2)
    );

    // ----------------------- Step 4 + 5: build matrix and store results  -----------------------
    // loop through each timestep
    for (let t = 0; t < numSteps; t++) {

      // matA: coefficient matrix
      const matA: number[][] = Array.from(
        { length: 2 * numLoops },
        () => new Array(numUnknowns).fill(0)
      );
      // right-hand side
      const vecB: number[] = new Array(2 * numLoops).fill(0);

      // loop through all loops
      for (let li = 0; li < numLoops; li++) {
        const rowX = 2 * li; // x equation
        const rowY = 2 * li + 1; // y equation

        // for each link in the loop
        for (const step of loops[li]) {
          const nA   = nodes.get(step.idA)!;
          const nB   = nodes.get(step.idB)!;
          const sign = step.direction;

          // skip ground links
          if (nA.isGrounded && nB.isGrounded) continue;

          // link info at timestep
          const posA  = this.jointKinematics.get(step.idA)!.positions[t];
          const posB  = this.jointKinematics.get(step.idB)!.positions[t];
          const dx    = posB.x - posA.x;
          const dy    = posB.y - posA.y;
          const theta = Math.atan2(dy, dx);
          const r     = Math.hypot(dx, dy);

          // input link known, not places in unknown matrix
          if ((nA.isGrounded && nA.isInput) || (nB.isGrounded && nB.isInput)) {
            vecB[rowX] += sign * r * Math.sin(theta) * omega2;
            vecB[rowY] -= sign * r * Math.cos(theta) * omega2;
            continue;
          }

          // populate matrix with unknown link
          const col = unknownCol.get(this.linkKey(step.idA, step.idB))!;
          matA[rowX][col] += sign * (-r * Math.sin(theta));
          matA[rowY][col] += sign * ( r * Math.cos(theta));
        }
      }

      // Solve A · x = b using lusolve
      try {
        const rawSol = math.lusolve(matA, vecB) as number[][];
        const sol = rawSol.map(row => row[0]);
        lastSol = sol;
        sol.forEach((v, i) => omegaArrays[i].push(v));
      } catch {
        lastSol.forEach((v, i) => omegaArrays[i].push(v));
      }
    }

    // store results in cache
    unknownKeys.forEach((k, i) => {
      this.linkAngularVelocityCache.set(k, omegaArrays[i]);
    });
  }

  /**
   * Main function that solves link angular acceleration
   * called after solveGeneralVelocityLoops() so that linkAngularVelocityCache is populated
   *
   * Step 1: Rebuild the general mechanism graph from the angular velocity solver
   *
   * Step 2: Find the independent closed loops of the mechanism from the graph
   *
   * Step 3: Classify links as ground, input, or unknown. Ground links have zero angular acceleration, the
   * input link uses the known input acceleration, and unknown links become the variables of the solver matrix
   *
   * Step 4: Loop through each timestep and build the linear system A x omega = B. The coefficient matrix A is the same form as in
   * the angular velocity solver, but the right-hand side now includes the centripetal terms computed from the angular velocities
   * solved previously
   *
   * Step 5: Solve the system using math.lusolve() and store the results in the cache
   */
  private solveGeneralAccelerationLoops(solveOrder: SolveOrder): void {

    const graph = this.buildLinkGraph(solveOrder);
    const loops = this.findVelocityLoops(graph, solveOrder);
    if (loops.length === 0) return;

    const inputJointId = solveOrder.order[0];
    const inputSpeed = solveOrder.prerequisites.get(inputJointId)!.jointToSolve.inputSpeed;
    const omega2 = 2 * Math.PI * (inputSpeed / 60);
    const alpha2 = 0; // input acceleration is 0 (constant)

    let crankEndId: number | null = null;
    for (const id of solveOrder.order) {
      if (solveOrder.prerequisites.get(id)!.solveType === SolveType.RevoluteInput) {
        crankEndId = id;
        break;
      }
    }
    if (crankEndId === null) return;

    const numSteps = this.jointKinematics.get(inputJointId)?.positions.length ?? 0;
    if (numSteps === 0) return;

    const nodes = graph.nodes;
    const unknownKeys: string[] = [];
    const seenKeys = new Set<string>();

    for (const loop of loops) {
      for (const step of loop) {
        const nA = nodes.get(step.idA)!;
        const nB = nodes.get(step.idB)!;
        if (nA.isGrounded && nB.isGrounded) continue;
        if ((nA.isGrounded && nA.isInput) || (nB.isGrounded && nB.isInput)) continue;
        const k = this.linkKey(step.idA, step.idB);
        if (!seenKeys.has(k)) {
          seenKeys.add(k);
          unknownKeys.push(k);
        }
      }
    }

    const numLoops = loops.length;
    const numUnknowns = unknownKeys.length;

    const unknownCol = new Map<string, number>();
    unknownKeys.forEach((k, i) => unknownCol.set(k, i));

    const alphaArrays: number[][] = unknownKeys.map(() => []);
    let lastSol: number[] = new Array(numUnknowns).fill(0);

    this.linkAngularAccelerationCache.set(
      this.linkKey(inputJointId, crankEndId),
      new Array(numSteps).fill(alpha2)
    );

    for (let t = 0; t < numSteps; t++) {

      const matA: number[][] = Array.from(
        { length: 2 * numLoops },
        () => new Array(numUnknowns).fill(0)
      );
      const vecB: number[] = new Array(2 * numLoops).fill(0);

      for (let li = 0; li < numLoops; li++) {
        const rowX = 2 * li;
        const rowY = 2 * li + 1;

        for (const step of loops[li]) {
          const nA = nodes.get(step.idA)!;
          const nB = nodes.get(step.idB)!;
          const sign = step.direction;

          if (nA.isGrounded && nB.isGrounded) continue;

          const posA = this.jointKinematics.get(step.idA)!.positions[t];
          const posB = this.jointKinematics.get(step.idB)!.positions[t];
          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const theta = Math.atan2(dy, dx);
          const r = Math.hypot(dx, dy);

          const sinT = Math.sin(theta);
          const cosT = Math.cos(theta);

          const isCrank = (nA.isGrounded && nA.isInput) || (nB.isGrounded && nB.isInput);

          // input crank moved into RHS
          if (isCrank) {
            vecB[rowX] += sign * r * omega2 * omega2 * cosT;
            vecB[rowY] += sign * r * omega2 * omega2 * sinT;

            if (alpha2 !== 0) {
              vecB[rowX] += sign * r * alpha2 * sinT;
              vecB[rowY] -= sign * r * alpha2 * cosT;
            }
            continue;
          }

          const omegaI = this.linkAngularVelocityCache.get(
            this.linkKey(step.idA, step.idB)
          )?.[t] ?? 0;

          vecB[rowX] += sign * r * omegaI * omegaI * cosT;
          vecB[rowY] += sign * r * omegaI * omegaI * sinT;

          const col = unknownCol.get(this.linkKey(step.idA, step.idB))!;
          matA[rowX][col] += sign * (-r * sinT);
          matA[rowY][col] += sign * ( r * cosT);
        }
      }

      try {
        let sol: number[];
        if (matA.length === numUnknowns) {
          const rawSol = math.lusolve(matA, vecB) as number[][];
          sol = rawSol.map(row => row[0]);
        } else {
          const matAT = math.transpose(matA) as number[][];
          const matAT_A = math.multiply(matAT, matA) as number[][];
          const vecAT_b = math.multiply(matAT, vecB) as number[];
          const rawSol = math.lusolve(matAT_A, vecAT_b) as number[][];
          sol = rawSol.map(row => row[0]);
        }
        lastSol = sol;
        sol.forEach((v, i) => alphaArrays[i].push(v));
      } catch {
        lastSol.forEach((v, i) => alphaArrays[i].push(v));
      }
    }

    unknownKeys.forEach((k, i) => {
      this.linkAngularAccelerationCache.set(k, alphaArrays[i]);
    });
  }

    /**
     * creates unique key for each physical link independent of joint order
     * i.e. (2,5) is the same as (5,2)
     */
    private linkKey(a: number, b: number): string {
        return a < b ? `${a}_${b}` : `${b}_${a}`;
    }

    // ===================== COM POSITION TRACKING =====================
    // This section below is added by MQP 25-26 to calculate and track COM of a link more accurately, not using the average method anymore.

    /**
     * Computes and stores COM positions for all rigid bodies across all timesteps
     * for a specific sub-mechanism, using circle-circle intersection to track the
     * COM as a fixed point in the body frame.
     *
     * Results are stored in this.comPositions[submechIndex][timestep] = Map<rigidBodyId, Coord>
     *
     * @param submechIndex - index of the sub-mechanism
     * @param uniqueRigidBodies - unique rigid bodies in this sub-mechanism
     * @param animationData - animation frames for this sub-mechanism
     */
    private solveCOMPositions( // Start from this function for COM
        submechIndex: number,
        uniqueRigidBodies: RigidBody[],
        animationData: AnimationPositions
    ): void {
        const allPositions = animationData.positions;       // allPositions[timestep][jointIndex]
        const jointIDs = animationData.correspondingJoints; // jointIDs[jointIndex] = joint ID

        this.comPositions[submechIndex] = [];

        for (let t = 0; t < allPositions.length; t++) {
            // Build positionMap <jointId, Coord> for this timestep
            const positionMap = new Map<number, Coord>();
            for (let i = 0; i < jointIDs.length; i++) {
                positionMap.set(jointIDs[i], allPositions[t][i]);
            }

            const comMapAtT = new Map<number, Coord>();

            if (t === 0) {
                // Seed from rigidBody.centerOfMass at t=0 (average-of-joints from link.ts)
                uniqueRigidBodies.forEach(rb => {
                    comMapAtT.set(rb.id, rb.centerOfMass);
                });
            } else {
                // Track COM forward using circle-circle intersection
                const prevCOMMap = this.comPositions[submechIndex][t - 1];

                uniqueRigidBodies.forEach(rb => {
                    const newCOM = this.trackCOMWithCircleIntersection(rb, positionMap, prevCOMMap);
                    if (newCOM) {
                        comMapAtT.set(rb.id, newCOM);
                    } else {
                        // Fallback: keep previous COM if intersection fails
                        console.warn(`COM tracking failed for rigid body ${rb.id} at timestep ${t}, using previous value`);
                        const prevCOM = prevCOMMap.get(rb.id);
                        if (prevCOM) comMapAtT.set(rb.id, prevCOM);
                    }
                });
            }

            this.comPositions[submechIndex].push(comMapAtT);
        }
    }

    /**
     * Tracks the COM of a rigid body at the current timestep using circle-circle intersection.
     *
     * The COM is a fixed point in the body frame. Its new position is found by intersecting:
     *   Circle 1: centered at joint0's new position, radius = dist(joint0, COM) at t=0
     *   Circle 2: centered at joint1's new position, radius = dist(joint1, COM) at t=0
     *
     * When two intersections exist, the one closer to the previous COM is chosen for continuity.
     */
    private trackCOMWithCircleIntersection(
        rigidBody: RigidBody,
        positionMap: Map<number, Coord>,
        prevCOMMap: Map<number, Coord>
    ): Coord | undefined {
        const joints = rigidBody.getJoints();
        if (joints.length < 2) {
            console.warn(`Rigid body ${rigidBody.id} has fewer than 2 joints — cannot track COM`);
            return undefined;
        }

        const joint0 = joints[0];
        const joint1 = joints[1];

        // Original positions and COM at t=0 (from the live model)
        const A0 = joint0.coords;
        const B0 = joint1.coords;
        const COM0 = rigidBody.centerOfMass;

        // New joint positions at this timestep
        const A_new = positionMap.get(joint0.id) ?? A0;
        const B_new = positionMap.get(joint1.id) ?? B0;

        // Fixed radii in the body frame (invariant under rigid motion)
        const rA = this.distanceBetweenCoords(A0, COM0);
        const rB = this.distanceBetweenCoords(B0, COM0);

        const intersections = this.circleCircleIntersection(A_new, rA, B_new, rB);

        if (intersections.length === 0) return undefined;
        if (intersections.length === 1) return intersections[0];

        // Two intersections: pick the one closer to previous COM for continuity
        const prevCOM = prevCOMMap.get(rigidBody.id);
        if (!prevCOM) return intersections[0];

        const d0 = this.distanceBetweenCoords(prevCOM, intersections[0]);
        const d1 = this.distanceBetweenCoords(prevCOM, intersections[1]);
        return d0 <= d1 ? intersections[0] : intersections[1];
    }

    /**
     * Returns the COM map for all rigid bodies at a specific timestep of a sub-mechanism.
     * For each sub-mechanism, at a timestep "t", we will save a map of each rigid body (link/ compound link) with its COM. 
     * comPositions[submechIndex][timestep] = Map<rigidBodyId, Coord>
     */
    public getCOMPositions(submechIndex: number, timestep: number): Map<number, Coord> | undefined {
        // santity check
        if (!this.comPositions[submechIndex]) {
            console.warn(`No COM data for sub-mechanism ${submechIndex}. Call updateKinematics() first.`);
            return undefined;
        }
        if (timestep < 0 || timestep >= this.comPositions[submechIndex].length) {
            console.warn("Timestep out of range for sub-mechanism");
            return undefined;
        }
        // otherwise, return the corresponding Map<> of COM at time t of a sub-mechanism
        return this.comPositions[submechIndex][timestep];
    }

    /**
     * Returns true if COM positions have been computed for the given sub-mechanism.
     */
    public hasCOMData(submechIndex: number): boolean {
        return this.comPositions[submechIndex] !== undefined &&
            this.comPositions[submechIndex].length > 0;
    }

    private distanceBetweenCoords(p: Coord, q: Coord): number {
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Find intersections between 2 circle
    // Circular method: check "intersections between 2 circle" section here https://paulbourke.net/geometry/circlesphere/
    // This method is the same as circleCircleIntersection() in kinematic-solver.service.ts
    private circleCircleIntersection(point0: Coord, r0: number, point1: Coord, r1: number): Coord[] {
        const eps = 1e-9;

        // Calculate distance d between the center of the circles
        const dx = point1.x - point0.x;
        const dy = point1.y - point0.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        // two circle centers are almost the same
        if (d < eps && Math.abs(r0 - r1) < eps) {
            console.log('two circle centers are almost the same');
            return [];
        } 

        // same center with different radius
        if (d < eps) {
            console.log('same center with different radius')
            return []; 
        } 

        // Circles too far apart
        if (d > r0 + r1 + eps) {
            console.log('Circles too far apart');
            return [];
        } 

        // one circle inside the other without touching
        if (d < Math.abs(r0 - r1) - eps) {
            console.log('one circle inside the other without touching');
            return [];
        } 

        // Compute intersection(s), reading this article at section "Intersection of two circles" https://paulbourke.net/geometry/circlesphere/
        const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);

        let h_square = r0 * r0 - a * a;

        // Clamp due to floating point errors
        if (h_square < 0 && h_square > -1e-9) h_square = 0;
        if (h_square < 0) return [];

        const h = Math.sqrt(h_square);

        // Point P2 between and along the line created by p0 and p1
        const point2_x = point0.x + (a * dx) / d;
        const point2_y = point0.y + (a * dy) / d;

        // Offset vector
        const vx = (dy * h) / d;
        const vy = (dx * h) / d;

        // one intersection, because h is too small, so the offset vector vx, vy becomes 0, 0. And the intersection point simply P2(point2_x, point2_y)
        if (h < eps) {
            console.log('1 intersection between circles');
            return [new Coord(point2_x, point2_y)];
        }
        
        const p1 = new Coord(point2_x - vx, point2_y + vy);
        const p2 = new Coord(point2_x + vx, point2_y - vy);
        return [p1, p2];
    }   

    /**
     * Extracts unique rigid bodies from a sub-mechanism map.
     * --- try to print out using "console.log('sub-mechanisms: ', subMechanisms);" for method getSubMechanisms() in mechanism.ts to understand more why we need this function
     */
    private getUniqueRigidBodies(subMechanism: Map<any, RigidBody[]>): RigidBody[] {
        const rigidBodySet = new Set<RigidBody>();
        subMechanism.forEach(rigidBodies => {
            rigidBodies.forEach(rb => rigidBodySet.add(rb));
        });
        return Array.from(rigidBodySet);
    }
}

