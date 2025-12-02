/**
 * This service is for analyzing the reaction forces and calculate the torque 
 * at the motor when the mechanism at static equilibrium
 *
 * Reading Report Year 2025-2026 Undergrad MQP to understand more about this
 *
*/

import { Injectable } from '@angular/core';
import { Joint, JointType } from '../model/joint';
import { Link, RigidBody } from '../model/link';
import { CompoundLink } from '../model/compound-link';
import { Force } from '../model/force';
import { Coord } from '../model/coord';
import { PositionSolverService } from './kinematic-solver.service';
import * as math from 'mathjs';

/**
 * Each JOINT has the directions of reaction force. The user will define which directions for those forces.
 * 
*/
export interface JointSignConvention {
    jointId: number;
    jointName: string;
    xDirection: number; // +1 or -1
    yDirection: number; // +1 or -1
}

/**
 * Each RIGID BODY (link/ compound-link) holds a list of directions of forces at each joint.
 * 
*/
export interface RigidBodySignConventions {
    rigidBodyId: number;
    rigidBodyName: string;
    jointConventions: Map<number, JointSignConvention>;
}

/**
 * Interface to store torque direction at input joint
 */
export interface TorqueSignConvention {
    inputJointId: number;
    inputJointName: string;
    torqueDirection: number; // +1 (counterclockwise) or -1 (clockwise)
}

/**
 * Enum for gravity direction options. We may use this in front end to set value for gravity.
 * For 2D planar mechanism:
 * - NegativeY, PositiveY, NegativeX, PositiveX: gravity affects force/moment calculations
 * - NegativeZ, PositiveZ: gravity exists but perpendicular to plane, so weight = 0 in calculations
 */
 export enum GravityDirection {
    NegativeY = 'NEGATIVE_Y',  // Down (0, -1) - affects calculations
    PositiveY = 'POSITIVE_Y',  // Up (0, +1) - affects calculations
    NegativeX = 'NEGATIVE_X',  // Left (-1, 0) - affects calculations
    PositiveX = 'POSITIVE_X',  // Right (+1, 0) - affects calculations
    NegativeZ = 'NEGATIVE_Z',  // Into page (0, 0) - NO effect on 2D calculations
    PositiveZ = 'POSITIVE_Z'   // Out of page (0, 0) - NO effect on 2D calculations
}

/**
 * Interface to store gravity settings for a sub-mechanism
 */
 export interface GravityConvention {
    direction: GravityDirection;
    xComponent: number;  // -1, 0, or +1
    yComponent: number;  // -1, 0, or +1
    // zComponent is not included because it doesn't effect at the end of the day
}

/**
 * This interface represent an equation. 
 * For example, sum of forces in x direction at A and B joints: Fx_A + Fx_B = 0
 * rigidId = id of the link (compound link)
 * coefficients = {(Fx_A, 1), (Fx_B, 1)}
 * constant = 0   
*/
export interface EquilibriumEquation {
    rigidId: number;
    coefficients: Map<string, number>; // variable name -> coefficient
    constant: number; // right-hand side constant
}

/* Interface to store reaction forces at a joint */
export interface ReactionForce {
    Fx: number; // x-component of reaction force
    Fy: number; // y-component of reaction force
}

/**
 * Store the solution results for a sub-mechanism
 */
 export interface StaticSolution {
    motorTorque: number;
    reactionForces: Map<number, ReactionForce>; // jointId -> reaction forces
    isValid: boolean;
    errorMessage?: string;
}

@Injectable({
    providedIn: 'root'
})
export class StaticsAnalysisService {
    private gravityMagnitude: number = 9.81; // m/s^2, can be changed if needed
    private signConventions: Map<number, RigidBodySignConventions>[] = []; // Store MANY sub-mechanism where each sub-mechanism is a Map<> storing its all rigid bodies
    private torqueConventions: TorqueSignConvention[] = []; // Store torque direction for each sub-mechanism [submechIndex]
    private freeEndJointSet: Set<Joint> = new Set<Joint>(); //list to save all the free-end Joints 
    private gravityConventions: GravityConvention[] = []; // Store gravity direction for each sub-mechanism [submechIndex]
    
    constructor(private positionSolver: PositionSolverService) {}

    /**
     * Validate a sub-mechanism before performing static analysis
     * Uses PositionSolverService validation logic
     * @param subMechanism - the sub-mechanism to validate
     * @returns true if valid for static analysis, false otherwise
     */
    private validateSubMechanism(subMechanism: Map<Joint, RigidBody[]>): boolean {
        return this.positionSolver.validateSubmechanism(subMechanism);
    }

    /**
     * Clear all sign conventions (useful when mechanism changes completely)
     * Need to clear the signConvention everytime the submechanism changed on screen (listening to stateService)
     */
     public clearSignConventions(): void {
        this.signConventions = [];
        console.log('All sign conventions cleared');
        this.freeEndJointSet.clear();
        console.log('All free-end-joint list cleared');
        this.torqueConventions = [];
        console.log('All torque conventions cleared');
        this.gravityConventions = [];
        console.log('All gravity conventions cleared');
    }

    /**
     * Initialize default sign conventions for a sub-mechanism
     * ONLY if the sub-mechanism is valid
     * Strategy: First joint in each pair gets POSITIVE, shared joints get NEGATIVE (action-reaction)
     * Free-end joints are SKIPPED (no reaction forces)
     * @param subMechanism - the sub-mechanism itself
     * @param submechIndex - index of the sub-mechanism in the mechanism
     * @returns 
     */
    public initializeSignConventions(subMechanism: Map<Joint, RigidBody[]>, submechIndex: number): boolean {
        // check if we have a valid sub-mechanism
        if (!this.validateSubMechanism(subMechanism)) {
            console.log(`Sub-Mechanism ${submechIndex} is INVALID - skipping static analysis`);
            return false;
        }
        
        //set gravity direction downward (-y) by default
        this.gravityConventions[submechIndex] = {
            direction: GravityDirection.NegativeY,
            xComponent: 0,
            yComponent: -1
        };

        console.log('Gravity was initialized as downward (-y) by default. Change it as you wish')

        const rigidBodies = this.getUniqueRigidBodies(subMechanism); 
        const visitedJoints = new Set<number>();
        const newSignConvention = new Map<number, RigidBodySignConventions>();

        const allFreeEndJoints = this.getAllFreeEndJoints(rigidBodies);
        
        allFreeEndJoints.forEach(joint => {
            this.freeEndJointSet.add(joint); // Calls 'add' once for jointD, once for jointE, etc.
        });

        const inputJoint = this.findInputJoint(subMechanism); 
        if (inputJoint) {
            this.torqueConventions[submechIndex] = {
                inputJointId: inputJoint.id,
                inputJointName: inputJoint.name,
                torqueDirection: 1 // Default positive (counterclockwise)
            };
            console.log(`Torque convention initialized for Input Joint ${inputJoint.name}: +1 (counterclockwise, default)`);
        }

        rigidBodies.forEach(rigidBody => {
            const conventions: Map<number, JointSignConvention> = new Map();
            const joints = rigidBody.getJoints();
            
            joints.forEach(joint => {
                // Skip free-end joints (not connected to anything)
                if (this.isFreeEndJoint(joint)) { // check if this is a free-end joint
                    console.log(` Joint ${joint.name} (ID: ${joint.id}) is a FREE END - SKIPPING (no reaction forces)`);
                    return; // Skip this joint
                }

                let sign = 1; // Default positive            
                if (visitedJoints.has(joint.id)) { // if it appears in other link, set reaction forces at this joint opposite
                    sign = -1;
                }

                conventions.set(joint.id, {
                    jointId: joint.id,
                    jointName: joint.name,
                    xDirection: 1*sign, 
                    yDirection: 1*sign 
                })

                visitedJoints.add(joint.id); //add to visited joint set
            });

            const rigidBodyName = rigidBody instanceof Link ? `Link ${rigidBody.name}` : `CompoundLink ${rigidBody.name}`;

            newSignConvention.set(rigidBody.id, {
                rigidBodyId: rigidBody.id,
                rigidBodyName: rigidBodyName,
                jointConventions: conventions
            });
        });

        this.signConventions[submechIndex] = newSignConvention;
        console.log(`Initialization complete for Sub-Mechanism ${submechIndex}`);
        console.log(`size of memory for sub-mechanisms array is ${this.signConventions.length}`);

        return true;
    }


    /**
     * This function is find all free-end joints in a sub-mechanism, free-end joints are the joints not connecting to any other link/ground
     * @param rigidBodies - unique rigid bodies in a sub-mechanism
     * @return a list of free-end joints
    */
    private getAllFreeEndJoints(rigidBodies: RigidBody[]): Joint[] {
        const hashMap = new Map<Joint, number>();
        const freeEndJoints: Joint[] = []

        rigidBodies.forEach((rigidBody) => {
            rigidBody.getJoints().forEach(joint => {
                const currentCount = hashMap.get(joint) ?? 0;
                hashMap.set(joint, currentCount + 1);
            })
        });

        // If the joint appears in only 1 rigid body, it's a free end.
        // Note that: even grounded joints appear only 1 in rigid body, however, always have reactions.
        for (const [joint, count] of hashMap) {
            if (count === 1 && !joint.isInput && !joint.isGrounded) {
                freeEndJoints.push(joint);
            }
        }

        return freeEndJoints;
    }

    /**
     * This is the public interface of checkFreeEndJoint() above where each 
     * free-end joint will be checked and add to the freeEndJointSet in initializeSignConventions()
     * @return true if this joint is free-end
    */
    public isFreeEndJoint(joint: Joint): boolean {
        return this.freeEndJointSet.has(joint); 
    }

    /**
     * For user to update sign convention for a specific joint in a specific rigid body
     * API for the front-end
     * Automatically updates shared joints with opposite signs (Newton's 3rd Law)
     * @param submechIndex - sub-mechanism index we want to adjust
     * @param rigidBody - any kind of RigidBody interface (which means either link or compound-link can be passed in)
     * @param joint - the joint users want to set new sign conventions
     * @param xDirection, yDirection - direction convention users want to change
     * @return true if sucessfully changed, otherwise, false
     */
    public setJointSignConvention(
        submechIndex: number,
        rigidBody: RigidBody,
        joint: Joint,
        xDirection: number,
        yDirection: number
    ): boolean {
        console.log(`Updating sign convention: RigidBody ${rigidBody.id}, Joint ${joint.id}`);

        // Validate input, make sure to get numeric value -1 or +1 from the front end
        if (xDirection !== 1 && xDirection !== -1) {
            console.error('Invalid xDirection. Must be +1 or -1');
            return false;
        }

        if (yDirection !== 1 && yDirection !== -1) {
            console.error('Invalid yDirection. Must be +1 or -1');
            return false;
        }
        
        if (this.isFreeEndJoint(joint)) { // if this joint is free-end, we cannot edit it
            console.error('cannot edit free-end joint');
            return false;
        }

        // find the corresponding rigid body (link/ compound-link)
        const rigidBodyConvention = this.signConventions[submechIndex].get(rigidBody.id); 
        
        if (!rigidBodyConvention) { //not found this rigid body in the map
            console.error(`RigidBody ${rigidBody.id} not found in signConventions map`);
            return false;
        }

        //if found, continue to set the joint convention
        const jointConvention = rigidBodyConvention.jointConventions.get(joint.id);

        if (!jointConvention) {//not found this joint in the jointConventions map of RigidBodySignConventions
            console.error(`Joint ${joint.id} not found in jointConventions`);
            return false;
        }

        // Update the joint convention
        jointConvention.xDirection = xDirection;
        jointConvention.yDirection = yDirection;

        // Re-update this joint in other rigids if there is any (shared joint)
        this.reUpdateSharedJoint(rigidBody, joint, submechIndex, xDirection, yDirection);

        console.log(` Updated: Joint ${jointConvention.jointName} in ${rigidBodyConvention.rigidBodyName}`);
        console.log(`   Fx direction: ${xDirection > 0 ? '(+)' : '(-)'}`);
        console.log(`   Fy direction: ${yDirection > 0 ? '(+)' : '(-)'}`);

        return true;
    }
    

    /**
     * This helper function updates reaction forces of the same joint (shared joint) in other rigid bodies
     * Enforces Newton's 3rd Law: action-reaction pairs must have opposite signs
     */
    public reUpdateSharedJoint(currentRigid: RigidBody, currentJoint: Joint, submechIndex: number, currentJointXDirection: number, currentJointYDirection: number): void {
        this.signConventions[submechIndex].forEach(rigidBodySignConvention => {
            if (rigidBodySignConvention.rigidBodyId !== currentRigid.id) { // if it's not the same rigid body
                const sharedJointConvention = rigidBodySignConvention.jointConventions.get(currentJoint.id);
                if (sharedJointConvention) { // this rigid must share the same current joint
                    sharedJointConvention.xDirection = -1*currentJointXDirection;
                    sharedJointConvention.yDirection = -1*currentJointYDirection;
                    console.log(`  Updated Reaction Forces For Shared Joint ${sharedJointConvention.jointName} in ${rigidBodySignConvention.rigidBodyName}`);
                    console.log(`  Fx: ${sharedJointConvention.xDirection > 0 ? '+' : '-'}, Fy: ${sharedJointConvention.yDirection > 0 ? '+' : '-'} (opposite)`);
                    
                }
            }
        });
    }

    /**
     * Get current sign convention set up for a joint in a rigid body
     */
    public getJointSignConvention(submechIndex:number, rigidBodyId: number, jointId: number): JointSignConvention | null {
        if (!this.signConventions[submechIndex]) return null;
        
        const rigidBodyConvention = this.signConventions[submechIndex].get(rigidBodyId);
        if (!rigidBodyConvention) return null;
        
        return rigidBodyConvention.jointConventions.get(jointId) || null;
    }

    /**
     * Set torque direction at the input joint
     * API for the front-end to change torque direction
     * @param submechIndex - sub-mechanism index
     * @param torqueDirection - +1 for counterclockwise (positive), -1 for clockwise (negative)
     * @returns true if successfully changed, false otherwise
     */
    public setTorqueDirection(
        submechIndex: number,
        torqueDirection: number
    ): boolean {
        console.log(`Updating torque direction for Sub-Mechanism ${submechIndex}`);

        // Validate input
        if (torqueDirection !== 1 && torqueDirection !== -1) {
            console.error('Invalid torqueDirection. Must be +1 or -1');
            return false;
        }

        // Check if sub-mechanism has torque convention initialized
        // This is another way to verify input joint, if a sub-mechanism has valid "input" joint, it would be initialized
        if (!this.torqueConventions[submechIndex]) {
            console.error(`Sub-Mechanism ${submechIndex} NOT initialized or has NO input joint`);
            return false;
        }

        // Update torque direction
        const oldDirection = this.torqueConventions[submechIndex].torqueDirection;
        this.torqueConventions[submechIndex].torqueDirection = torqueDirection;
        
        console.log(`NEW torque direction: ${torqueDirection > 0 ? '+1 (counterclockwise)' : '-1 (clockwise)'}`);
        return true;
    }

    /**
     * Get current torque direction for a sub-mechanism
     * API for getting the torques
     * @param submechIndex - sub-mechanism index
     * @returns TorqueSignConvention or null if not found
     */
    public getTorqueDirection(submechIndex: number): TorqueSignConvention | null {
        if (!this.torqueConventions[submechIndex]) {
            return null;
        }
        return this.torqueConventions[submechIndex];
    }

    /**
     * Check if a joint is the input joint in a specific sub-mechanism
     * Useful for UI to determine if torque direction option should be shown
     * @param submechIndex - sub-mechanism index
     * @param joint - the joint to check
     * @returns true if this joint is the input joint
     */
    public isInputJoint(submechIndex: number, joint: Joint): boolean {
        const torqueConv = this.torqueConventions[submechIndex];
        if (!torqueConv) return false;
        
        return torqueConv.inputJointId === joint.id;
    }


    /**
     * Set gravity direction for a sub-mechanism
     * Main API for the front-end to change gravity direction
     * Note: Z-direction means gravity is perpendicular to the 2D plane, so weight = 0 in calculations
     * @param submechIndex - sub-mechanism index
     * @param direction - GravityDirection enum value
     * @returns true if successfully changed, false otherwise
     */
    public setGravityDirection(
        submechIndex: number,
        direction: GravityDirection
    ): boolean {

        //when the memoy doesn't load it yet, this never happens but like a gatekeeper
        if (!this.gravityConventions[submechIndex]) {
            console.error(`Sub-Mechanism ${submechIndex} not initialized`);
            return false;
        }

        // const oldDirection = this.gravityConventions[submechIndex].direction;
    
        // Update gravity direction based on enum
        switch (direction) {
            case GravityDirection.NegativeY:
                this.gravityConventions[submechIndex] = {
                    direction: GravityDirection.NegativeY,
                    xComponent: 0,
                    yComponent: -1
                };
                break;
            case GravityDirection.PositiveY:
                this.gravityConventions[submechIndex] = {
                    direction: GravityDirection.PositiveY,
                    xComponent: 0,
                    yComponent: 1
                };
                break;
            case GravityDirection.NegativeX:
                this.gravityConventions[submechIndex] = {
                    direction: GravityDirection.NegativeX,
                    xComponent: -1,
                    yComponent: 0
                };
                break;
            case GravityDirection.PositiveX:
                this.gravityConventions[submechIndex] = {
                    direction: GravityDirection.PositiveX,
                    xComponent: 1,
                    yComponent: 0
                };
                break;
            case GravityDirection.NegativeZ:
                // Gravity into page - perpendicular to 2D plane, no effect on calculations
                this.gravityConventions[submechIndex] = {
                    direction: GravityDirection.NegativeZ,
                    xComponent: 0,
                    yComponent: 0
                };
                break;
            case GravityDirection.PositiveZ:
                // Gravity out of page - perpendicular to 2D plane, no effect on calculations (x and y component = 0)
                this.gravityConventions[submechIndex] = {
                    direction: GravityDirection.PositiveZ,
                    xComponent: 0,
                    yComponent: 0
                };
                break;
            default:
                console.error('Invalid gravity direction');
                return false;
        }


        console.log(`Gravity direction updated for Sub-Mechanism ${submechIndex}`);
        // console.log(`   Old: ${oldDirection}`);
        // console.log(`   New: ${direction}`);
        return true;
    }

    /**
     * Get current gravity convention for a sub-mechanism
     * @param submechIndex - sub-mechanism index
     * @returns GravityConvention or null if not found
     */
    public getGravityConvention(submechIndex: number): GravityConvention | null {
        if (!this.gravityConventions[submechIndex]) {
            return null;
        }
        return this.gravityConventions[submechIndex];
    }


    /**
     * Print all current sign conventions to console
     * JUST FOR TESTING, WILL DELETE IT IN OFFICIAL VERSION
     */
    public printSignConventions(submechIndex: number): void {
        const torqueConv = this.torqueConventions[submechIndex]; //get torqueConvention

        const gravityConv = this.gravityConventions[submechIndex];
            if (gravityConv) {
                console.log(` GRAVITY for Sub-Mechanism ${submechIndex}:`);
                console.log(`   Direction: ${gravityConv.direction}`);
                console.log(`   Components: (${gravityConv.xComponent}, ${gravityConv.yComponent}) × ${this.gravityMagnitude} m/s^2`);
            }

        this.signConventions[submechIndex].forEach(rigidbodyConv => {
            console.log(`${rigidbodyConv.rigidBodyName}:`);

            rigidbodyConv.jointConventions.forEach(jointConv => {
                console.log(`  Joint ${jointConv.jointName}:`);
                console.log(`    Fx: ${jointConv.xDirection > 0 ? '(+)' : '(-)'}`);
                console.log(`    Fy: ${jointConv.yDirection > 0 ? '(+)' : '(-)'}`);
                if(torqueConv && torqueConv.inputJointName === jointConv.jointName) {
                    console.log(`TORQUE at ${torqueConv.inputJointName}: ${torqueConv.torqueDirection > 0 ? '+1 (counterclockwise)' : '-1 (clockwise)'}`);
                }
            });
        });
    }

    /**
     *  JUST FOR TESTING, WILL DELETE IT IN OFFICIAL VERSION
    */
    public testPrintJointsForces(subMechanisms: Map<Joint, RigidBody[]>[]): void { 
        subMechanisms.forEach((subMechanism, index) => {
            let isValid = true;

            //only initialize when the we don't have signConvention yet         
            if (this.signConventions.length > 0) {
                //skip
            } else {
                isValid = this.initializeSignConventions(subMechanism, index);
            }   

            if (isValid) {
                this.printSignConventions(index);
                const solution = this.solveSubMechanism(subMechanism, index);

                console.log(`Torque at motor = ${solution.motorTorque} (Nm)`);
                solution.reactionForces.forEach((recforce, id) => {
                    console.log(`   Fx_${id} = ${recforce.Fx} (N) & Fy_${id} = ${recforce.Fy} (N)`);
                })
            } else {
                console.log(`Skipping Sub-Mechanism ${index} (invalid for static analysis)\n`);
            }
        })
    }


    /**
     * Find the input (motor) joint in the sub-mechanism
     * @params : a sub-mechanism
     * @return : input joint (joint with motor)
     */ 
    public findInputJoint(subMechanism: Map<Joint, RigidBody[]>): Joint | null {
        for (const joint of subMechanism.keys()) {
            if (joint.isInput) {
                return joint;
            }
        }

        return null
    }

    /**
     * Get unique links from a sub-mechanism (avoiding duplicates)
     * --- try to print out using "console.log('sub-mechanisms: ', subMechanisms);" for method getSubMechanisms() in mechanism.ts to understand more why we need this function
     * @params : a sub-mechanism
     * @return : an array of unique links/compound-link (rigidBody) in a sub-mechanism
     */
    private getUniqueRigidBodies(subMechanism: Map<Joint, RigidBody[]>): RigidBody[] {
        const rigidBodySet = new Set<RigidBody>();
        
        subMechanism.forEach((rigidBodies)=>{ // for each value in Map (here is RigidBody[])
            rigidBodies.forEach((rigidBody)=>{ // loop through RigidBody[]
                rigidBodySet.add(rigidBody);
            })
        })

        return Array.from(rigidBodySet);
    }   


    /**
     * Set gravity constant (default is 9.81 m/s^2)
     */
     public setGravity(g: number): void {
        this.gravityMagnitude = g;
        console.log(`Gravity set to ${g} m/s²`);
    }

    /**
     * Get current gravity setting
     */
    public getGravity(): number {
        return this.gravityMagnitude;
    }


    /**
     * Solve static equilibrium for ONE single sub-mechanism
     * @param subMechanism - the sub-mechanism to solve
     * @param submechIndex - index of the sub-mechanism
     * @returns StaticSolution
     */
    public solveSubMechanism(
        subMechanism: Map<Joint, RigidBody[]>, 
        submechIndex: number
    ): StaticSolution {
        const inputJoint = this.findInputJoint(subMechanism);
        if (!inputJoint) {
            console.log('input joint is not identified');
            if (!inputJoint) {
                return {
                    motorTorque: 0,
                    reactionForces: new Map(),
                    isValid: false,
                    errorMessage: 'No input joint found'
                };
            }
        }

        //get all unique rigid body in sub-mechanism
        const rigidBodies = this.getUniqueRigidBodies(subMechanism);
        console.log('number of rigid body: ', rigidBodies.length);

        // build equilibirum equations for each body
        const equations: EquilibriumEquation[] = [];
        const variableList: string[] = []; // Ordered list of variables, it's easier for reference later to see what variable we need to calculate

        rigidBodies.forEach((rigidBody, bodyIndex) => {
            const bodyName = rigidBody instanceof Link ? `Link ${rigidBody.name}` : `CompoundLink ${rigidBody.name}`;
            console.log(bodyName + " equation : ");
            
            const bodyEquations = this.buildRigidBodyEquations(rigidBody, submechIndex, inputJoint, variableList);
            equations.push(...bodyEquations);

            for (const bodyEquation of bodyEquations) {
                let equationStr = ``;
                for (const [varName, coefficient] of bodyEquation.coefficients) {
                    equationStr += `${coefficient}*${varName} + `;
                }
                equationStr += ` = ${bodyEquation.constant}`;
                console.log("   ", equationStr);
            }
        });

        const solution = this.solveMatrixEquation(equations, variableList, inputJoint, submechIndex);

        return solution;
    }


    /**
     * The idea is we will use this one combine with other ones to feed into matrix later.
     * Build the 3 equilibrium equations for ONLY ONE single rigid body (ONE Link or ONE CompoundLink):
     * Equation 1: ΣFx = 0
     * Equation 2: ΣFy = 0
     * Equation 3: ΣM = 0 (Moments about center of mass = 0)
     */

    private buildRigidBodyEquations(
        rigidBody: RigidBody,
        submechIndex: number,
        inputJoint: Joint,
        variableList: string[]
    ): EquilibriumEquation[] {
        const equations: EquilibriumEquation[] = [];
        const joints = rigidBody.getJoints(); // array of joint from one rigid body (like a link or a compoundLink)
        const CoM = rigidBody.centerOfMass; 
        const mass = rigidBody.mass;
        const forces = this.getAllForcesOnRigidBody(rigidBody); //extract all forces if exist from a rigid body

        // console.log(`  Joints: ${joints.map(j => j.name).join(', ')}`);
        // console.log(`  Mass: ${mass} kg`);
        // console.log(`  COM: (${CoM.x.toFixed(3)}, ${CoM.y.toFixed(3)})`);


        //Extract gravitational force (Fg) component in a rigid
        const gravityForce = this.getGravityForceComponents(submechIndex, mass);
        const Fg_x = gravityForce ? gravityForce.Fx : 0; // if z-direction, no effect on 2D so assign 0
        const Fg_y = gravityForce ? gravityForce.Fy : 0; // if z-direction, no effect on 2D so assign 0

        // if (gravityForce) {
        //     console.log(`  Gravity Force: Fg_x = ${Fg_x.toFixed(3)} N, Fg_y = ${Fg_y.toFixed(3)} N`);
        // } else {
        //     console.log(`  Gravity Force: 0 (Z-direction, no effect on 2D)`);
        // }

        //Equation 1: ΣFx = 0
        const fxEquation: EquilibriumEquation = {
            rigidId: rigidBody.id,
            coefficients: new Map(),
            constant: -Fg_x // Move gravity to RHS: ΣFx = -Fg_x => ΣFx + Fg_x = 0
        };

        //Equation 2: ΣFy = 0 
        const fyEquation: EquilibriumEquation = {
            rigidId: rigidBody.id,
            coefficients: new Map(),
            constant: -Fg_y  // Move gravity to RHS: ΣFy = -Fg_y => ΣFy + Fg_y = 0
        };

        // Equation 3: ΣM = 0 (about center of mass)
        // Note: Gravity acts at COM, so it produces NO moment about COM
        const momentEquation: EquilibriumEquation = {
            rigidId: rigidBody.id,
            coefficients: new Map(),
            constant: 0
        };

        // Get sign conventions for this rigid body (Map of jointConventions where save conventions for each joint)
        const rbConvention = this.signConventions[submechIndex].get(rigidBody.id);
        if (!rbConvention) {
            throw new Error(`Sign convention not found for rigid body ${rigidBody.id}`);
        }
        
        joints.forEach((joint) => {
            // Skip free-end joints
            if (this.isFreeEndJoint(joint)) {
                console.log(` Joint ${joint.name}: FREE-END JOINT - skipping`);
                return;
            }

            // Create unique name for each reaction force based on its Id
            const rxVar = `Fx_${joint.id}`; // reaction force on x direction of a joint, e.g. rx_A of joint A
            const ryVar = `Fy_${joint.id}`; // reaction force on y direction of a joint, e.g. ry_A of joint A

            // Get the sign convention for this joint
            const jointConv = rbConvention.jointConventions.get(joint.id);
            if (!jointConv) {
                throw new Error(`Sign convention not found for joint ${joint.id}`);
            }

            //Extract sign convention for each Reaction Force
            const xSign = jointConv.xDirection;
            const ySign = jointConv.yDirection; 

            // Add variables to list if not already present
            if (!variableList.includes(rxVar)) {
                variableList.push(rxVar);
            }
            if (!variableList.includes(ryVar)) {
                variableList.push(ryVar);
            }

            // Add to force equations with sign conventions
            fxEquation.coefficients.set(rxVar, xSign);
            fyEquation.coefficients.set(ryVar, ySign);

            // Calculate moment for this link from this joint. We want to calculate moment about center of mass, so every joint will contribute to this moment.
            // Add to moment equation (r × F) at a joint
            const r = joint.coords.subtract(CoM); // Position vector from COM to this joint. E.g. joint(13, 14) and CoM(10, 10) => r = joint - CoM = (13 - 10)i^ + (14 - 10)j^ = 3i^ + 4j^
            
            // Moment (r × F) = r_x * Fy - r_y * Fx (2D cross product, positive counter-clockwise). Note: F here is reaction force
            // -> r_x is coefficient of Fy and (-r_y) is coefficient of Fx
            momentEquation.coefficients.set(rxVar, xSign * (-r.y));
            momentEquation.coefficients.set(ryVar, ySign * r.x);
        });

        // Add applied forces from the rigid body if exist
        // For forces in CompoundLink, we need to iterate through all links in that CompoundLink
        forces.forEach(force => {
            const fx = force.calculateXComp();
            const fy = force.calculateYComp();

            // console.log(` Applied Force ${force.name}: Fx=${fx.toFixed(3)} N, Fy=${fy.toFixed(3)} N`);

            // Add to constants (move to RHS)
            fxEquation.constant -= fx;
            fyEquation.constant -= fy;

            // Add moment contribution
            const r = force.start.subtract(CoM);
            const moment = r.x * fy - r.y * fx; // constant
            momentEquation.constant -= moment;
        });

        //if this rigidBody is connected to a input joint (motor), we need to add this motor torque
        // can change the "name" to "id" if needed
        if (joints.includes(inputJoint)) {
            const torqueVar = `T_motor`;

            // Add torque variable if not already present
            if (!variableList.includes(torqueVar)) {
                variableList.push(torqueVar);
            }

            // Get torque sign convention
            const torqueConv = this.torqueConventions[submechIndex];
            const torqueSign = torqueConv ? torqueConv.torqueDirection : 1; // torque direction by default is 1

            momentEquation.coefficients.set(torqueVar, torqueSign);
            // console.log(`  Motor torque added: sign = ${torqueSign > 0 ? '+' : '-'}`);
        }

        equations.push(fxEquation, fyEquation, momentEquation);
        return equations;
    }


    /**
     * Helper function to get gravity force components for a rigid body in a sub-mechanism
     * Returns the x and y components of gravitational force based on mass and direction that user picked 
     * @param submechIndex - sub-mechanism index
     * @param mass - mass of the rigid body
     * @returns object with Fx and Fy gravity components, or null if not initialized
     */
    public getGravityForceComponents(submechIndex: number, mass: number): { Fx: number, Fy: number } | null {
        const gravityConv = this.gravityConventions[submechIndex];
        if (!gravityConv) {
            return null;
        }

        const gravityForce = mass * this.gravityMagnitude; // mass * 9.81 m/s^2

        return {
            Fx: gravityConv.xComponent * gravityForce,
            Fy: gravityConv.yComponent * gravityForce
        };
    }


    private getAllForcesOnRigidBody(rigidBody: RigidBody): Force[] {
        const forces: Force[] = [];
        
        if (rigidBody instanceof Link) {
            // For a simple Link, get forces directly
            rigidBody.forces.forEach(force => forces.push(force));
        } else if (rigidBody instanceof CompoundLink) { // MAYBE take a look at this idea again
            rigidBody.links.forEach(link =>{
                link.forces.forEach(force => forces.push(force));
            });
        }

        if (forces.length > 0) { // print test
            console.log(`forces for link: ${rigidBody.name}`, forces);
        }
        
        return forces;
    }


    /**
     * Convert equilibrium equations to matrix form [A]{x} = {b} and solve using mathjs
     * @param equations - array of EquilibriumEquation
     * @param variableList - ordered list of variable names
     * @param inputJoint - the input joint (for extracting motor torque)
     * @param submechIndex - sub-mechanism index
     * @returns StaticSolution
     */
    private solveMatrixEquation(
        equations: EquilibriumEquation[],
        variableList: string[],
        inputJoint: Joint,
        submechIndex: number
    ): StaticSolution {

        const n = equations.length; // row for matrix
        const m = variableList.length; //column for matrix
 
        // "m" unknowns will need "n" equations
        if (n !== m) {
            return {
                motorTorque: 0,
                reactionForces: new Map(),
                isValid: false,
                errorMessage: `System is ${n > m ? 'over' : 'under'}-determined (${n} equations, ${m} unknowns)`
            };
        }

        // build coefficient matrix A and constant vector B
        const A: number[][] = [];
        const b: number[] = [];

        equations.forEach(eq => { 
            const row: number[] = [];
            variableList.forEach(varName => {
                const coeff = eq.coefficients.get(varName)
                row.push(coeff || 0);
            })
            A.push(row);
            b.push(eq.constant);
        })

        // Print matrix for debugging
        console.log('Coefficient Matrix [A]:');
        A.forEach((row, i) => {
            console.log(`  [${row.map(v => v.toFixed(3).padStart(8)).join(', ')}]`);
        });
        console.log('Constant Vector {B}:');
        console.log(`  [${b.map(v => v.toFixed(3).padStart(8)).join(', ')}]`);

        // Make sure no internal errors happen when using math.js
        try {
            // solving matrix using A*x = B
            // we create matrix in order of variableList for each variable before, so the returned solution will follow this order too.
            const solution = math.lusolve(A, b) as number[][]; //it will return an array of arrays, make sure to override the "any" type with "number"[][] becuase we know it should appear that way, so we can use "map" syntax for next line
            const solutionVector = solution.map(row => row[0]); //flatten into one array

            // // Test result
            // console.log('\nSolution Vector {x}:');
            // variableList.forEach((varName, i) => {
            //     console.log(`  ${varName} = ${solutionVector[i].toFixed(6)}`);
            // });

            // Extract motor torque:
            // motor torque = 0 if we cannot find in result array
            const torqueIndex = variableList.indexOf('T_motor');
            const motorTorque = torqueIndex >= 0 ? solutionVector[torqueIndex] : 0; 
            
            // Extract reaction forces
            const reactionForces = new Map<number, ReactionForce>();
            const jointIds = new Set<number>();

            // Collect all joint IDs from variable names
            variableList.forEach(varName => {
                if (varName.startsWith('Fx_') || varName.startsWith('Fy_')) {
                    const jointId = parseInt(varName.split('_')[1]);
                    jointIds.add(jointId);
                }
            });

            // Build reaction force map
            jointIds.forEach(jointId => {
                const rxVar = `Fx_${jointId}`;
                const ryVar = `Fy_${jointId}`;
                const rxIndex = variableList.indexOf(rxVar);
                const ryIndex = variableList.indexOf(ryVar);

                reactionForces.set(jointId, { // reaction forces result at each joint
                    Fx: rxIndex >= 0 ? solutionVector[rxIndex] : 0,
                    Fy: ryIndex >= 0 ? solutionVector[ryIndex] : 0
                });
            });

            return {
                motorTorque,
                reactionForces,
                isValid: true
            };
        } catch (error: any) {
            return {
                motorTorque: 0,
                reactionForces: new Map(),
                isValid: false,
                errorMessage: `Matrix solution failed: ${error.message}`
            };
        }
        
    }
}   