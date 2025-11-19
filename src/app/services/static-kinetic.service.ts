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
 * Each Joint has the directions of reaction force. The user will define which directions for those forces.
 * 
*/
export interface JointSignConvention {
    jointId: number;
    jointName: string;
    xDirection: number; // +1 or -1
    yDirection: number; // +1 or -1
}

/**
 * Each Rigid body (link/ compound-link) holds a list of directions of forces at each joint.
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
    rigidId: number;
    jointId: number;
    Fx: number; // x-component of reaction force
    Fy: number; // y-component of reaction force
}

@Injectable({
    providedIn: 'root'
})
export class StaticKineticService {
    private gravity: number = 9.81; // m/s^2, need to recalculate this later to match with cm/m system
    private signConventions: Map<number, RigidBodySignConventions>[] = []; // Store MANY sub-mechanism where each sub-mechanism is a Map<> storing its all rigid bodies
    private torqueConventions: TorqueSignConvention[] = []; // Store torque direction for each sub-mechanism [submechIndex]
    private freeEndJointList: Joint[] = []; //list to save all the free-end Joints 

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
        this.freeEndJointList = [];
        console.log('All free-end-joint list cleared');
        this.torqueConventions = [];
        console.log('All torque conventions cleared');
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
        
        const rigidBodies = this.getUniqueRigidBodies(subMechanism); 
        const visitedJoints = new Set<number>();
        const newSignConvention = new Map<number, RigidBodySignConventions>();

        const allFreeEndJoints = this.getAllFreeEndJoints(rigidBodies);
        this.freeEndJointList.push(...allFreeEndJoints); //find all the free-end joints in a mechanism

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
     * free-end joint will be checked and add to the freeEndJointList in initializeSignConventions()
     * @return true if this joint is free-end
    */
    public isFreeEndJoint(joint: Joint): boolean {
        return this.freeEndJointList.includes(joint); 
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
     * Get current sign convention for a joint in a rigid body
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
     * Print all current sign conventions to console
     * JUST FOR TESTING, WILL DELETE IT IN OFFICIAL VERSION
     */
    public printSignConventions(submechIndex: number): void {
        const torqueConv = this.torqueConventions[submechIndex]; //get torqueConvention

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
            const isValid = this.initializeSignConventions(subMechanism, index);
            
            if (isValid) {
                this.printSignConventions(index);
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
}