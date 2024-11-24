import { Injectable } from '@angular/core';
import { StateService } from './state.service';
import { Joint, JointType } from '../model/joint';
import { Link, RigidBody } from '../model/link';
import { Coord } from '../model/coord';
import {join} from "@angular/compiler-cli";
import { BehaviorSubject } from 'rxjs';


export enum SolveType {
    Ground,
    CircleCircle,
    CircleLine,
    RevoluteInput,
    PrismaticInput,
}
export interface SolvePrerequisite {
    jointToSolve: Joint;
    solveType: SolveType;
    knownJointOne?: Joint;
    distFromKnownJointOne?: number;
    knownJointTwo?: Joint;
    distFromKnownJointTwo?: number;

}

export interface AnimationPositions {
  correspondingJoints: number[],
  positions: Coord[][];
}

export interface SolveOrder {
    order: number[],
    prerequisites: Map<number, SolvePrerequisite>,
}


@Injectable({
    providedIn: 'root'
})
export class PositionSolverService {

    private animationPositions: AnimationPositions[] = new Array();
    private solveOrders: SolveOrder[] = new Array();
    private animationsChange: BehaviorSubject<AnimationPositions[]> = new BehaviorSubject<AnimationPositions[]>(this.animationPositions);
    public animationsChange$ = this.animationsChange.asObservable();

    constructor(private stateService: StateService) {
        console.log("kinematics constructor");
        this.solvePositions();
        this.stateService.getMechanismObservable().subscribe(updatedMechanism => {
            this.solvePositions();
        });

    }
    public getKinematicsObservable(){
        return this.animationsChange$;
    }

    getAnimationFrames(): AnimationPositions[]{
        return this.animationPositions;
    }
    getSolveOrders(): SolveOrder[]{
        return this.solveOrders;
    }

    solvePositions(){
        //first get the list of submechanisms to collect positions independently
        const subMechanisms: Map<Joint, RigidBody[]>[] = this.stateService.getMechanism().getSubMechanisms();

        //second, determine which submechanisms are valid and can be simulated
        const validMechanisms: Map<Joint, RigidBody[]>[] = this.getValidMechanisms(subMechanisms);

        //third determine solve order.
        this.updateSolveOrders(validMechanisms);

        //fourth, solve for all of the possible positions for each mechanism.
        this.updateAnimationPositions();

        this.animationsChange.next(this.animationPositions);
    }



    getValidMechanisms(subMechanisms: Map<Joint, RigidBody[]>[]): Map<Joint, RigidBody[]>[] {
        const validMechanisms: Map<Joint, RigidBody[]>[] = new Array();
        //second, determine which submechanisms are valid and can be simulated
        for (let subMechanism of subMechanisms) {
            if (this.isValidMechanism(subMechanism)) {
                validMechanisms.push(subMechanism);
            }
        }
        return validMechanisms;
    }

    updateSolveOrders(mechanisms: Map<Joint, RigidBody[]>[]) {
        this.solveOrders = new Array();
        for (let subMechanism of mechanisms) {
            this.solveOrders.push(this.determineSolveOrder(subMechanism))
        }
    }

    updateAnimationPositions() {
      this.animationPositions = new Array();
      for (let solveOrder of this.solveOrders) {
        this.animationPositions.push({correspondingJoints: solveOrder.order, positions: this.getPositions(solveOrder.order, solveOrder.prerequisites)})
      }
    }

    private isValidMechanism(subMechanism: Map<Joint, RigidBody[]>): boolean {
        //ensure only one input is present and grounded
        let inputJoint: Joint | null = this.getValidInputs(subMechanism);
        if (inputJoint == null) {
            return false;
        }
        //ensure the DOF is also 1.
        let degreesOfFreedom: number = this.getDegreesOfFreedom(subMechanism);
        if (degreesOfFreedom != 1) {
            return false;
        }
        //ensure the minimum viable loop is met.
        let minDistanceFromGround: number = this.minDistanceFromGround(inputJoint!, subMechanism);
        if (minDistanceFromGround != 4) {
            return false;
        }
        return true;
    }

    private getValidInputs(subMechanism: Map<Joint, RigidBody[]>): Joint | null {
        let isValid = true;
        let numberOfInputs = 0;
        let inputJoint: Joint;
        for (let joint of subMechanism.keys()) {
            if (joint.isInput) {
                inputJoint = joint;
                numberOfInputs++;
                if (joint.isGrounded == false) {
                    return null;
                }
            }
        }
        if (numberOfInputs != 1) {
            return null;
        }
        return inputJoint!;
    }


    //Kutzback equation  + Grubler's Equation
    private getDegreesOfFreedom(subMechanism: Map<Joint, RigidBody[]>): number {
        let N: number = 0; // number of links
        let J: number = 0; //counting full pair connections
        let links: Set<RigidBody> = new Set();
        for (let joint of subMechanism.keys()) {
            for (let rigidBody of subMechanism.get(joint)!) {
                links.add(rigidBody);
            }
            switch (joint.type) {
                case JointType.Revolute:
                    J += subMechanism.get(joint)!.length - 1;
                    if (joint.isGrounded) {
                        J += 1;
                    }
                    break;
                case JointType.Prismatic:
                    N += 1;
                    J += subMechanism.get(joint)!.length + 1;
                    break;
            }
        }
        N += links.size + 1; // +1 accounts for ground that is assumed
        console.log(`N = ${N}, J = ${J}`);
        return 3 * (N - 1) - 2 * J; //
    }


    private minDistanceFromGround(input: Joint, subMechanism: Map<Joint, RigidBody[]>, visitedJoints: number[] = new Array()): number {
        visitedJoints.push(input.id);
        let prismaticAddOne = input.type == JointType.Prismatic ? 2 : 1;
        if (input.isGrounded && !input.isInput) {
            return prismaticAddOne;
        }
        let min = Number.MAX_VALUE;
        let connectedJoints: Set<Joint> = this.getUnseenNeighbors(subMechanism.get(input)!, visitedJoints);

        for (let joint of connectedJoints) {
            let minFromJoint = this.minDistanceFromGround(joint, subMechanism, Array.from(visitedJoints));
            if (minFromJoint + prismaticAddOne < min) {
                min = minFromJoint + prismaticAddOne;
            }
        }
        return min;
    }

    private getUnseenNeighbors(links: RigidBody[], visitedJoints: number[]): Set<Joint>{
        let unseenNeighbors: Set<Joint> = new Set();
        for (let rigidBody of links!) {
            for (let joint of rigidBody.getJoints()) {
                if (!visitedJoints.includes(joint.id)) {
                    unseenNeighbors.add(joint);
                }
            }
        }
        return unseenNeighbors;
    }


    private determineSolveOrder(subMechanism: Map<Joint, RigidBody[]>): SolveOrder {
        let solveMap: Map<number, SolvePrerequisite> = new Map();
        let solveOrder: number[] = new Array();
        let unsolvedJoints: Joint[] = new Array();

      //iterate over joints, adding grounded joints to be solved first (since their position doesn't change)
        for (let joint of subMechanism.keys()) {
            if (joint.isGrounded && !joint.isInput && joint.type != JointType.Prismatic) {

                solveMap.set(joint.id, { jointToSolve: joint, solveType: SolveType.Ground } as SolvePrerequisite);

                solveOrder.push(joint.id);
            } else if (joint.isGrounded && joint.isInput) {
                //input is always first.
                if (joint.type == JointType.Prismatic) {
                    solveMap.set(joint.id, { jointToSolve: joint, solveType: SolveType.PrismaticInput } as SolvePrerequisite);
                } else {
                    solveMap.set(joint.id, { jointToSolve: joint, solveType: SolveType.Ground } as SolvePrerequisite);
                }
                solveOrder.unshift(joint.id)
            } else {
                unsolvedJoints.push(joint);
            }
        }
        //continue to iterate until all joints are solved
        while (unsolvedJoints.length > 0) {
            //pop joint off the front of the array and check if it can be solved
            let currentJoint = unsolvedJoints.shift()!;
            let canBeSolved = this.jointCanBeSolved(currentJoint, subMechanism.get(currentJoint)!, solveOrder)
            if (canBeSolved != null) {
                //if an object is returned, add to order and map.
                solveOrder.push(currentJoint.id);
                solveMap.set(currentJoint.id, canBeSolved);

            } else {
                //append to the end of the array
                unsolvedJoints.push(currentJoint);
            }
        }
        return { order: solveOrder, prerequisites: solveMap } as SolveOrder;
    }

    private jointCanBeSolved(joint: Joint, links: RigidBody[], solvedJoints: number[]): SolvePrerequisite | undefined {
        let canBeSolved = undefined;
        let solveType: SolveType | undefined;
        let knownJointOne: Joint | undefined;
        let distFromKnownJointOne: number | undefined;
        let knownJointOneType: JointType | undefined;
        //loop through all neighboring joints, if they are solved determine solve type
        for (let link of links) {
            for (let neighbor of link.getJoints()) {
                if (solvedJoints.includes(neighbor.id)) {
                    //if they are a revolute input we can solve immediately and return
                    if (neighbor.isInput && neighbor.type != JointType.Prismatic) {
                        return {
                            jointToSolve: joint,
                            solveType: SolveType.RevoluteInput,
                            knownJointOne: neighbor,
                            distFromKnownJointOne: joint.coords.getDistanceTo(neighbor._coords)
                        } as SolvePrerequisite
                    } else {
                        //if it is not an input but is known, we can solve if one other is known.
                        if (knownJointOne == undefined) {
                            knownJointOne = neighbor;
                            distFromKnownJointOne = joint._coords.getDistanceTo(neighbor._coords);
                            knownJointOneType = neighbor.type;
                            if (joint.type == JointType.Prismatic) {
                                return {
                                    jointToSolve: joint,
                                    solveType: SolveType.CircleLine,
                                    knownJointOne: knownJointOne,
                                    distFromKnownJointOne: distFromKnownJointOne,
                                } as SolvePrerequisite
                            }
                        } else {
                            return {
                                jointToSolve: joint,
                                solveType: SolveType.CircleCircle,
                                knownJointOne: knownJointOne,
                                distFromKnownJointOne: distFromKnownJointOne,
                                knownJointTwo: neighbor,
                                distFromKnownJointTwo: joint._coords.getDistanceTo(neighbor._coords)
                            } as SolvePrerequisite
                        }
                    }
                }

            }
        }
        return canBeSolved;
    }

    private getPositions(solveOrder: number[], solveMap: Map<number, SolvePrerequisite>): Coord[][] {
        let currentTimeStep: number = 0;
        let movingForward: number = 1;
        let stuckcounter: number = 0;
        let positions: Coord[][] = new Array();
        /**
         * 2D positions array represents the following
         * [[j1n,j2n,j3n,j4n],           //positions [j1..jx] are the positions of joints 0..x at timestep n
         *  [j1n+1,j2n+1,j3n+1,j4n+1]
         * ]
         */
        let startingPositions: Coord[] = new Array();
        for (let id of solveOrder) {
            startingPositions.push(solveMap.get(id)!.jointToSolve._coords)
        }
        positions.push(startingPositions);


        while (!(movingForward > 0 && this.returnedToStart(positions) && currentTimeStep != 0) && stuckcounter < 5 && currentTimeStep < 720) {
            let nextPositions: Coord[] = new Array();
            for (let i = 0; i < solveOrder.length; i++) {
                let nextJointPosition = this.solveNextJointPosition(positions[currentTimeStep], solveOrder, solveMap.get(solveOrder[i])!, movingForward, nextPositions);
                //if we get a calculated position, add to the list
                if (nextJointPosition) {
                    nextPositions.push(nextJointPosition);
                } else {
                    //switch directions if we reach a toggle point
                    movingForward *= -1;
                    stuckcounter++;
                    console.log(`Swapped Directions`);
                    break;
                }
            }
            //if we received all the positions we expected, add to the list and continue
            if (nextPositions.length == positions[0].length) {
                positions.push(nextPositions);
                currentTimeStep++;

            }

        }
        return positions;
    }


    returnedToStart(positions: Coord[][]): boolean {
        let haveReturned = true;
        let startingPositions: Coord[] = positions[0];
        let currentPositions: Coord[] = positions[positions.length - 1];
        for (let i = 0; i < startingPositions.length; i++) {
            let sameX: boolean = Math.abs(startingPositions[i].x - currentPositions[i].x) < 0.001;
            let sameY: boolean = Math.abs(startingPositions[i].y - currentPositions[i].y) < 0.001;
            if (!sameX || !sameY) {
                haveReturned = false;
            }
        }
        return haveReturned;


    }

    private solveNextJointPosition(prevPositions: Coord[], solveOrder: number[], solvePrerequisite: SolvePrerequisite, movingForward: number, nextPositions: Coord[]): Coord | undefined {
        switch (solvePrerequisite.solveType) {
            case SolveType.Ground:
                return solvePrerequisite.jointToSolve._coords;
                break;

            case SolveType.RevoluteInput:
                return this.solveRevInput(prevPositions, solveOrder, solvePrerequisite, movingForward);
                break;

            case SolveType.PrismaticInput:
                return this.solvePrisInput(prevPositions, solveOrder, solvePrerequisite, movingForward);
                break;
            case SolveType.CircleCircle:
                return this.solveCircleCircle(prevPositions, solveOrder, solvePrerequisite, movingForward, nextPositions);

                break;
            case SolveType.CircleLine:
                console.log("Solving Circle Line");
                return this.solveCircleLine(prevPositions, solveOrder, solvePrerequisite, movingForward, nextPositions);
                break;

        }
        return undefined;
    }

    private solveRevInput(prevPositions: Coord[], solveOrder: number[], solvePrerequisite: SolvePrerequisite, movingForward: number): Coord | undefined {
        let prevPosition: Coord = prevPositions[solveOrder.indexOf(solvePrerequisite.jointToSolve.id)];
        let inputPosition: Coord = solvePrerequisite.knownJointOne!._coords;
        const radius = solvePrerequisite.distFromKnownJointOne!
        const increment: number = solvePrerequisite.knownJointOne!.inputSpeed * movingForward > 0 ? Math.PI / 180 : -Math.PI / 180;
        const angle: number = Math.atan2(prevPosition.y - inputPosition.y, prevPosition.x - inputPosition.x);
        const x = Math.cos(angle + increment) * radius + inputPosition.x;
        const y = Math.sin(angle + increment) * radius + inputPosition.y;
        return new Coord(x, y);
    }



    private solvePrisInput(prevPositions: Coord[], solveOrder: number[], solvePrerequisite: SolvePrerequisite, movingForward: number): Coord | undefined {
        let input = solvePrerequisite.jointToSolve;
        let prevPosition: Coord = prevPositions[solveOrder.indexOf(input.id)];
        const increment: number = (input.inputSpeed * movingForward) > 0 ? 0.05 : -0.05;
        const angle: number = input.angle;
        const x = prevPosition.x + increment * Math.cos(angle);
        const y = prevPosition.y + increment * Math.sin(angle);
        return new Coord(x, y);
    }


    private solveCircleCircle(prevPositions: Coord[], solveOrder: number[], solvePrerequisite: SolvePrerequisite, movingForward: number, nextPositions: Coord[]): Coord | undefined {

        //get the two circle intersection points using the most recent calculated positions of the prerequisite joints
        const intersectionPoints: Coord[] | undefined = this.circleCircleIntersection(nextPositions[solveOrder.indexOf(solvePrerequisite.knownJointOne!.id)!].x,
            nextPositions[solveOrder.indexOf(solvePrerequisite.knownJointOne!.id)!].y,
            solvePrerequisite.distFromKnownJointOne!,
            nextPositions[solveOrder.indexOf(solvePrerequisite.knownJointTwo!.id)!].x,
            nextPositions[solveOrder.indexOf(solvePrerequisite.knownJointTwo!.id)!].y,
            solvePrerequisite.distFromKnownJointTwo!);
        if (!intersectionPoints) {
            return undefined;
        }
        if (intersectionPoints.length == 1) {
            return intersectionPoints[0];
        }
        //if we have two options, determine the closer one.
        const jointToSolveLastPosition: Coord = prevPositions[solveOrder.indexOf(solvePrerequisite.jointToSolve.id)]
        const intersection1Diff = Math.abs(
            Math.sqrt(
                Math.pow(intersectionPoints[0].x - jointToSolveLastPosition.x, 2) + Math.pow(intersectionPoints[0].y - jointToSolveLastPosition.y, 2)
            )
        );
        const intersection2Diff = Math.abs(
            Math.sqrt(
                Math.pow(intersectionPoints[1].x - jointToSolveLastPosition.x, 2) + Math.pow(intersectionPoints[1].y - jointToSolveLastPosition.y, 2)
            )
        );

        return intersection1Diff < intersection2Diff ? intersectionPoints[0] : intersectionPoints[1];
    }

    private circleCircleIntersection(firstKnownJointX: number, firstKnownJointY: number, distFromFirstJoint: number, secondKnownJointX: number, secondKnownJointY: number, distFromSecondJoint: number
    ): Coord[] | undefined {
        let xDiffBetweenKnowns = secondKnownJointX - firstKnownJointX;
        let yDiffBetweenKnowns = secondKnownJointY - firstKnownJointY;
        const differenceBetweenKnowns = Math.sqrt(xDiffBetweenKnowns * xDiffBetweenKnowns + yDiffBetweenKnowns * yDiffBetweenKnowns);
        // Circles too far apart
        if (differenceBetweenKnowns > distFromFirstJoint + distFromSecondJoint) {
            return undefined;
        }
        // One circle completely inside the other
        if (differenceBetweenKnowns < Math.abs(distFromFirstJoint - distFromSecondJoint)) {
            return undefined;
        }
        //tolerance
        if (differenceBetweenKnowns <= 0.0001) {
            return undefined;
        }

        xDiffBetweenKnowns /= differenceBetweenKnowns;
        yDiffBetweenKnowns /= differenceBetweenKnowns;

        const a = (distFromFirstJoint * distFromFirstJoint - distFromSecondJoint * distFromSecondJoint + differenceBetweenKnowns * differenceBetweenKnowns) / (2 * differenceBetweenKnowns);
        const px = firstKnownJointX + a * xDiffBetweenKnowns;
        const py = firstKnownJointY + a * yDiffBetweenKnowns;

        const h = Math.sqrt(distFromFirstJoint * distFromFirstJoint - a * a);

        const p1x = px + h * yDiffBetweenKnowns;
        const p1y = py - h * xDiffBetweenKnowns;
        const p2x = px - h * yDiffBetweenKnowns;
        const p2y = py + h * xDiffBetweenKnowns;
        return [new Coord(p1x, p1y), new Coord(p2x, p2y)];
    }


    private solveCircleLine(prevPositions: Coord[], solveOrder: number[], solvePrerequisite: SolvePrerequisite, movingForward: number, nextPositions: Coord[]): Coord | undefined {
        // circle: (x - h)^2 + (y - k)^2 = r^2
        // line: y = m * x + n
        // r: circle radius
        // h: x value of circle centre
        // k: y value of circle centre
        // m: slope
        // n: y-intercept
        let x = null;
        let y = null;
        const r = solvePrerequisite.distFromKnownJointOne!;
        const h = nextPositions[solveOrder.indexOf(solvePrerequisite.knownJointOne!.id)!].x;
        const k = nextPositions[solveOrder.indexOf(solvePrerequisite.knownJointOne!.id)!].y;

        let m = Math.tan(solvePrerequisite.jointToSolve!.angle * Math.PI / 180);
        if (m > 1000 || m < -1000) {
            m = Number.MAX_VALUE;
        }
        const prevJointPosition: Coord = prevPositions[solveOrder.indexOf(solvePrerequisite.jointToSolve.id)];
        const n = solvePrerequisite.jointToSolve!.coords.y - m * prevPositions[solveOrder.indexOf(solvePrerequisite.jointToSolve.id)].x;
        // get a, b, c values
        const a = 1 + Math.pow(m, 2);
        const b = -h * 2 + m * (n - k) * 2;
        const c = Math.pow(h, 2) + Math.pow(n - k, 2) - Math.pow(r, 2);
        // get discriminant
        const d = Math.pow(b, 2) - 4 * a * c;


        //if discriminant is too big or not a number, use alternative method
        if (isNaN(d) || !isFinite(d)) {
            let temp_a: number = 1;
            let temp_b: number = -2 * solvePrerequisite.knownJointOne!._coords.y;
            let temp_c: number = Math.pow(solvePrerequisite.knownJointOne!._coords.y, 2) + Math.pow(solvePrerequisite.knownJointOne!._coords.x - prevJointPosition.x, 2) - Math.pow(r, 2);;
            let temp_d: number = Math.pow(temp_b, 2) - 4 * temp_a * temp_c;
            if (temp_d < 0) {
                return undefined;
            }
            const y_1 = (-temp_b + Math.sqrt(Math.pow(temp_b, 2) - 4 * temp_a * temp_c)) / (2 * temp_a);
            const y_2 = (-temp_b - Math.sqrt(Math.pow(temp_b, 2) - 4 * temp_a * temp_c)) / (2 * temp_a);
            if (Math.abs(prevJointPosition.y - y_1) <= Math.abs(prevJointPosition.y - y_2)) {
                y = y_1;
            } else {
                y = y_2;
            }
            x = prevJointPosition.x;
            //if discriminant is normal, calculate intersection points and return closest.
        } else {
            if (d >= 0) {
                const x_1 = (-b + Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a);
                const y_1 = m * x_1 + n;
                const x_2 = (-b - Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a);
                const y_2 = m * x_2 + n;
                const intersectionPoints: Coord[] = [new Coord(x_1, y_1), new Coord(x_2, y_2)];

                const intersection1Diff = Math.sqrt(
                    Math.pow(x_1 - prevJointPosition.x, 2) +
                    Math.pow(y_1 - prevJointPosition.y, 2)
                );
                const intersection2Diff = Math.sqrt(
                    Math.pow(x_2 - prevJointPosition.x, 2) +
                    Math.pow(y_2 - prevJointPosition.y, 2)
                );
                if (intersection1Diff < intersection2Diff) {
                    x = intersectionPoints[0].x;
                    y = intersectionPoints[0].y;
                }
            } else {
                return undefined;
            }
        }

        //return next position
        if (x != null && y != null) {
            return new Coord(x, y);
        } else {
            return undefined;
        }
    }

  public getAnimationPositions(): Coord[][] {
    return this.animationPositions.flatMap(entry => entry.positions);
  }

}



