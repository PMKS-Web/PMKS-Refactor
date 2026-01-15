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
import { Force, ForceFrame } from '../model/force';
import { Coord } from '../model/coord';
import { AnimationPositions, PositionSolverService } from './kinematic-solver.service';
import * as math from 'mathjs';
import { link } from 'd3-shape';

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
 * For example, if we want a gravity upward => {direction: GravityDirection.PositiveY, xComponent: 0, yComponent: 1}
 */
 export interface GravityConvention {
    direction: GravityDirection;
    xComponent: number;  // -1, 0, or +1
    yComponent: number;  // -1, 0, or +1
    // zComponent is not included because it doesn't effect at the end of the day
}

/**
 * Enum for pivot point options. Pivot point is the point that user cn choose to calculate moment
 */
 export enum PivotPoint {
    CenterOfMass = 'CENTER_OF_MASS',
    Joint = 'JOINT'
}

/**
 * Interface to store pivot point selection for a rigid body
 */
export interface PivotPointConvention {
    rigidBodyId: number;
    pivotType: PivotPoint;
    jointId?: number; // Only used if pivotType is Joint
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
 * Store the solution results for a sub-mechanism at only one timestep 
 */
 export interface StaticSolution {
    motorTorque: number;
    reactionForces: Map<number, ReactionForce>; // jointId -> reaction forces
    isValid: boolean;
    errorMessage?: string;
}


//----- These interfaces below will be for calculating Forces at each timestep in the animation, we will have 360 timestep for the animation.
/**
 * Metadata about a force, cached once at t=0
 * This data never changes and describes the force's relationship to its parent link
 * 
 * Extracted from the live Force object to avoid mutation during analysis
 */
interface ForceMeta {
    forceId: number;
    forceName: string;
    parentLinkId: number;
    
    // Force magnitude (never changes)
    magnitude: number;  // Newtons (N)
    
    // Position of force application point relative to link's COM
    // Stored in polar coordinates relative to the link's reference frame
    posInLink: [number, number];  // [distance, angleInRadians]
    // posInLink[0] = distance from COM to force start point (scalar)
    // posInLink[1] = angle from COM to force start (radians, in link's original frame)
    
    // Angle of force direction relative to link's orientation
    relativeAngle: number;  // degrees (force angle - link angle at t=0)
    
    // Frame of reference determines how force direction behaves
    frameOfReference: ForceFrame;  // Local (rotates with link) or Global (fixed in world)
    
    // For Global frame forces: store the absolute angle at t=0
    absoluteAngleAtT0: number;  // degrees (only used if frameOfReference === Global)
}

/**
 * Computed force data at a specific timestep (when t != 0)
 * This is recalculated for each frame without mutating any live objects
 */
 interface ForceAtTimestep {
    // Application point (where force is applied on the link)
    start: Coord;  // Force start position at this timestep
    
    // Force components at this timestep
    fx: number;  // X-component in Newtons (N)
    fy: number;  // Y-component in Newtons (N)
    
    // Force properties at this timestep (for debugging/visualization)
    magnitude: number;  // Same as ForceMeta.magnitude (doesn't change)
    angleAtTimestep: number;  // Force direction at this timestep (degrees)
}


@Injectable({
    providedIn: 'root'
})
export class StaticsAnalysisService {
    private gravityMagnitude: number = 9.81; // m/s^2, can be changed if needed

    private signConventions: Map<number, RigidBodySignConventions>[] = []; // Store MANY sub-mechanism where each sub-mechanism is a Map <rigidBodyId, RigidBodySignConventions> storing its all rigid bodies
    private torqueConventions: TorqueSignConvention[] = []; // Store torque direction for each sub-mechanism [submechIndex]
    private freeEndJointSet: Set<Joint> = new Set<Joint>(); //list to save all the free-end Joints 
    private gravityConventions: GravityConvention[] = []; // Store gravity direction for each sub-mechanism [submechIndex]
    private pivotPointConventions: Map<number, PivotPointConvention>[] = []; // pivotPointConventions[submechIndex] = Map<rigidBodyId, PivotPointConvention>. Every sub-mechanism will use one Map<..>, if we have 2 sub-mechanism on the screen, we will have 2 element for this array and each Map will be for one sub-mechanism.

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
        this.pivotPointConventions = [];
        console.log('All pivot point conventions cleared');
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
        
        // Initialize pivot point conventions for all rigid bodies (default: at Center of Mass)
        const newPivotPointConvention = new Map<number, PivotPointConvention>();

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
            
            // save the sign convention into the Map
            newSignConvention.set(rigidBody.id, {
                rigidBodyId: rigidBody.id,
                rigidBodyName: rigidBodyName,
                jointConventions: conventions
            });

            // save the pivot point convention into the Map (center of mass by default)
            newPivotPointConvention.set(rigidBody.id, {
                rigidBodyId: rigidBody.id,
                pivotType: PivotPoint.CenterOfMass
            });
        });

        this.signConventions[submechIndex] = newSignConvention;
        this.pivotPointConventions[submechIndex] = newPivotPointConvention;

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
     * Set pivot point for moment calculation for a specific rigid body
     * Main API for the front-end
     * Note that we have to use PivotPoint enum to set for pivot type
     * 
     * @param submechIndex - sub-mechanism index
     * @param rigidBody - the rigid body (Link or CompoundLink)
     * @param pivotType - PivotPoint enum (CenterOfMass or Joint)
     * @param joint - if pivotType is Joint, specify which joint (optional for CenterOfMass)
     * @returns true if successfully changed, false otherwise
     */
    public setPivotPoint(
        submechIndex: number,
        rigidBody: RigidBody,
        pivotType: PivotPoint,
        joint?: Joint
    ): boolean {
        // console.log(`Updating pivot point for RigidBody ${rigidBody.id} in Sub-Mechanism ${submechIndex}`);

        // Check if sub-mechanism has pivot conventions initialized
        if (!this.pivotPointConventions[submechIndex]) {
            console.error(`Sub-Mechanism ${submechIndex} not initialized`);
            return false;
        }

        // Validate if Joint is pivot, user must provide a joint
        if (pivotType === PivotPoint.Joint && !joint) {
            console.error('Please provide a joint when using Joint pivot type!');
            return false;
        }

        // Validate if Joint is pivot, joint must belong to this rigid body
        if (pivotType === PivotPoint.Joint && joint) {
            const rigidBodyJoints = rigidBody.getJoints();
            if (!rigidBodyJoints.some(j => j.id === joint.id)) { // this is hard to happen but we still need to check
                console.error(`Joint ${joint.name} (ID ${joint.id}) does not belong to this rigid body`);
                return false;
            }

            // Cannot use free-end joint as pivot
            if (this.isFreeEndJoint(joint)) {
                console.error(`Cannot use free-end joint ${joint.name} as pivot point`);
                return false;
            }
        }

        // Will DELETE this later, this is just for testing by printing out
        const rigidBodyName = rigidBody instanceof Link ? `Link ${rigidBody.name}` : `CompoundLink ${rigidBody.name}`;

        const oldConvention = this.pivotPointConventions[submechIndex].get(rigidBody.id);
        const oldPivotLabel = oldConvention 
            ? (oldConvention.pivotType === PivotPoint.CenterOfMass 
                ? 'Center of Mass' 
                : `Joint ID ${oldConvention.jointId}`)
            : 'Unknown';

        // Update pivot point convention
        if (pivotType === PivotPoint.CenterOfMass) {
            this.pivotPointConventions[submechIndex].set(rigidBody.id, {
                rigidBodyId: rigidBody.id,
                pivotType: PivotPoint.CenterOfMass
            });
            console.log(`Pivot point updated for ${rigidBodyName}`);
            console.log(`>> Old: ${oldPivotLabel}`);
            console.log(`>> New: Center of Mass`);
        } else {
            this.pivotPointConventions[submechIndex].set(rigidBody.id, {
                rigidBodyId: rigidBody.id,
                pivotType: PivotPoint.Joint,
                jointId: joint!.id
            });
            console.log(`Pivot point updated for ${rigidBodyName}`);
            console.log(`>> Old: ${oldPivotLabel}`);
            console.log(`>> New: Joint ${joint!.name} (ID ${joint!.id})`);
        }

        return true;
    }

    /**
     * Get current pivot point convention for a rigid body
     * @param submechIndex - sub-mechanism index
     * @param rigidBodyId - rigid body ID
     * @returns PivotPointConvention or null if not found
     */
    public getPivotPoint(submechIndex: number, rigidBodyId: number): PivotPointConvention | null {
        if (!this.pivotPointConventions[submechIndex]) {
            return null;
        }
        return this.pivotPointConventions[submechIndex].get(rigidBodyId) || null;
    }

    /**
     * Get the coordinate of the pivot point in a rigid body
     * @param rigidBody - the rigid body
     * @param pivotConvention - the pivot point convention
     * @returns Coord of the pivot point
     */
    private getPivotCoordinate(rigidBody: RigidBody, pivotConvention: PivotPointConvention): Coord {
        if (pivotConvention.pivotType === PivotPoint.CenterOfMass) {
            return rigidBody.centerOfMass;
        } else {
            // Find the pivot joint in the rigid body
            const joints = rigidBody.getJoints();
            const pivotJoint = joints.find(j => j.id === pivotConvention.jointId);
            
            if (!pivotJoint) { // if the pivot joint is not valid
                throw new Error(`Pivot joint ${pivotConvention.jointId} not found in rigid body`);
            }
            
            return pivotJoint.coords;
        }
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
            if (!this.signConventions[index]) {
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

    //Delete this later
    public useGetUniqueBody(subMechanism: Map<Joint, RigidBody[]>):RigidBody[] {
        return this.getUniqueRigidBodies(subMechanism);
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

        const solution = this.solveMatrixEquation(equations, variableList);

        return solution;
    }


    /**
     * The idea is we will use this function to build equilibrium equations for EACH rigid body to feed into matrix later
     * This function will build the 3 equilibrium equations for ONLY ONE SINGLE RIGID body (ONE Link or ONE CompoundLink):
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

        // Identify the pivot point for this rigid
        const pivotConvention = this.pivotPointConventions[submechIndex].get(rigidBody.id);
        if (!pivotConvention) {
            throw new Error(`pivot convention not found for rigid body ${rigidBody.id}`);
        }

        // extract the coordinate of the pivot point
        const pivotPointCoord = this.getPivotCoordinate(rigidBody, pivotConvention);

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
            constant: -Fg_x // Move gravity to RHS: ΣFx + Fg_x = 0 => ΣFx = -Fg_x
        };

        //Equation 2: ΣFy = 0 
        const fyEquation: EquilibriumEquation = {
            rigidId: rigidBody.id,
            coefficients: new Map(),
            constant: -Fg_y  // Move gravity to RHS: ΣFy + Fg_y = 0 => ΣFy = -Fg_y 
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
        
        // MAIN LOGIC for putting coeffecients of each Joints in this ONE Rigid Body into the 3 equations ΣFx = 0, ΣFy = 0 and ΣM = 0
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

            // Add variables to list if not already present, we will use this list for setting up matrix later
            if (!variableList.includes(rxVar)) {
                variableList.push(rxVar);
            }
            if (!variableList.includes(ryVar)) {
                variableList.push(ryVar);
            }

            // Add to force equations with sign conventions
            fxEquation.coefficients.set(rxVar, xSign);
            fyEquation.coefficients.set(ryVar, ySign);

            // Calculate moment for this link from this joint. We want to calculate moment about the pivot point, so every joint will contribute to this moment.
            // Add to moment equation (r × F) at a joint
            const r = joint.coords.subtract(pivotPointCoord); // Position vector from COM to this joint. E.g. joint(13, 14) and CoM(10, 10) => r = joint - CoM = (13 - 10)i^ + (14 - 10)j^ = 3i^ + 4j^
            
            const r_magnitude = Math.sqrt(r.x * r.x + r.y * r.y);
            
            // check to see if this Joint is Pivot Point, if it is, the result will be < 1e-6 and we can skip adding the Forces components into Moment Equation for this Joint
            if(r_magnitude > 1e-6) {
                // Moment (r × F) = r_x * Fy - r_y * Fx (2D cross product, positive counter-clockwise). Note: F here is reaction force
                // -> r_x is coefficient of Fy and (-r_y) is coefficient of Fx
                momentEquation.coefficients.set(rxVar, xSign * (-r.y));
                momentEquation.coefficients.set(ryVar, ySign * r.x);
            }     
        });

        // Add applied forces from the rigid body if exist
        // For forces in CompoundLink, we need to iterate through all links in that CompoundLink
        if (forces) {
            forces.forEach(force => {
                const fx = force.calculateXComp();
                const fy = force.calculateYComp();
    
                // console.log(` Applied Force ${force.name}: Fx=${fx.toFixed(3)} N, Fy=${fy.toFixed(3)} N`);
    
                // Add to constants (move to RHS)
                fxEquation.constant -= fx;
                fyEquation.constant -= fy;
                
                // Add moment contribution
                const r = force.start.subtract(pivotPointCoord);
                // Check if force is applied at pivot point
                const r_magnitude = Math.sqrt(r.x * r.x + r.y * r.y);

                if(r_magnitude > 1e-6) {
                    const moment = r.x * fy - r.y * fx; // constant
                    momentEquation.constant -= moment;
                } 
            });
        } else {
            console.log('NO External Forces Found')
        }

        // Check if gravity effect calculation, only the pivot point at the Joint will affect make the gravity affect in the calculation
        // IMPORTANT: Gravity acts at CENTER OF MASS, so we need r from PIVOT POINT to CoM
        if (this.doesGravityAffectCalculations(submechIndex)) {
            const gravityForce = this.getGravityForceComponents(submechIndex, mass);
            if (gravityForce) {
                const Fg_x = gravityForce.Fx;
                const Fg_y = gravityForce.Fy;
                
                // r from pivot point to center of mass
                const r_gravity = CoM.subtract(pivotPointCoord);
                const r_magnitude = Math.sqrt(r_gravity.x * r_gravity.x + r_gravity.y * r_gravity.y);

                // Check if COM is very close to pivot
                if (r_magnitude > 1e-6) {
                    const moment_gravity = r_gravity.x * Fg_y - r_gravity.y * Fg_x;   
                    momentEquation.constant -= moment_gravity;
                    console.log(`  Gravity moment about pivot: ${moment_gravity.toFixed(6)} N⋅m`);
                }    
            }
        }
        
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
            const torqueSign = torqueConv ? torqueConv.torqueDirection : 1; // torque direction by default is +1

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

        // gravitational force doesn't have angle, it's basically up, down, left or right based on the user. So the formula will be simple.
        return {
            Fx: gravityConv.xComponent * gravityForce,
            Fy: gravityConv.yComponent * gravityForce
        };
    }

    /**
     * Check if gravity affects the 2D calculations for a sub-mechanism
     * Z-direction gravity does NOT affect calculation because we work with 2D planar
     * @param submechIndex - sub-mechanism index
     * @returns true if gravity affects calculations, false if Z-direction (no effect)
     */
    public doesGravityAffectCalculations(submechIndex: number): boolean {
        //extract gravity convention
        const gravityConv = this.gravityConventions[submechIndex];
        if (!gravityConv) {
            return false;
        }
        
        // Z-direction means gravity is perpendicular to 2D plane, therefore, no affect and return false
        return gravityConv.direction !== GravityDirection.NegativeZ && gravityConv.direction !== GravityDirection.PositiveZ;
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


    // ---------------- ANALYSIS AT DIFFERENT TIMESTEP ------------------

    public solveAllTimesteps(
        subMechanisms: Map<Joint, RigidBody[]>[],
        submechIndex: number
    ) : StaticSolution[] {  
        // one sub-mechanism
        const subMechanism = subMechanisms[submechIndex];
        
        // Get all unique rigid bodies
        const uniqueRigidBodies = this.getUniqueRigidBodies(subMechanism);

        // Each rigid body will have none, one or more than one applied forces (applied forces are created by pull, push,... NOT gravitational force)
        // We need an array to save the applied forces for each link
        // We need a map to save each array above according to rigid body (link)'s id
        const cachedForcesMetaMap = new Map<number, ForceMeta[]>(); 
        uniqueRigidBodies.forEach( rigidBody => {
            const cachedForcesMeta = this.cacheAllForcesMetaForRigidBody(rigidBody);
            cachedForcesMetaMap.set(rigidBody.id, cachedForcesMeta);
        });

        // Get input joint for this sub-mechanism
        const inputJoint = this.findInputJoint(subMechanism);

        // Get animation frames from position solver (recommend to print it out to see)
        const animationFrames = this.positionSolver.getAnimationFrames();
        // console.log(animationFrames)

        // Check animation frames for this sub-mechanism
        if (!animationFrames[submechIndex]) {
            console.error(`No animation frames found for submechanism ${submechIndex}`);
            return [];
        }

        // animationFrames[submechIndex] is an AnimationPositions object, please check kinematic-solver.service.ts
        const animationData = animationFrames[submechIndex];
        const allPositions = animationData.positions;  // 2D array: positions[timestep][jointIndex]
        const jointIDs = animationData.correspondingJoints;  // array of joint IDs

        const rigidBodyCOMAllTimestep: Map<number, Coord>[] = []; // This is Array of Map <rigidID, Coord>, index of Array will equal timestep "t", basically this array will have length of 360 cells equal to the timestep we have. E.g. [Map, Map, Map,...] each Map saves COM of all rigid bodies at that timestep. 

        const solutions: StaticSolution[] = [];

        console.log(`Analyzing ${allPositions.length} timesteps for submechanism ${submechIndex}`);
        console.log(`Joint IDs order: ${jointIDs}`);

        // Solve for each timestep
        for (let t = 0; t < allPositions.length; t++) {
            const positionCoordsAtTimeT = allPositions[t];  // Array of Coord of all Joints in this sub-mechanism for this timestep
            
            const positionMap = new Map<number, Coord>(); // Map of positions by JointID <JointID, Coord> of this sub-mechanism at this timestep t
            
            for(let i = 0; i < jointIDs.length; i++) { // load data into position map
                positionMap.set(jointIDs[i], positionCoordsAtTimeT[i]);
            }

            this.findAndLoadDataForCOMAtTimestep(uniqueRigidBodies, positionMap, rigidBodyCOMAllTimestep, t); //update data for rigidBodyCOMAllTimestep array

            // After data updated for position of COM for all rigid bodies at this timestep t from function above
            // => extract that data
            const rigidBodyCOMMap = rigidBodyCOMAllTimestep[t];

            const solution = this.solveSubMechanismAtTimestep(
                submechIndex,
                inputJoint,
                uniqueRigidBodies,
                positionMap,
                rigidBodyCOMMap,
                cachedForcesMetaMap
            );
            solutions.push(solution);
        }
    
        return solutions;

    } 


    private findAndLoadDataForCOMAtTimestep(
        uniqueRigidBodies: RigidBody[], // list of unique rigid bodies in a submechanism
        positionMap: Map<number, Coord>,
        rigidBodyCOMAllTimestep: Map<number, Coord>[],
        timeStep: number
    ) : void {
        // Solve by circle-circle technique
        if (timeStep === 0) { // initial position, COM position is where it is because no movement yet
            const rigidBodyCOMMap: Map<number, Coord> = new Map(); // map to save each rigid body's COM coordinates
            uniqueRigidBodies.forEach(rb =>{ // just update the map
                rigidBodyCOMMap.set(rb.id, rb.centerOfMass);
            })

            rigidBodyCOMAllTimestep.push(rigidBodyCOMMap); // push to the global array for this time step t = 0
        } else { // if timeStep > 0, animation moving
            const rigidBodyCOMMap: Map<number, Coord> = new Map(); // new map to save new COM position
            const prevMap = rigidBodyCOMAllTimestep[timeStep - 1]; // retrieve previous Map from global Array of COM by timestep
            
            if (!prevMap) { //saefety check
              console.warn('Missing previous COM map at t=', timeStep);
              return;
            }

            uniqueRigidBodies.forEach(rb=>{ // find new COM for each rigid and save it to 
                const rb_COM = this.getCenterOfMassAtTimestepSol2 (rb, positionMap, prevMap);
                if (rb_COM) {
                    rigidBodyCOMMap.set(rb.id, rb_COM); // add to the map
                } else {
                    console.log('Body ', rb, ' missing COM at timestep = ', timeStep);
                }
                
            })

            rigidBodyCOMAllTimestep.push(rigidBodyCOMMap); // push to the global array for this time step
        }
    }


    public solveSubMechanismAtTimestep(
        submechIndex: number,
        inputJoint: Joint | null, // inputJoint is where motor locates
        uniqueRigidBodies: RigidBody[], // list of unique rigid bodies in a submechanism
        positionMap: Map<number, Coord>,
        rigidBodyCOMMap: Map<number, Coord>, // COM map for all rigid bodies in this submechanism
        cachedForcesMetaMap: Map<number, ForceMeta[]> 
    ): StaticSolution {
        // const inputJoint = this.findInputJoint(subMechanism);
        
        // check input
        if (!inputJoint) {
            return {
                motorTorque: 0,
                reactionForces: new Map(),
                isValid: false,
                errorMessage: 'No input joint found'
            };
        }

        // Create position map for this timestep 
        // jointIDs[i] corresponds to positionCoordsAtTimeT[i]. This is quite hard to imagine, you may have to print it out with console.log("animation frame: ", this.jointPositions) in updateKinematics() in analysis-solver.service.ts
        // const positionMap = new Map<number, Coord>(); //pair of <JointID, Coord> for all joints of submechanism at this timestep t
        // for(let i = 0; i < jointIDs.length; i++) {
        //     positionMap.set(jointIDs[i], positionCoordsAtTimeT[i]);
        // }

        // Build equilibrium equations using positions from this timestep
        const equations: EquilibriumEquation[] = [];
        const variableList: string[] = [];

        uniqueRigidBodies.forEach((rigidBody) => {
            const COMAtT = rigidBodyCOMMap.get(rigidBody.id); // get COM for a rigid body
            const cachedForcesMeta = cachedForcesMetaMap.get(rigidBody.id);
            const bodyEquations = this.buildRigidBodyEquationsAtTimestep(
                rigidBody,
                submechIndex,
                inputJoint,
                variableList,
                positionMap,
                COMAtT,
                cachedForcesMeta
            );
            equations.push(...bodyEquations); // ALL equation for whole mechanism
        });
    
        const solution = this.solveMatrixEquation(equations, variableList);
        
        return solution;
    }


    // This is just print testing, DELETE it later --------------
    public printTestForCOM(
        subMechanism: Map<Joint, RigidBody[]>[],
        submechIndex: number,
    ): void {
        // Get all unique rigid bodies
        const rigidBodies = this.getUniqueRigidBodies(subMechanism[submechIndex]);

        // Get animation frames from position solver (recommend to print it out to see)
        const animationFrames: AnimationPositions[] = this.positionSolver.getAnimationFrames();
        // console.log(animationFrames)

        // Check animation frames for this sub-mechanism
        if (!animationFrames[submechIndex]) {
            console.error(`No animation frames found for submechanism ${submechIndex}`);
            return;
        }

        // animationFrames[submechIndex] is an AnimationPositions object, please check kinematic-solver.service.ts
        const animationData = animationFrames[submechIndex];
        const allPositions = animationData.positions;  // 2D array: positions[timestep][jointIndex]
        const jointIDs = animationData.correspondingJoints;  // array of joint IDs

        const COMAtAllFrame : Coord [][] = [];
        const rigidBodyCOMByTimestep: Map<number, Coord>[] = []; // This is Array of Map <rigidID, Coord>, index of Array will equal timestep "t", basically this array will have length of 360 cells equal to the timestep we have. E.g. [Map, Map, Map,...] each Map saves COM of all rigid bodies at that timestep. 

        // Solve for each timestep
        for (let t = 0; t < allPositions.length; t++) {
            const positionCoordsAtTimeT = allPositions[t];  // Array of Coord of all Joints in this sub-mechanism for this timestep
            
            const COMInSubmech: Coord[] = [];
     
            const positionMap = new Map<number, Coord>(); //pair of <JointID, Coord> at this timestep t
            
            for(let i = 0; i < jointIDs.length; i++) {
                positionMap.set(jointIDs[i], positionCoordsAtTimeT[i]);
            }

            // // SOLUTION 1: Solve by rotation matrix
            // rigidBodies.forEach(rb => {
            //     const rb_COM = this.getCenterOfMassAtTimestepSol1 (rb, positionMap);
            //     if (rb_COM) COMInSubmech.push(rb_COM); //push all center of mass of each body in this submechanism in th end 
            //     else console.log('Body ', rb, ' missing COM at timestep = ', t);
            // })

            // COMAtAllFrame.push(COMInSubmech);

            // SOLUTION 2: Solve by circle-circle technique
            if (t === 0) { // initial position, COM position is where it is because no movement yet
                const rigidBodyCOMMap: Map<number, Coord> = new Map(); // map to save each rigid body's COM coordinates
                rigidBodies.forEach(rb =>{ // just update the map
                    rigidBodyCOMMap.set(rb.id, rb.centerOfMass);
                })

                rigidBodyCOMByTimestep.push(rigidBodyCOMMap); // push to the global array for this time step t = 0
            } else { // if t > 0, animation moving
                const rigidBodyCOMMap: Map<number, Coord> = new Map(); // new map to save new COM position
                const prevMap = rigidBodyCOMByTimestep[t - 1]; // retrieve previous Map from global Array of COM by timestep
                
                if (!prevMap) { //saefety check
                  console.warn('Missing previous COM map at t=', t);
                  return;
                }

                rigidBodies.forEach(rb=>{ // find new COM for each rigid and save it to 
                    const rb_COM = this.getCenterOfMassAtTimestepSol2 (rb, positionMap, prevMap);
                    if (rb_COM) {
                        rigidBodyCOMMap.set(rb.id, rb_COM); // add to the map
                    } else {
                        console.log('Body ', rb, ' missing COM at timestep = ', t);
                    }
                    
                })

                rigidBodyCOMByTimestep.push(rigidBodyCOMMap); // push to the global array for this time step
            }
        }
        console.log('all position: ', allPositions);
        console.log('COM in all frame using rotation matrix: ', COMAtAllFrame);
        console.log('COM in using Circle-Cirle technique: ', rigidBodyCOMByTimestep);
    }


    // SOLUTION 1: Using matrix rotation
    // calculate center of mass at time-step.
    private getCenterOfMassAtTimestepSol1(
        rigidBody: RigidBody,
        positionMap: Map<number, Coord>
    ): Coord | undefined {
        if (rigidBody instanceof Link) {
            return this.calculateLinkCOMAtTimestepSol1(rigidBody, positionMap);
        } else if (rigidBody instanceof CompoundLink) {
            return this.calculateCompoundLinkCOMAtTimestepSol1(rigidBody, positionMap);
        }
        
        return rigidBody.centerOfMass;
    }

    // calculate link's CoM
    private calculateLinkCOMAtTimestepSol1(
        link: Link,
        positionMap: Map<number, Coord>
    ): Coord | undefined {
        const joints = link.getJoints();

        if (joints.length < 2) {
            return undefined;
        }

        return this.transformCOMUsingRotationMatrix(link, positionMap);
    }

    // Compute: new center of mass poition in new frame at timestep t, using rigid body transformation
    // Read this in report MQP 25-26
    private transformCOMUsingRotationMatrix (
        rigidBody: RigidBody,
        positionMap: Map<number, Coord>
    ): Coord | undefined {
        const joints = rigidBody.getJoints();

        if (joints.length < 2) {
            return rigidBody.centerOfMass;
        }

        // Reference points: use any two joints at t = 0
        const joint1 = joints[0];
        const joint2 = joints[1];

        // Coordinates from those joints above and COM, I use 'A' and 'B' to represent for coordinates of Joint1 and Joint2 above.
        const A = joint1.coords;
        const B = joint2.coords;
        const COM = rigidBody.centerOfMass; // center of mass at t = 0 (initial)

        // New points at new frame (at t > 0)  
        const A_prime = positionMap.get(joint1.id) ?? A;
        const B_prime = positionMap.get(joint2.id) ?? B;

        // compute vector
        const u = B.subtract(A); // original orientation vector
        const v = B_prime.subtract(A_prime); // new orientation vector

        // compute vector magnitude
        const u_magnitude = Math.sqrt(u.x * u.x + u.y * u.y);
        const v_magnitude = Math.sqrt(v.x * v.x + v.y * v.y);

        if (u_magnitude < 1e-10 || v_magnitude < 1e-10) {
            console.warn('Joints too close together for rotation matrix calculation');
            return rigidBody.centerOfMass;
        }


        // normalize vector
        const u_norm = new Coord(u.x / u_magnitude, u.y / u_magnitude);
        const v_norm = new Coord(v.x / v_magnitude, v.y / v_magnitude);

        // Compute rotation matrix components
        // c = cos(theta) = dot(u, v) / (|u| |v|) = (u_norm) (v_norm)
        // s = sin(theta) = cross(u, v) / (|u| |v|) = (u_norm) x (v_norm)
        const c = u_norm.x * v_norm.x + u_norm.y * v_norm.y;  // dot product
        const s = u_norm.x * v_norm.y - u_norm.y * v_norm.x;  // cross product (2D)

        // Rotation matrix R = [[c, -s],
        //                      [s,  c]]
        // To calculate new COM': COM' = A' + R(COM - A)
        
        // First, calculate the relative distance from center of mass to A which is (COM - A) from the formula above
        const COM_rel = COM.subtract(A);

        // Next, Apply rotation matrix: R * (COM - A) =  R * COM_rel
        const rotated_x = c * COM_rel.x - s * COM_rel.y;
        const rotated_y = s * COM_rel.x + c * COM_rel.y;

        // Finally, calculate new position of center of mass, COM' = A' + R(COM - A)
        const COM_prime = new Coord (
            A_prime.x + rotated_x,
            A_prime.y + rotated_y
        )

        return COM_prime;
    }

    // Calculate compoundLink's COM
    // This is a placeholder and NEVER BEEN DONE
    private calculateCompoundLinkCOMAtTimestepSol1(
        compoundLink: CompoundLink,
        positionMap: Map<number, Coord>
    ): Coord {
        // THIS HAS NEVER BEEN DONE, this feature will be for welded-link (compound link) in the future
        return new Coord(0,0)
    }

    // SOLUTION 2: Using circle-circle technique --------------
    private getCenterOfMassAtTimestepSol2(
        rigidBody: RigidBody,
        positionMap: Map<number, Coord>,
        previousCOMMap: Map<number, Coord>
    ): Coord | undefined {
        if (rigidBody instanceof Link) {
            const lastCOM = previousCOMMap.get(rigidBody.id);
            if (lastCOM) {
                return this.calculateLinkCOMAtTimestepSol2(rigidBody, positionMap, lastCOM);
            } else { // fall back
                console.log('previous center of mass in getCenterOfMassAtTimestepSol2() in statics-analysis.service.ts is undefinied')
            }         
        } else if (rigidBody instanceof CompoundLink) {
            return this.calculateCompoundLinkCOMAtTimestepSol1(rigidBody, positionMap);
        }
        
        return rigidBody.centerOfMass;
    }

    // calculate COM for a link at a timestep
    private calculateLinkCOMAtTimestepSol2(
        link: Link,
        positionMap: Map<number, Coord>,
        lastCOM: Coord
    ): Coord | undefined {
        const joints = link.getJoints();

        if (joints.length < 2) {
            return undefined;
        }

        return this.transformCOMUsingCircleIntersection(link, positionMap, lastCOM);
    }

    private transformCOMUsingCircleIntersection(
        rigidBody: RigidBody,
        positionMap: Map<number, Coord>,
        lastCOM: Coord
    ): Coord | undefined {
        const joints = rigidBody.getJoints();
        
        if (joints.length < 2) return undefined;

        const joint0 = joints[0];
        const joint1 = joints[1];

        // Original joint coords and original COM (reference pose)
        // Coordinates from those joints above and COM, I use 'A' and 'B' to represent for coordinates of Joint1 and Joint2 above.
        const A = joint0.coords;
        const B = joint1.coords;
        const COM = rigidBody.centerOfMass;

        // New joint coords at this timestep t (t > 0)
        const A_prime = positionMap.get(joint0.id) ?? A;
        const B_prime = positionMap.get(joint1.id) ?? B;

        // calculate fixed radius from A to COM and B to COM, these radius will be fixed
        const rA = this.distanceBetweenCoords(A, COM);
        const rB = this.distanceBetweenCoords(B, COM);

        const intersectionPoints = this.circleCircleIntersection(A_prime, rA, B_prime, rB);

        if (intersectionPoints.length === 0) return undefined;

        if (intersectionPoints.length === 1) return intersectionPoints[0];

        // if we have 2 intersection points, choose the one closer to COM of the last frame (last COM)
        const d0 = this.distanceBetweenCoords(lastCOM, intersectionPoints[0]);
        const d1 = this.distanceBetweenCoords(lastCOM, intersectionPoints[1]);
        
        return d0 <= d1 ? intersectionPoints[0] : intersectionPoints[1];
    }

    // Calculate distance between two coordinates
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

    // Force related functions -------------------------
    /**
     * Extract force metadata from a live Force object
     * Call this ONCE at t=0 to cache immutable force properties
     * 
     * @param force - The Force object template at t = 0
     * @returns ForceMeta - general info about this Force that never changed over time
     */
    private cacheForceMeta(force: Force): ForceMeta {
        // Get position in link's local coordinate system
        // calculatePositionInLink() returns [distance, angleInRadians]
        const posInLink = force.calculatePositionInLink();
        
        // Get force angle relative to link orientation (degrees)
        const relativeAngle = force.calculateRelativeAngle();
        
        // For Global frame forces, we need to store the absolute angle at t=0
        // because it doesn't change as the link rotates
        const absoluteAngleAtT0 = force.angle;  // degrees
        
        return {
            forceId: force.id,
            forceName: force.name,
            parentLinkId: force.parentLink.id,
            magnitude: force.magnitude,
            posInLink: posInLink,  // [distance, angleRad]
            relativeAngle: relativeAngle,  // degrees
            frameOfReference: force.frameOfReference,
            absoluteAngleAtT0: absoluteAngleAtT0  // degrees
        };
    }

    /**
     * Cache all force metadata for a rigid body
     * Call only once at t=0 before running timestep analysis
     * 
     * @param rigidBody - Link or CompoundLink
     * @returns Array of ForceMeta for all forces on this rigid body
     */
    private cacheAllForcesMetaForRigidBody(rigidBody: RigidBody): ForceMeta[] {
        const forcesMetaArray: ForceMeta[] = [];
        
        if (rigidBody instanceof Link) {
            rigidBody.forces.forEach(force => {
                forcesMetaArray.push(this.cacheForceMeta(force));
            });
        } else if (rigidBody instanceof CompoundLink) {
            rigidBody.links.forEach(link => {
                link.forces.forEach(force => {
                    forcesMetaArray.push(this.cacheForceMeta(force));
                });
            });
        }
        
        return forcesMetaArray;
    }

    /**
     * Compute force state at a specific timestep
     * Pure function - does not mutate any objects
     * 
     * @param forceMeta - Cached force metadata from t=0
     * @param linkCOMAtT - Link's center of mass at timestep t
     * @param linkAngleAtT - Link's orientation angle at timestep t (radians)
     * @returns ForceAtTimestep - Force state at this timestep
     * 
     * EXPLANATION OF LOGIC (I copy this flow from Force.ts):
     * 
     * 1. APPLICATION POINT:
     *    The force is applied at a specific point on the link.
     *    This point is stored in polar coordinates relative to the link's COM:
     *      - distance: how far from COM
     *      - angle: direction from COM (in link's reference frame)
     *    
     *    At timestep t:
     *      - Link has rotated by linkAngleAtT
     *      - Link COM has moved to linkCOMAtT
     *      - Application point rotates with the link
     *    
     *    Calculation:
     *      absoluteAngle = storedAngle + linkAngleAtT
     *      applicationPoint = COM + distance * [cos(absoluteAngle), sin(absoluteAngle)]
     * 
     * 2. FORCE DIRECTION:
     *    Two cases based on frame of reference:
     *    
     *    LOCAL FRAME:
     *      - Force direction rotates with the link
     *      - forceAngle = linkAngle + relativeAngle
     *      - Example: a perpendicular spring force stays perpendicular
     *    
     *    GLOBAL FRAME:
     *      - Force direction stays constant in world coordinates
     *      - forceAngle = absoluteAngleAtT0 (same as at t=0)
     *      - Example: gravity always points down
     * 
     * 3. FORCE COMPONENTS:
     *    Once we have the force angle, compute Fx and Fy:
     *      Fx = magnitude * cos(angle)
     *      Fy = magnitude * sin(angle)
     */
    private computeForceAtTimestep(
        forceMeta: ForceMeta,
        linkCOMAtT: Coord,
        linkAngleAtT: number  // radians
    ): ForceAtTimestep {
        // ---- STEP 1: Compute Application Point -----
        // The force start point is stored relative to COM in polar coordinates
        // Currently, this code is using rotation matrix + polar coordinate to calculate the next start tip of the force. 
        // In the future, I think we should use circle-circle method. Fortunately, we already circlecircle function circleCircleIntersection() for this technique in this class that we an use in the future.
        const distanceFromCOM = forceMeta.posInLink[0];
        const angleFromCOM_stored = forceMeta.posInLink[1];  // radians, in link's original frame

        // At timestep t, the link has rotated by linkAngleAtT (this angle will be easy calculated by coordinates of joints in that link)
        // So the application point has also rotated
        const absoluteAngleToApplicationPoint = angleFromCOM_stored + linkAngleAtT;

        // Calculate the absolute position of the application point
        const startX = linkCOMAtT.x + distanceFromCOM * Math.cos(absoluteAngleToApplicationPoint);
        const startY = linkCOMAtT.y + distanceFromCOM * Math.sin(absoluteAngleToApplicationPoint);

        const start = new Coord(startX, startY);

        // ---- STEP 2: Compute Force Angle at Timestep t ----
        let forceAngleAtT_degrees: number; 

        if (forceMeta.frameOfReference === ForceFrame.Local) {
            // LOCAL FRAME: Force rotates with the link
            // The force maintains its angle relative to the link
            // forceAngle = linkAngle + relativeAngle
            
            const linkAngleDegrees = linkAngleAtT * (180 / Math.PI);
            forceAngleAtT_degrees = linkAngleDegrees + forceMeta.relativeAngle;
            
        } else {
            // GLOBAL FRAME: Force maintains absolute direction
            // The force angle stays constant in world coordinates (world coordinates is the 2D planar coordinates)
            // It doesn't rotate with the link
            
            forceAngleAtT_degrees = forceMeta.absoluteAngleAtT0;
        } 

        // ---- STEP 3: Compute Force Components ----        
        // Standard force component calculation
        // Fx = F * cos(θ), Fy = F * sin(θ)
        const fx = forceMeta.magnitude * Math.cos(forceAngleAtT_degrees * (Math.PI / 180));
        const fy = forceMeta.magnitude * Math.sin(forceAngleAtT_degrees * (Math.PI / 180));

        return {
            start: start,
            fx: fx,
            fy: fy,
            magnitude: forceMeta.magnitude,
            angleAtTimestep: forceAngleAtT_degrees // force angle
        };
    }

    /**
     * Get all forces on a rigid body at a specific timestep
     * 
     * @param rigidBody - The rigid body (Link or CompoundLink)
     * @param positionMap - Joint positions at timestep t
     * @param cachedForcesMeta - Pre-cached force metadata from t=0
     * 
     * @returns Array of ForceAtTimestep for all forces on this rigid body
     */
     private getAllForcesAtTimestepForOneRigidBody(
        rigidBody: RigidBody,
        positionMap: Map<number, Coord>,
        COMAtT: Coord, // Center of Mass coordinates
        cachedForcesMeta: ForceMeta[]  // pass in cached metadata
    ): ForceAtTimestep[] {
        const forcesAtT: ForceAtTimestep[] = [];

        // Calculate link's state at this timestep t
        const linkAngleAtT = this.calculateLinkAngleAtTimestep(rigidBody, positionMap);

        // Compute each force at this timestep using cached metadata
        for (const forceMeta of cachedForcesMeta) {
            // Only process forces that belong to this rigid body
            if (rigidBody.id === forceMeta.parentLinkId) {
                const forceAtT = this.computeForceAtTimestep(forceMeta, COMAtT, linkAngleAtT);
                forcesAtT.push(forceAtT);
            }
        }

        return forcesAtT;
    }


    /**
     * Helper function
     * Calculate link's angle at a specific timestep
     * Uses first two joints to determine link orientation, even there are more than 2 joints in a link, we still use the first two joints.
     * @param rigidBody - The rigid body
     * @param positionMap - Joint positions at this timestep
     * @returns Link angle in radians 
     */
    private calculateLinkAngleAtTimestep(
        rigidBody: RigidBody,
        positionMap: Map<number, Coord>
    ): number {
        const joints = rigidBody.getJoints();
    
        if (joints.length < 2) {
            console.error('Cannot determine angle with less than 2 joints')
            return 0;  
        }

        // Use first two joints to define link orientation
        const joint0 = joints[0];
        const joint1 = joints[1];
        
        const pos0 = positionMap.get(joint0.id) ?? joint0.coords;
        const pos1 = positionMap.get(joint1.id) ?? joint1.coords;
        
        const dx = pos1.x - pos0.x;
        const dy = pos1.y - pos0.y;
        
        return Math.atan2(dy, dx);  // radians
    }


    private buildRigidBodyEquationsAtTimestep(
        rigidBody: RigidBody,
        submechIndex: number,
        inputJoint: Joint,
        variableList: string[],
        positionMap: Map<number, Coord>,
        COMAtT: Coord | undefined, // center of mass at timestep 
        cachedForcesMeta: ForceMeta[] | undefined
    ): EquilibriumEquation[] {
        const equations: EquilibriumEquation[] = [];
        const joints = rigidBody.getJoints(); // we call this function just to extract the id of each Joint

        // Calculate CoM at this timestep using positions from positionMap
        const mass = rigidBody.mass;

        if (!COMAtT) {
            throw new Error(`Center of mass is undefined`);
        }

        if (!cachedForcesMeta) {
            throw new Error(`Need meta data for all forces in this sub-mechanism`);
        }

        // Get forces transformed to this timestep using cached metadata
        const forcesAtT = this.getAllForcesAtTimestepForOneRigidBody(rigidBody, positionMap, COMAtT, cachedForcesMeta);
        
        // Get pivot point for this rigid body
        const pivotConvention = this.pivotPointConventions[submechIndex].get(rigidBody.id);
        if (!pivotConvention) {
            throw new Error(`Pivot convention not found for rigid body ${rigidBody.id}`);
        }

        // Get pivot coordinate at this timestep
        const pivotPointCoord = this.getPivotCoordinateAtTimestep(
            rigidBody,
            pivotConvention,
            positionMap,
            COMAtT // center of mass at timestep
        );

        // Extract gravitational force components
        const gravityForce = this.getGravityForceComponents(submechIndex, mass);
        const Fg_x = gravityForce ? gravityForce.Fx : 0;
        const Fg_y = gravityForce ? gravityForce.Fy : 0;

        // Equation 1: ΣFx = 0
        const fxEquation: EquilibriumEquation = {
            rigidId: rigidBody.id,
            coefficients: new Map(),
            constant: -Fg_x // Move gravity to RHS: ΣFx + Fg_x = 0 => ΣFx = -Fg_x
        };

        // Equation 2: ΣFy = 0
        const fyEquation: EquilibriumEquation = {
            rigidId: rigidBody.id,
            coefficients: new Map(),
            constant: -Fg_y // Move gravity to RHS: ΣFx + Fg_x = 0 => ΣFx = -Fg_x
        };

        // Equation 3: ΣM = 0
        const momentEquation: EquilibriumEquation = {
            rigidId: rigidBody.id,
            coefficients: new Map(),
            constant: 0
        };

        // ---- GET SIGN CONVENTION ------ 
        const rbConvention = this.signConventions[submechIndex].get(rigidBody.id);
        if (!rbConvention) {
            throw new Error(`Sign convention not found for rigid body ${rigidBody.id}`);
        }

        // ---- ADD REACTION FORCE AT EACH JOINT IN THIS LINK ----
        // Process each joint
        joints.forEach((joint) => {
            // Skip free-end joints (they have no reaction forces). Free-end joints are joints that not connected to any other joint.
            if (this.isFreeEndJoint(joint)) {
                return;
            }

            // Create some unique variable names for reaction forces at this joint
            const rxVar = `Fx_${joint.id}`; // "Fx_0" for joint 0
            const ryVar = `Fy_${joint.id}`;

            const jointConv = rbConvention.jointConventions.get(joint.id);
            if (!jointConv) {
                throw new Error(`Sign convention not found for joint ${joint.id}`);
            }

            const xSign = jointConv.xDirection;
            const ySign = jointConv.yDirection;

            if (!variableList.includes(rxVar)) {
                variableList.push(rxVar);
            }
            if (!variableList.includes(ryVar)) {
                variableList.push(ryVar);
            }

            // Add to force equations with sign conventions
            fxEquation.coefficients.set(rxVar, xSign); // ΣFx: add coefficient for Fx_joint
            fyEquation.coefficients.set(ryVar, ySign); // ΣFy: add coefficient for Fy_joint

            // Use position from positionMap to find joint coordinates (instead of joint.coords)
            const jointPosition = positionMap.get(joint.id) ?? joint.coords;
            const r = jointPosition.subtract(pivotPointCoord);
            const r_magnitude = Math.sqrt(r.x * r.x + r.y * r.y);

            // Check if this joint is the pivot point, 
            // Because if pivot joint substract its self, it should be 0, however, decimals from calculation could make it not 0. That's why we need this sanity check
            // if r_magnitude = 0, we don't have to add it into the coefficients of the function. 

            // Moment from force at this joint: M = r x F
            // In 2D: M = rx * Fy - ry * Fx (positive counter-clockwise)
            // So:
            //   - Coefficient of Fx is: sign * (-ry)
            //   - Coefficient of Fy is: sign * (rx)
            
            if (r_magnitude > 1e-6) { // less than 1e-6 will be considered as 0 because of error in decimal calculation
                momentEquation.coefficients.set(rxVar, xSign * (-r.y));
                momentEquation.coefficients.set(ryVar, ySign * r.x);
            }
        });

        // --- ADD APPLIED FORCE ---
        // Add "applied forces" at this timestep. Applied forces are force that being applied by hand or something on the link (push, pull...).
        if (forcesAtT.length > 0) { // if we have any applied force on the link
            forcesAtT.forEach( forceAtT => {
                const fx_applied = forceAtT.fx;
                const fy_applied = forceAtT.fy;

                // Add to force equations (move to RHS, hence subtract)
                // ΣFx + fx_applied = 0 => ΣFx = -fx_applied
                fxEquation.constant -= fx_applied;
                fyEquation.constant -= fy_applied;
                
                // Calculate moment contribution from this applied force
                // M = r x F, where r is from pivot to force application point
                const r = forceAtT.start.subtract(pivotPointCoord);
                const r_magnitude = Math.sqrt(r.x * r.x + r.y * r.y);

                // Only add moment if force is not applied at the pivot point
                // The logic explained similarly like a similar chunk of code above
                if (r_magnitude > 1e-6) {
                    // Moment = rx * Fy - ry * Fx (2D cross product)
                    const moment = r.x * fy_applied - r.y * fx_applied;
                    momentEquation.constant -= moment;
                }
            });
        }

        // --- ADD GRAVITY ---
        // Check if gravity affects calculations (not Z-direction)
        if (this.doesGravityAffectCalculations(submechIndex)) {
            const gravityForce = this.getGravityForceComponents(submechIndex, mass);
            if (gravityForce) {
                const Fg_x = gravityForce.Fx;
                const Fg_y = gravityForce.Fy;

                // IMPORTANT: Gravity acts at CENTER OF MASS
                // So we need r from PIVOT POINT to COM at timestep t
                const r_gravity = COMAtT.subtract(pivotPointCoord);
                const r_magnitude = Math.sqrt(r_gravity.x * r_gravity.x + r_gravity.y * r_gravity.y);

                // If pivot is at COM, gravity produces no moment
                // Moment from gravity = r x Fg
                if (r_magnitude > 1e-6) {
                    const moment_gravity = r_gravity.x * Fg_y - r_gravity.y * Fg_x;
                    momentEquation.constant -= moment_gravity;
                }
            }
        }

        // ---- ADD MOTOR TORQUE ----
        // Add motor torque if applicable
        if (joints.includes(inputJoint)) {
            const torqueVar = `T_motor`;

            if (!variableList.includes(torqueVar)) {
                variableList.push(torqueVar);
            }

            const torqueConv = this.torqueConventions[submechIndex];
            const torqueSign = torqueConv ? torqueConv.torqueDirection : 1; // Default +1 (Counter Clock Wise)

            momentEquation.coefficients.set(torqueVar, torqueSign);
        }

        equations.push(fxEquation, fyEquation, momentEquation);
        return equations;
    }

    /**
     * Get pivot coordinate at a specific timestep
     * 
     * @param rigidBody - The rigid body
     * @param pivotConvention - Pivot point convention (COM or Joint)
     * @param positionMap - Joint positions at this timestep
     * @param CoM - Center of mass at this timestep (already calculated)
     * @returns Coordinate of the pivot point at this timestep
     */
    private getPivotCoordinateAtTimestep(
        rigidBody: RigidBody,
        pivotConvention: PivotPointConvention,
        positionMap: Map<number, Coord>,
        COMAtT: Coord
    ): Coord {
        if (pivotConvention.pivotType === PivotPoint.CenterOfMass) {

            // Pivot is at center of mass
            return COMAtT;
        } else {
            // Pivot is at a specific joint
            const joints = rigidBody.getJoints(); // get list of joints from this rigid body
            const pivotJoint = joints.find(j => j.id === pivotConvention.jointId); // find the joint that matches the pivot user chose

            if (!pivotJoint) {
                throw new Error(`Pivot joint ${pivotConvention.jointId} not found in rigid body`);
            }

            // Get the joint's position at this timestep from positionMap
            return positionMap.get(pivotJoint.id) ?? pivotJoint.coords;
        }
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
        equations: EquilibriumEquation[], // all equations we built for a sub-mechanism
        variableList: string[] // all variables need to be found in all equations we built
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