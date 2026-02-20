import { Injectable } from '@angular/core';
import { Coord } from '../model/coord';
import { Link } from "../model/link";
import { Joint } from "../model/joint";
import { PositionSolverService, SolveOrder, SolvePrerequisite, SolveType } from './kinematic-solver.service';
import { AnimationPositions } from './kinematic-solver.service';
import { create, all, MathJsInstance } from 'mathjs'
import {StateService} from "./state.service";

export interface JointAnalysis {
  timeIncrement: number,
  positions: Coord[],
  velocities: Coord[],
  accelerations: Coord[],
}
interface LinkSegmentInfo {
  linkId: number;
  jointIndices: number[];   // indices into jointIDs/subJoints
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

const math: MathJsInstance = create(all, {});

@Injectable({
  providedIn: 'root'
})
export class AnalysisSolveService {

  private solveOrders: SolveOrder[] = [];
  private jointPositions: AnimationPositions[] = [];
  private jointKinematics: Map<number, JointAnalysis> = new Map();

  constructor(private positionSolver: PositionSolverService, private stateService: StateService,) {
  }


  // Updates kinematic data by fetching solve orders and joint positions, then solving submechanism kinematics.
  updateKinematics() {
    /**Order of operations
     * 1. First we need the Solve Orders and Positions of the joints from position solver
     * 2. For solving links we need to associate model links with the joints being solved for, we can do so by using the
     * 3. Iterate over each position, solving for the needed information for both links and joints.
     * 4. Update the Information
     */
    this.solveOrders = this.positionSolver.getSolveOrders();
    this.jointPositions = this.positionSolver.getAnimationFrames();
    this.jointKinematics = new Map();
    for (let i = 0; i < this.solveOrders.length; i++) {
      this.solveSubmechanimsKinematics(this.solveOrders[i], this.jointPositions[i]);
    }
  }

  // Solves kinematics for a specific submechanism given its solve order and joint positions.
  solveSubmechanimsKinematics(solveOrder: SolveOrder, jointPositions: AnimationPositions) {
    /**we are given the animation positions and solve order for a submechanism
     * 1. iterate over each set of positions to solve
     * 2. call a function that returns all relevant calculations
     * 3. update jointKinematics
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
      let joint: JointAnalysis = {
        timeIncrement: timeIncrement,
        positions: positions,
        velocities: velocities,
        accelerations: accelerations
      }
      this.jointKinematics.set(solveOrder.order[i], joint);
    }
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
        case SolveType.CircleCircle:
          let knownIndex1 = solveOrder.order.indexOf(prereq.knownJointOne!.id);
          let knownIndex2 = solveOrder.order.indexOf(prereq.knownJointTwo!.id);
          velocity_acceleration = this.solveCircleCirlceJointKinematics(index, knownIndex1, knownIndex2, positions, velocities, accelerations);
          velocities.push(velocity_acceleration.velocity);
          accelerations.push(velocity_acceleration.acceleration);
          break;
        case SolveType.CircleLine:
          knownIndex1 = solveOrder.order.indexOf(prereq.knownJointOne!.id);
          velocity_acceleration = this.solveCircleLineJointKinematics(index, knownIndex1, prereq, positions, velocities, accelerations)
          velocities.push(velocity_acceleration.velocity);
          accelerations.push(velocity_acceleration.acceleration);
          break;
      }
    }
    return {velocities: velocities, accelerations: accelerations};
  }

  //need to account for switching directions
  /**
   * Solves for the velocity and acceleration of a joint connected to a grounded revolute input
   * @param jointIndex - an index for the joint to be solved within with positions array.
   * @param prereq - a SolvePrerequisite that corresponds to that joint.
   * @param positions - an array of joint positions for a particular timestep.
   * @returns
   */
  solveRevInputJointKinematics(jointIndex: number, prereq: SolvePrerequisite, positions: Coord[]): {
    velocity: Coord,
    acceleration: Coord
  } {

    const xDifference = positions[jointIndex].x - positions[0].x;
    const yDifference = positions[jointIndex].y - positions[0].y;
    const angleToInput: number = Math.atan2(yDifference, xDifference);
    const omega: number = 2 * Math.PI * (prereq.knownJointOne!.inputSpeed / 60); //Angular Velocity of Link in Radians
    const r: number = prereq.distFromKnownJointOne!;

    //velocity
    const velocityMagnitude = r * omega; //Velocity magnitude
    const velocityTheta = omega > 0 ? angleToInput - Math.PI / 2 : angleToInput + Math.PI / 2; //Velocity direction
    const xVelocity: number = Math.cos(velocityTheta) * velocityMagnitude;
    const yVelocity: number = Math.sin(velocityTheta) * velocityMagnitude;
    const jointVelocity: Coord = new Coord(xVelocity, yVelocity);
    //acceleration
    const xAcceleration: number = -Math.cos(angleToInput) * velocityMagnitude * omega;
    const yAcceleration: number = -Math.sin(angleToInput) * velocityMagnitude * omega;
    const jointAcceleration: Coord = new Coord(xAcceleration, yAcceleration);
    return {velocity: jointVelocity, acceleration: jointAcceleration};
  }

  // Calculates velocity and acceleration for a prismatic input joint from its prerequisites.
  solvePrisInputJointKinematics(prereq: SolvePrerequisite): { velocity: Coord, acceleration: Coord } {
    const velocityMag = prereq.jointToSolve.inputSpeed * (0.05 * 6) //Kinematic solver generates frames for 0.05m increments, and animator uses Rev-Input timeInterval calculation
    const velocityTheta = prereq.jointToSolve.angle;
    const deltaX: number = Math.cos(velocityTheta) * velocityMag;
    const deltaY: number = Math.sin(velocityTheta) * velocityMag;
    const jointVelocity: Coord = new Coord(deltaX, deltaY);
    const jointAcceleration: Coord = new Coord(0, 0);
    return {velocity: jointVelocity, acceleration: jointAcceleration};
  }

  // Determines velocity and acceleration for a joint constrained by two circular motions using known indices, positions, velocities, and accelerations.
  solveCircleCirlceJointKinematics(jointIndex: number, known1Index: number, known2Index: number, positions: Coord[], velocities: Coord[], accelerations: Coord[]): {
    velocity: Coord,
    acceleration: Coord
  } {
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
    return {velocity: jointVelocity, acceleration: jointAcceleration};
  }

  // Determines velocity and acceleration for a joint constrained by a circle and a line using known index, prerequisites, positions, velocities, and accelerations.
  solveCircleLineJointKinematics(jointIndex: number, known1Index: number, prereq: SolvePrerequisite, positions: Coord[], velocities: Coord[], accelerations: Coord[]): {
    velocity: Coord,
    acceleration: Coord
  } {
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
    return {velocity: jointVelocity, acceleration: jointAcceleration};
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
  transformJointKinematicGraph(jointAnalysis: JointAnalysis, dataOf: string): {
    xData: any[],
    yData: any[],
    timeLabels: string[]
  } {
    const xData: any[] = [];
    const yData: any[] = [];
    const timeLabels: string[] = [];

    switch (dataOf) {
      case ("Position"):
        xData.push({data: jointAnalysis.positions.map(coord => coord.x), label: "X data of Position"});
        yData.push({data: jointAnalysis.positions.map(coord => coord.y), label: "Y data of Position"});
        timeLabels.push(...jointAnalysis.positions.map((_, index) => String(index)));

        return {xData, yData, timeLabels};

      case ("Velocity"):
        xData.push({data: jointAnalysis.velocities.map(coord => coord.x), label: "X data of Velocity"});
        yData.push({data: jointAnalysis.velocities.map(coord => coord.y), label: "Y data of Velocity"});
        timeLabels.push(...jointAnalysis.velocities.map((_, index) => String(index)));

        return {xData, yData, timeLabels};

      case ("Acceleration"):
        xData.push({data: jointAnalysis.accelerations.map(coord => coord.x), label: "X data of Acceleration"});
        yData.push({data: jointAnalysis.accelerations.map(coord => coord.y), label: "Y data of Acceleration"});
        timeLabels.push(...jointAnalysis.accelerations.map((_, index) => String(index)));

        return {xData, yData, timeLabels};

      default:
        console.error("Invalid Graph type detected! Returning default values.")
        return {xData, yData, timeLabels};
    }

  }

  // Converts link kinematic data into arrays suitable for plotting, based on requested data type (angle, velocity, or acceleration).
  transformLinkKinematicGraph(linkAnalysis: LinkAnalysis, dataOf: string): {
    xData: any[],
    yData: any[],
    timeLabels: string[]
  } {
    const xData: any[] = [];
    const yData: any[] = [];
    const timeLabels: string[] = [];

    switch (dataOf) {
      case ("Angle"):
        xData.push({data: linkAnalysis.angle, label: "Angle of Reference Joint"});
        timeLabels.push(...linkAnalysis.angle.map((_, index) => String(index)));

        return {xData, yData, timeLabels};

      case ("Velocity"):
        // xData.push({data: linkAnalysis.angularVelocity.map(a => ), label: "Angular Velocity"});
        // xData.push({data: linkAnalysis.angularVelocity, label: "Angular Velocity"});
        xData.push({data: linkAnalysis.angularVelocity, label: "Angular Velocity (rad/s)"});
        timeLabels.push(...linkAnalysis.angularVelocity.map((_, index) => String(index)));

        return {xData, yData, timeLabels};

      case ("Acceleration"):
        xData.push({data: linkAnalysis.angularAcceleration, label: "Angular Acceleration"});
        timeLabels.push(...linkAnalysis.angularAcceleration.map((_, index) => String(index)));

        return {xData, yData, timeLabels};

      default:
        console.error("Invalid Graph type detected! Returning default values.")
        return {xData, yData, timeLabels};
    }

  }

  // Computes center-of-mass and angular kinematics for a link given its associated joint IDs.
  getLinkKinematics(jointIDs: number[], linkIndex: number): LinkAnalysis {
    let subJoints: JointAnalysis[] = [];

    for (let id of jointIDs) {
      const jointData = this.jointKinematics.get(id);
      subJoints.push(jointData!);
    }
    let com_solutions: { pos: Coord[], vel: Coord[], acc: Coord[] } = this.getLinkCOMSolutions(subJoints);
    let angle_solutions = this.getLinkAngularSolutions(subJoints, jointIDs, linkIndex);

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
    return {pos: com_positions, vel: com_velocities, acc: com_accelerations}
  }

  // Calculates angular positions, velocities, and accelerations for all links.
  getLinkAngularSolutions(subJoints: JointAnalysis[], jointIDs: number[], linkIndex: number) {
    const mech = this.stateService.getMechanism();
    const links = mech.getArrayOfLinks();
    const link = links[linkIndex];

    let ang_pos: number[] = [];
    let ang_vel: number[] = [];
    let ang_acc: number[] = [];

    const numSteps = subJoints?.[0]?.positions?.length ?? 0;
    if (!numSteps || !link) return { ang: ang_pos, vel: ang_vel, acc: ang_acc };

    // Determine which link is actually the input/coupler/output for this mechanism
    const fourBar = this.identifyFourBarLinks(links);
    const hasFourBarMap = !!(fourBar.inputLink && fourBar.couplerLink && fourBar.outputLink);

    // Link lengths from mechanism
    const r2 = hasFourBarMap ? fourBar.inputLink!.length : (links[0]?.length ?? 0);
    const r3 = hasFourBarMap ? fourBar.couplerLink!.length : (links[1]?.length ?? 0);
    const r4 = hasFourBarMap ? fourBar.outputLink!.length : (links[2]?.length ?? 0);

    // Known input speed -> omega2 (prefer input joint speed when available)
    const rpm = fourBar.inputJoint ? fourBar.inputJoint.inputSpeed : mech.getInputSpeed();
    const omega2 = 2 * Math.PI * (rpm / 60);

    const normalizeAngle = (theta: number) => {
      const twoPi = 2 * Math.PI;
      const t = theta % twoPi;
      return t < 0 ? t + twoPi : t;
    };

    const unwrapAngle = (prevUnwrapped: number, prevRaw: number, raw: number) => {
      let delta = raw - prevRaw;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      else if (delta < -Math.PI) delta += 2 * Math.PI;
      return prevUnwrapped + delta;
    };

    let prevThetaRaw: number | null = null;
    let prevThetaUnwrapped: number | null = null;
    const thetaUnwrapped: number[] = [];

    for (let t = 0; t < numSteps; t++) {
      // Theta for the CURRENT exported link
      const thisLink = this.findJointPair(link, subJoints, jointIDs, t);
      if (!thisLink) {
        ang_pos.push(0); ang_vel.push(0); ang_acc.push(0);
        continue;
      }

      const thisA = subJoints[thisLink.idxA].positions[t];
      const thisB = subJoints[thisLink.idxB].positions[t];
      const thisThetaRaw = Math.atan2(thisB.y - thisA.y, thisB.x - thisA.x);
      const priorRaw: number | null = prevThetaRaw;
      const priorUnwrapped: number | null = prevThetaUnwrapped;
      const thisThetaUnwrapped: number = priorRaw === null || priorUnwrapped === null
        ? thisThetaRaw
        : unwrapAngle(priorUnwrapped, priorRaw, thisThetaRaw);
      const dTheta: number = priorUnwrapped === null ? 0 : thisThetaUnwrapped - priorUnwrapped;
      prevThetaRaw = thisThetaRaw;
      prevThetaUnwrapped = thisThetaUnwrapped;
      thetaUnwrapped.push(thisThetaUnwrapped);

      ang_pos.push(normalizeAngle(thisThetaRaw));

      // Thetas for matrix solver
      const link2 = hasFourBarMap ? fourBar.inputLink! : links[0];
      const link3 = hasFourBarMap ? fourBar.couplerLink! : links[1];
      const link4 = hasFourBarMap ? fourBar.outputLink! : links[2];

      const p2 = link2 ? this.findJointPair(link2, subJoints, jointIDs, t) : null;
      const p3 = link3 ? this.findJointPair(link3, subJoints, jointIDs, t) : null;
      const p4 = link4 ? this.findJointPair(link4, subJoints, jointIDs, t) : null;

      if (!p2 || !p3 || !p4 || !r2 || !r3 || !r4) {
        const omegaFallback = (!hasFourBarMap && linkIndex === 0) || (hasFourBarMap && link === fourBar.inputLink) ? omega2 : 0;
        const omegaOut = Math.abs(dTheta) > 1e-12 ? Math.sign(dTheta) * Math.abs(omegaFallback) : omegaFallback;
        ang_vel.push(omegaOut);
        ang_acc.push(0);
        continue;
      }

      // Current timestep positions for each link
      const A2 = subJoints[p2.idxA].positions[t];
      const B2 = subJoints[p2.idxB].positions[t];
      const theta2 = Math.atan2(B2.y - A2.y, B2.x - A2.x);

      const A3 = subJoints[p3.idxA].positions[t];
      const B3 = subJoints[p3.idxB].positions[t];
      const theta3 = Math.atan2(B3.y - A3.y, B3.x - A3.x);

      const A4 = subJoints[p4.idxA].positions[t];
      const B4 = subJoints[p4.idxB].positions[t];
      const theta4 = Math.atan2(B4.y - A4.y, B4.x - A4.x);

      // Matrix solution for unknown omegas
      const { omega3, omega4 } = this.getAngularVelocities(r2, r3, r4, theta2, theta3, theta4, omega2);

      let omegaCandidate = 0;
      if (hasFourBarMap) {
        if (link === fourBar.inputLink) omegaCandidate = omega2;
        else if (link === fourBar.couplerLink) omegaCandidate = omega3;
        else if (link === fourBar.outputLink) omegaCandidate = omega4;
        else omegaCandidate = 0;
      } else {
        const omegas = [omega2, omega3, omega4];
        omegaCandidate = omegas[linkIndex] ?? 0;
      }
      const omegaOut = Math.abs(dTheta) > 1e-12 ? Math.sign(dTheta) * Math.abs(omegaCandidate) : omegaCandidate;

      ang_vel.push(omegaOut); // Push the selected link velocity
      ang_acc.push(0); // Placeholder for now
    }

    if (ang_vel.length > 1 && thetaUnwrapped.length > 1) {
      const dTheta0 = thetaUnwrapped[1] - thetaUnwrapped[0];
      if (Math.abs(dTheta0) > 1e-12) {
        ang_vel[0] = Math.sign(dTheta0) * Math.abs(ang_vel[0]);
      }
    }

    return { ang: ang_pos, vel: ang_vel, acc: ang_acc };
  }

  // Calculate unknown angular velocities of a 4 bar linkage // ω2k×r2+ω3k×r3−ω4k×r4=0
  getAngularVelocities( r2: number, r3: number, r4: number, theta2: number, theta3: number, theta4: number, omega2: number ) {
    // Build A matrix (2x2) for unknowns
    const A = math.matrix([ [-r3 * Math.sin(theta3), r4 * Math.sin(theta4)], [ r3 * Math.cos(theta3), -r4 * Math.cos(theta4)], ]);
    // Build right-hand side B (2x1)
    const B = math.matrix([ [ r2 * omega2 * Math.sin(theta2) ], [-r2 * omega2 * Math.cos(theta2) ], ]);

    // Solve for unknowns (system of equations)
    const sol = math.lusolve(A, B) as any;

    // get each row (0, 1) in sol matrix
    const omega3 = sol.get([0, 0]) as number;
    const omega4 = sol.get([1, 0]) as number;
    return { omega2, omega3, omega4 };
  }

  private findJointPair(
    link: any,
    subJoints: JointAnalysis[],
    jointIDs: number[],
    t: number
  ): { idxA: number; idxB: number } | null {

    const mech = this.stateService.getMechanism();
    const allLinks = mech.getArrayOfLinks();
    const degMap = this.buildJointDegreeMap(allLinks);

    const linkJointIds = Array.from(link.joints.keys()).map(j => Number(j));

    // Prefer joints that connect to other links (degree > 1)
    let preferred = linkJointIds.filter(jid => (degMap.get(jid) ?? 0) > 1);

    // Fallback if we can't find two connection joints
    if (preferred.length < 2) preferred = linkJointIds;

    // Map joint ids -> indices into subJoints
    const idxs: number[] = [];
    for (const jid of preferred) {
      const idx = jointIDs.indexOf(jid);
      if (idx >= 0) idxs.push(idx);
    }

    // Pick farthest pair among preferred candidates (stable + works well)
    let bestI = -1, bestJ = -1, bestD2 = -Infinity;
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const i = idxs[a], j = idxs[b];
        const p = subJoints[i]?.positions?.[t];
        const q = subJoints[j]?.positions?.[t];
        if (!p || !q) continue;

        const dx = q.x - p.x, dy = q.y - p.y;
        const d2 = dx*dx + dy*dy;
        if (d2 > bestD2) { bestD2 = d2; bestI = i; bestJ = j; }
      }
    }

    if (bestI < 0 || bestJ < 0) return null;
    return { idxA: bestI, idxB: bestJ };
  }

  private identifyFourBarLinks(links: Link[]): {
    inputLink?: Link;
    couplerLink?: Link;
    outputLink?: Link;
    groundLink?: Link;
    inputJoint?: Joint;
  } {
    const mech = this.stateService.getMechanism();
    const joints = mech.getArrayOfJoints();
    const inputJoint = joints.find(j => j.isInput);
    const groundedJoints = joints.filter(j => j.isGrounded);

    const isGroundLink = (link: Link) => {
      const js = link.getJoints();
      return js.length >= 2 && js.every(j => j.isGrounded);
    };

    const groundLink = links.find(isGroundLink);

    let inputLink: Link | undefined;
    let inputOther: Joint | undefined;
    if (inputJoint) {
      for (const l of links) {
        if (!l.containsJoint(inputJoint.id)) continue;
        const other = l.getJoints().find(j => j.id !== inputJoint.id);
        if (other && !other.isGrounded) {
          inputLink = l;
          inputOther = other;
          break;
        }
      }
    }

    let outputJoint: Joint | undefined;
    if (inputJoint) {
      outputJoint = groundedJoints.find(j => j.id !== inputJoint.id);
    }

    let outputLink: Link | undefined;
    let outputOther: Joint | undefined;
    if (outputJoint) {
      for (const l of links) {
        if (!l.containsJoint(outputJoint.id)) continue;
        const other = l.getJoints().find(j => j.id !== outputJoint?.id);
        if (other && !other.isGrounded) {
          outputLink = l;
          outputOther = other;
          break;
        }
      }
    }

    let couplerLink: Link | undefined;
    if (inputOther && outputOther) {
      const inputOtherId = inputOther.id;
      const outputOtherId = outputOther.id;
      couplerLink = links.find(l => l.containsJoint(inputOtherId) && l.containsJoint(outputOtherId));
    }
    if (!couplerLink) {
      couplerLink = links.find(l =>
        l !== inputLink &&
        l !== outputLink &&
        l !== groundLink &&
        l.getJoints().every(j => !j.isGrounded)
      );
    }

    return { inputLink, couplerLink, outputLink, groundLink, inputJoint };
  }


  private buildJointDegreeMap(links: any[]): Map<number, number> {
    const deg = new Map<number, number>();
    for (const link of links) {
      for (const jid of link.joints.keys()) {
        deg.set(Number(jid), (deg.get(Number(jid)) ?? 0) + 1);
      }
    }
    return deg;
  }


}

