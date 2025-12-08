import { Injectable } from '@angular/core';
import { Coord } from '../model/coord';
import { PositionSolverService, SolveOrder, SolvePrerequisite, SolveType } from './kinematic-solver.service';
import { AnimationPositions } from './kinematic-solver.service';
import { create, all, MathJsInstance } from 'mathjs'

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

const math: MathJsInstance = create(all, {});

@Injectable({
  providedIn: 'root'
})
export class AnalysisSolveService {

  private solveOrders: SolveOrder[] = [];
  private jointPositions: AnimationPositions[] = [];
  private jointKinematics: Map<number, JointAnalysis> = new Map();

  constructor(private positionSolver: PositionSolverService) {

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
    let angle_solutions: { ang: number[], vel: number[], acc: number[] } = this.getLinkAngularSolutions(subJoints, linkIndex);

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
  getLinkAngularSolutions(subJoints: JointAnalysis[], linkIndex: number) {

    let ang_pos: number[] = [];
    let ang_vel: number[] = [];
    let ang_acc: number[] = [];

    // Compute link lengths (r2 = AB, r3 = BC, r4 = CD)
    const r2 = this.distance(subJoints[1].positions[0], subJoints[0].positions[0]);
    const r3 = this.distance(subJoints[2].positions[0], subJoints[1].positions[0]);
    const r4 = this.distance(subJoints[3].positions[0], subJoints[2].positions[0]);

    // Input angular velocity ω2
    const omega2 = 1.0472; // CHANGE TO BE SYSTEM

    for (let time = 0; time < subJoints[0].positions.length; time++) {

      const theta2 = Math.atan2(
        subJoints[1].positions[time].y - subJoints[0].positions[time].y,
        subJoints[1].positions[time].x - subJoints[0].positions[time].x
      );

      const theta3 = Math.atan2(
        subJoints[2].positions[time].y - subJoints[1].positions[time].y,
        subJoints[2].positions[time].x - subJoints[1].positions[time].x
      );
      const theta4 = Math.atan2(
        // Quick fix for proper sign, once loop selection is implemented, that will determine the order
        subJoints[2].positions[time].y - subJoints[3].positions[time].y,
        subJoints[2].positions[time].x - subJoints[3].positions[time].x
        // subJoints[3].positions[time].y - subJoints[2].positions[time].y,
        // subJoints[3].positions[time].x - subJoints[2].positions[time].x
      );

      // Get angular velocity for links at postions at current time interval
      const [omega3, omega4] = this.getAngularVelocities(
        r2, r3, r4,
        theta2, theta3, theta4,
        omega2
      );

      const thetas = [theta2, theta3, theta4];
      const omegas = [omega2, omega3, omega4];

      const thetaForLink = thetas[linkIndex] ?? 0;
      const omegaForLink = omegas[linkIndex] ?? 0;
      console.log("THETAS: " + thetaForLink);
      // ang_pos.push(thetaForLink);
      ang_pos.push(thetaForLink);
      ang_vel.push(omegaForLink);
      ang_acc.push(0);
    }
    return {ang: ang_pos, vel: ang_vel, acc: ang_acc};
  }

  // Calculate unknown angular velocities of a 4 bar linkage // ω2k×r2+ω3k×r3−ω4k×r4=0
  getAngularVelocities( r2: number, r3: number, r4: number, theta2: number, theta3: number, theta4: number, omega2: number ) {
    let ang_vel: number[] = [];

    // Build A matrix (2x2) for unknowns
    const A = math.matrix([ [-r3 * Math.sin(theta3), r4 * Math.sin(theta4)], [ r3 * Math.cos(theta3), -r4 * Math.cos(theta4)], ]);
    // Build right-hand side B (2x1)
    const B = math.matrix([ [ r2 * omega2 * Math.sin(theta2) ], [-r2 * omega2 * Math.cos(theta2) ], ]);

    // Solve for unknowns (system of equations)
    const sol = math.lusolve(A, B) as any;

    // get each row (0, 1) in sol matrix
    const omega3 = sol.get([0, 0]) as number;
    const omega4 = sol.get([1, 0]) as number;
    ang_vel.push(omega3);
    ang_vel.push(omega4);
    return ang_vel;
  }

  // Calculate position distance between 2 joints
  distance(a: Coord, b: Coord) {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }

}

