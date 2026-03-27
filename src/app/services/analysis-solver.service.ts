import { Injectable } from '@angular/core';
import { Coord } from '../model/coord';
import { PositionSolverService, SolveOrder, SolvePrerequisite, SolveType } from './kinematic-solver.service';
import { AnimationPositions } from './kinematic-solver.service';
import { StateService } from './state.service';
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


@Injectable({
    providedIn: 'root'
})
export class AnalysisSolveService {

    private solveOrders: SolveOrder[] = [];
    private jointPositions: AnimationPositions[] = [];
    private jointKinematics: Map<number, JointAnalysis> = new Map();

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
        const velocityTheta = omega > 0 ? angleToInput - Math.PI / 2 : angleToInput + Math.PI / 2; //Velocity direction
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
        let angle_solutions: { ang: number[], vel: number[], acc: number[] } = this.getLinkAngularSolutions(subJoints);
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
        console.log("sub-joint length: ", subJoints[0].positions.length);
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

    // Calculates angular positions, velocities, and accelerations for a link using two joint-level kinematic analyses.
    getLinkAngularSolutions(subJoints: JointAnalysis[]) {
        let ang_pos: number[] = [];
        let ang_vel: number[] = [];
        let ang_acc: number[] = [];
        for (let time = 0; time < subJoints[0].positions.length; time++) {
            let x_diff_pos: number = subJoints[1].positions[time].x - subJoints[0].positions[time].x;
            let y_diff_pos: number = subJoints[1].positions[time].y - subJoints[0].positions[time].y;
            let ang: number = Math.atan2(y_diff_pos, x_diff_pos);
            let x_diff_vel: number = subJoints[1].velocities[time].x - subJoints[0].velocities[time].x;
            let y_diff_vel: number = subJoints[1].velocities[time].y - subJoints[0].velocities[time].y;
            let V_BA: number = Math.sqrt(Math.pow(x_diff_vel, 2) + Math.pow(y_diff_vel, 2));
            let R_BA: number = Math.sqrt(Math.pow(x_diff_pos, 2) + Math.pow(y_diff_pos, 2));
            let vel: number = V_BA / R_BA;
            let x_diff_acc: number = subJoints[1].accelerations[time].x - subJoints[0].accelerations[time].x;
            let y_diff_acc: number = subJoints[1].accelerations[time].y - subJoints[0].accelerations[time].y;
            let A_BA: number = Math.sqrt(Math.pow(x_diff_acc, 2) + Math.pow(y_diff_acc, 2));
            let acc: number = A_BA / R_BA;
            ang_pos.push(ang);
            ang_vel.push(vel);
            ang_acc.push(acc);
        }
        return { ang: ang_pos, vel: ang_vel, acc: ang_acc };
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
