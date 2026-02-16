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
import { throwError } from 'rxjs';

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
    
    // // Position of force application point relative to link's COM
    // // Stored in polar coordinates relative to the link's reference frame
    // posInLink: [number, number];  // [distance, angleInRadians]
    // // posInLink[0] = distance from COM to force start point (scalar)
    // // posInLink[1] = angle from COM to force start (radians, in link's original frame)

    // Reference joints for circle intersection
    // The force start point is at fixed distances from these two joints
    referenceJoint1Id: number;  // First reference joint
    referenceJoint2Id: number;  // Second reference joint
    distanceFromJoint1: number;  // Distance from joint1 to force start
    distanceFromJoint2: number;  // Distance from joint2 to force start
    
    // Force start position at t=0 (for choosing correct intersection)
    startPositionAtT0: Coord;

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

/**
 * This interface will be just for exporting data into Excel
*/
export interface ComprehensiveFrameData {
    time: number;
    jointPositions: Map<number, Coord>;
    comPositions: Map<number, Coord>;
    // forceComponents: Map<number, { fx: number, fy: number }>;
    forcePositions: Map<number, Coord>;
    solution: StaticSolution;
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

    // lastAnalysisResults[submechIndex][frameIndex]
    private lastAnalysisResults: ComprehensiveFrameData[][] = []; // store the analysis result to print out in Excel sheet

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
     * @returns true if initialization succeeded; false if the sub-mechanism is invalid.
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
     * For example, Link AB and BC connected by Joint B, if Joint B in Link AB has +x and -y, Joint B in Link BC must have opposite signs which are -x and +y.
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
     * This is the public interface of checkFreeEndJoint() above where each 
     * free-end joint will be checked and add to the freeEndJointSet in initializeSignConventions()
     * @return true if this joint is free-end
    */
    public isFreeEndJoint(joint: Joint): boolean {
        return this.freeEndJointSet.has(joint); 
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
     * Main API for the front-end to set what pivot we want in a link
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

    // =================== ANALYSIS AT DIFFERENT TIMESTEP =================================

    /**
    *  JUST FOR TESTING, WILL CONVERT IT TO A FUNCTION TO CALL WITH THE BUTTON FROM THE FRONT-END
    * Step 1: Find mechanism from state service: const mechanism = this.stateService.getMechanism();
    * Step 2: Find sub-mechanism: const subMechanisms = mechanism.getSubMechanisms();
    * Step 3: clear all the data array: this.staticsAnalysis.clearSignConventions();
    * Step 4: solve all time steps and extract necessary information
    */
    public testPrintJointsForcesForAllTimesteps(subMechanisms: Map<Joint, RigidBody[]>[]): void { 
        const start = performance.now();
        subMechanisms.forEach((subMechanism, index) => {
            let isValid = true;

            //only initialize when the we don't have signConvention yet         
            if (!this.signConventions[index]) {
                isValid = this.initializeSignConventions(subMechanism, index);
            }

            if (isValid) {
                this.printSignConventions(index);
                const solutions = this.solveAllTimesteps(subMechanism, index);
                
                // for (const solution of solutions) {
                //     console.log(`Torque at motor = ${solution.motorTorque} (Nm)`);
                //     solution.reactionForces.forEach((recforce, id) => {
                //     console.log(`   Fx_${id} = ${recforce.Fx} (N) & Fy_${id} = ${recforce.Fy} (N)`);
                // })
                // } 

                // We suppose to have 360 solutions corresponding to 360 degrees, however, I just want to print 30 of them out on the console
                for (let s = 0; s < 30; s++) {
                    console.log(`At timestep t = ${s}. Torque at motor = ${solutions[s].motorTorque} (Nm)`);
                }

            } else {
                console.log(`Skipping Sub-Mechanism ${index} (invalid for static analysis)\n`);
            }
        })

        const end = performance.now();
        console.log(`Elapsed: ${(end - start) / 1000} seconds`);
    }

    /**
     * Solve static equilibrium across ALL timesteps for one sub-mechanism.
     * 
     * This runs a full statics analysis over the animation produced by the position solver:
     *  - Collects the unique rigid bodies in the sub-mechanism
     *  - Caches applied-force metadata per rigid body (push/pull forces; not gravity)
     *  - Finds the input/motor joint for this sub-mechanism
     *  - Iterates through every animation frame (timestep), building a positionMap (jointId -> Coord)
     *  - Computes/loads center-of-mass (COM) positions for all rigid bodies at each timestep
     *  - Calls solveSubMechanismAtTimestep(...) to build and solve equilibrium equations
     *  - Stores per-timestep results into lastAnalysisResults[submechIndex] for CSV/Excel export
     *  - Returns an array of StaticSolution, one per timestep
     * 
     * @param subMechanism - Map describing ONE sub-mechanism (each Joint maps to its connected RigidBody[])
     * @param submechIndex - Index of this sub-mechanism in the position solver’s animationFrames array
     * @returns Array of StaticSolution results (length = number of animation timesteps); empty array if no frames exist
     */
    public solveAllTimesteps(
        subMechanism: Map<Joint, RigidBody[]>, // only ONE sub-mechanism
        submechIndex: number
    ) : StaticSolution[] {  
        // Get all unique rigid bodies
        const uniqueRigidBodies = this.getUniqueRigidBodies(subMechanism);

        // Each rigid body will have none, one or more of applied forces (applied forces are created by pull, push,... NOT gravitational force)
        // We need an array to save the applied forces for each rigid body (link)
        // Then, we create a map to save rigidID with corresponding applied forces. 
        const cachedForcesMetaMap = new Map<number, ForceMeta[]>(); 
        uniqueRigidBodies.forEach( rigidBody => {
            const cachedForcesMeta = this.cacheAllForcesMetaForRigidBody(rigidBody);
            if (cachedForcesMeta && cachedForcesMeta.length > 0) {
                cachedForcesMetaMap.set(rigidBody.id, cachedForcesMeta);
            }
        });

        // TESTING, DELETE LATER-------------------
        console.log(`We have total of : ${cachedForcesMetaMap.size} forces`);
        for (const [key, value] of cachedForcesMetaMap) {
            console.log('rigid ', key, ' : ', value);
        }
        // ----------------------------------------------------------



        // Get input joint for this sub-mechanism
        const inputJoint = this.findInputJoint(subMechanism);

        // Get animation frames from position solver (recommend to print it out to see)
        const animationFrames = this.positionSolver.getAnimationFrames();
        console.log("animation frame: ",animationFrames);

        // Check animation frames for this sub-mechanism
        if (!animationFrames[submechIndex]) {
            console.error(`No animation frames found for submechanism ${submechIndex}`);
            return [];
        }

        // animationFrames[submechIndex] is an AnimationPositions object, please check kinematic-solver.service.ts
        const animationData = animationFrames[submechIndex];
        const allPositions = animationData.positions;  // 2D array: positions[timestep][jointIndex]
        const jointIDs = animationData.correspondingJoints;  // array of joint IDs

        const rigidBodyCOMAllTimesteps: Map<number, Coord>[] = []; // This is Array of Map <rigidID, Coord>, index of Array will equal timestep "t", basically this array will have length of 360 cells equal to the timestep we have. E.g. [Map, Map, Map,...] each Map saves COM of all rigid bodies at that timestep. 

        const solutions: StaticSolution[] = [];

        // TESTING, DELETE THIS LATER ------------------------------
        console.log(`Analyzing ${allPositions.length} timesteps for submechanism ${submechIndex}`);
        console.log(`Joint IDs order: ${jointIDs}`);
        console.log('Animation frame: ', animationData);
        // ----------------------------------------------------------

        // Initialize or Clear the storage for this specific sub-mechanism
        this.lastAnalysisResults[submechIndex] = [];

        // Track previous forces
        let previousForcesMap = new Map<number, ForceAtTimestep>();

        // Solve for each timestep
        for (let t = 0; t < allPositions.length; t++) {
            const positionCoordsAtTimeT = allPositions[t];  // Array of Coord of all Joints in this sub-mechanism for this timestep
            
            const positionMap = new Map<number, Coord>(); // Map of positions by JointID <JointID, Coord> of this sub-mechanism at this timestep t
            
            for(let i = 0; i < jointIDs.length; i++) { // load data into position map
                positionMap.set(jointIDs[i], positionCoordsAtTimeT[i]);
            }

            this.findAndLoadDataForCOMAtTimestep(uniqueRigidBodies, positionMap, rigidBodyCOMAllTimesteps, t); //update data for rigidBodyCOMAllTimestep array

            // After data updated for position of COM for all rigid bodies at this timestep t from function above
            // => extract that data
            const rigidBodyCOMMap = rigidBodyCOMAllTimesteps[t];

            // TESTING, DELETE IT LATER -------------
            if(t < 30) {
                console.log('COM map is ', rigidBodyCOMMap, 'at timestep t = ', t);
                console.log('positionMap is ', positionMap, 'at timestep t = ', t);
            }
            // --------------------------------------

            const result = this.solveSubMechanismAtTimestep(
                submechIndex,
                inputJoint,
                uniqueRigidBodies,
                positionMap,
                rigidBodyCOMMap,
                cachedForcesMetaMap,
                previousForcesMap,  // Pass previous forces
                t
            );

            // SAVE DATA FOR EXCEL EXPORT
            const forcePositionsAtT = new Map<number, Coord>(); //save forces
            result.forcesMap.forEach((f, id) => {
                forcePositionsAtT.set(id, new Coord(f.start.x, f.start.y));
            });

            this.lastAnalysisResults[submechIndex].push({ // save other results
                time: t,
                jointPositions: positionMap,
                comPositions: new Map(rigidBodyCOMMap), 
                forcePositions: forcePositionsAtT,
                solution: result.solution
            });

            solutions.push(result.solution);      
            previousForcesMap = result.forcesMap; // Update previous forces map for next iteration
        }
    
        return solutions;

    } 

    /**
     * Converts results of a specific sub-mechanism into a CSV and triggers a download.
     */
    public exportResultsToCSV(submechIndex: number, fileName: string = 'mechanism_analysis.csv'): void {
        const dataToExport = this.lastAnalysisResults[submechIndex];

        if (!dataToExport || dataToExport.length === 0) {
            console.error(`No analysis data available for sub-mechanism ${submechIndex}. Run solveAllTimesteps first.`);
            return;
        }

        const rows: string[] = [];
        const firstFrame = dataToExport[0];

        // Create headers
        const headers = ['Frame'];
        
        firstFrame.jointPositions.forEach((_, id) => {
            headers.push(`Joint${id}_X`, `Joint${id}_Y`); // add to header array
        });
        
        firstFrame.comPositions.forEach((_, id) => {
            headers.push(`Link${id}_COM_X`, `Link${id}_COM_Y`); // add to header array
        });

        firstFrame.forcePositions.forEach((_, id) => {
            headers.push(`Force${id}_StartX`, `Force${id}_StartY`); // add to header array
        });

        headers.push('MotorTorque_Nm');
        firstFrame.solution.reactionForces.forEach((_, id) => {
            headers.push(`Reaction_Fx_Joint${id}_N`, `Reaction_Fy_Joint${id}_N`); // add to header array
        });

        rows.push(headers.join(',')); // Turns the header array into a single comma-separated string (CSV header row)

        // Map Data Rows
        dataToExport.forEach(frame => {
            const data = [frame.time.toString()];

            frame.jointPositions.forEach(p => data.push(p.x.toFixed(4), p.y.toFixed(4)));
            frame.comPositions.forEach(p => data.push(p.x.toFixed(4), p.y.toFixed(4)));
            frame.forcePositions.forEach(p => data.push(p.x.toFixed(4), p.y.toFixed(4)));
            data.push(frame.solution.motorTorque.toFixed(6));
            frame.solution.reactionForces.forEach(f => data.push(f.Fx.toFixed(4), f.Fy.toFixed(4)));

            rows.push(data.join(','));
        });

        // Trigger Download
        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Compute and store center-of-mass (COM) coordinates for ALL rigid bodies at a specific timestep.
     * 
     * This is a helper function used by solveAllTimesteps(...) to populate the per-timestep COM cache
     * (rigidBodyCOMAllTimestep). It handles:
     *  - t = 0: use each rigid body's initial centerOfMass directly
     *  - t > 0: compute the updated COM using the circle-circle intersection technique, using the
     *           current joint positions and the previous timestep’s COM map as a reference
     * 
     * Results are stored by pushing a new Map into rigidBodyCOMAllTimestep, where the map keys are
     * rigidBody IDs and the values are COM coordinates for the given timestep.
     * 
     * @param uniqueRigidBodies - Unique rigid bodies in the sub-mechanism whose COMs should be updated
     * @param positionMap - Joint positions at this timestep (key: jointId, value: Coord)
     * @param rigidBodyCOMAllTimestep - Array storing COM maps per timestep; this method appends the map for timeStep
     * @param timeStep - Current timestep index (0-based)
     * @returns void
     */
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
                const rb_COM = this.getCOMAtTimestepUsingCircleIntersection (rb, positionMap, prevMap);
                if (rb_COM) {
                    rigidBodyCOMMap.set(rb.id, rb_COM); // add to the map
                } else {
                    console.log('Body ', rb, ' missing COM at timestep = ', timeStep);
                }
                
            })

            rigidBodyCOMAllTimestep.push(rigidBodyCOMMap); // push to the global array for this time step
        }
    }

    /**
     * Solve static equilibrium for one sub-mechanism at a specific timestep.
     * 
     * @param submechIndex - Index of the sub-mechanism being solved
     * @param inputJoint - The input/motor joint for this sub-mechanism (null => returns invalid solution)
     * @param uniqueRigidBodies - List of unique rigid bodies in this sub-mechanism
     * @param positionMap - Joint positions at this timestep (key: jointId, value: Coord)
     * @param rigidBodyCOMMap - Center-of-mass positions at this timestep (key: rigidBodyId, value: Coord)
     * @param cachedForcesMetaMap - Cached force metadata per rigid body (key: rigidBodyId)
     * @param previousForcesMap - Forces positions from the previous timestep (key: forceId)
     * @param time - Current simulation/animation time for this timestep
     * @returns Object containing the solved StaticSolution and a map of forces at this timestep
     */
    public solveSubMechanismAtTimestep(
        submechIndex: number,
        inputJoint: Joint | null, // inputJoint is where motor locates
        uniqueRigidBodies: RigidBody[], // list of unique rigid bodies in a submechanism
        positionMap: Map<number, Coord>,
        rigidBodyCOMMap: Map<number, Coord>, // COM map for all rigid bodies in this submechanism at this time step
        cachedForcesMetaMap: Map<number, ForceMeta[]> ,
        previousForcesMap: Map<number, ForceAtTimestep>,
        time: number
    ): { solution: StaticSolution, forcesMap: Map<number, ForceAtTimestep> } {
        // const inputJoint = this.findInputJoint(subMechanism);
        
        // check input
        if (!inputJoint) {
            return {
                solution: {
                    motorTorque: 0,
                    reactionForces: new Map(),
                    isValid: false,
                    errorMessage: 'No input joint found'
                },
                forcesMap: new Map()  // Return empty forces map
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

        const currentForcesMap = new Map<number, ForceAtTimestep>();

        uniqueRigidBodies.forEach((rigidBody) => {
            const COMAtT = rigidBodyCOMMap.get(rigidBody.id); // get COM for a rigid body
            
            if (!COMAtT) { // every link must have center of mass
                throw new Error(`Center of mass is undefined`);
            }

            const cachedForcesMeta = cachedForcesMetaMap.get(rigidBody.id);
            const result = this.buildRigidBodyEquationsAtTimestep(
                rigidBody,
                submechIndex,
                inputJoint,
                variableList,
                positionMap,
                COMAtT,
                time,
                cachedForcesMeta,
                previousForcesMap  
            );
            equations.push(...result.equations); // ALL equation for whole mechanism

            // Collect forces from this rigid body equations function
            result.forcesAtT.forEach((forceAtT, forceId) => {
                currentForcesMap.set(forceId, forceAtT);
            });
        });

        
    
        const solution = this.solveMatrixEquation(equations, variableList);
        
        return {
            solution: solution,
            forcesMap: currentForcesMap
        };
    }

    // ================= START FORCE related functions ===========================
    // This section will be about how to find Force positions when the linkages animate

    /**
     * Get all forces on a rigid body at a specific timestep
     * Uses circle intersection for force position calculation
     * 
     * @param rigidBody - The rigid body
     * @param positionMap - Joint positions at this timestep
     * @param cachedForcesMeta - Pre-cached force metadata
     * @param previousForcesMap - Map of forces from previous timestep (for continuity)
     * @returns Map of forceId -> ForceAtTimestep
     */
    private getAllForcesAtTimestepForOneRigidBody(
        rigidBody: RigidBody,
        positionMap: Map<number, Coord>,
        cachedForcesMeta?: ForceMeta[],
        previousForcesMap?: Map<number, ForceAtTimestep>
    ): Map<number, ForceAtTimestep> {
        const forcesAtT = new Map<number, ForceAtTimestep>();
        
        // Calculate link angle at this timestep (for Local frame forces)
        const linkAngleAtT = this.calculateLinkAngleAtTimestep(rigidBody, positionMap);
        
        if(!cachedForcesMeta) {
            return forcesAtT;
        }

        // Compute each force at this timestep
        for (const forceMeta of cachedForcesMeta) {
            // Only process forces that belong to this rigid body
            if (rigidBody.id !== forceMeta.parentLinkId) {
                continue;
            }
            
            // Get previous force position for continuity (if available)
            const previousForceStart = previousForcesMap?.get(forceMeta.forceId)?.start;
                   
            const forceAtT = this.computeForceAtTimestep(
                forceMeta,
                positionMap,
                linkAngleAtT,
                previousForceStart
            );

            if (!forceAtT) {
                throw new Error('No solution from computeForceAtTimestep() at this time step leading to this error')
            }
            
            // Store in map by forceId
            forcesAtT.set(forceMeta.forceId, forceAtT);
        }
        
        return forcesAtT;
    }

    /**
     * Extract force metadata from a live Force object
     * Uses circle intersection approach - much simpler than rotation matrix!
     * 
     * @param force - The live Force object at t=0
     * @returns ForceMeta with reference joints and distances
     */
    private cacheForceMeta(force: Force): ForceMeta {
        const parentLink = force.parentLink;
        const joints = parentLink.getJoints();

        if (joints.length < 2) {
            throw new Error(`cacheForceMeta() show this Link ${parentLink.id} has fewer than 2 joints`);
        }

        // Use first 2 joints as reference points
        const joint1 = joints[0];
        const joint2 = joints[1];

        const forceStart = force.start; // extract the start position at t = 0 of this force

        // calculate distance from force start 
        // Calculate distances from force start to both reference joints
        const distanceFromJoint1 = Math.sqrt(
            Math.pow(forceStart.x - joint1.coords.x, 2) + 
            Math.pow(forceStart.y - joint1.coords.y, 2)
        );
        
        const distanceFromJoint2 = Math.sqrt(
            Math.pow(forceStart.x - joint2.coords.x, 2) + 
            Math.pow(forceStart.y - joint2.coords.y, 2)
        );

        // console.log(`Caching force ${force.id} on link ${parentLink.id}:`);
        // console.log(`  - Start position at t=0: (${forceStart.x}, ${forceStart.y})`);
        // console.log(`  - Reference joint 1: ${joint1.id} at (${joint1.coords.x}, ${joint1.coords.y})`);
        // console.log(`  - Reference joint 2: ${joint2.id} at (${joint2.coords.x}, ${joint2.coords.y})`);
        // console.log(`  - Distance from joint1: ${distanceFromJoint1}`);
        // console.log(`  - Distance from joint2: ${distanceFromJoint2}`);
        // console.log(`  - Frame: ${force.frameOfReference === ForceFrame.Global ? 'Global' : 'Local'}`);
        // console.log(`  - Angle at t=0: ${force.angle}°`);
        
        return {
            forceId: force.id,
            forceName: force.name,
            parentLinkId: parentLink.id,
            magnitude: force.magnitude,
            
            // Circle intersection data
            referenceJoint1Id: joint1.id,
            referenceJoint2Id: joint2.id,
            distanceFromJoint1: distanceFromJoint1,
            distanceFromJoint2: distanceFromJoint2,
            
            // Store t=0 position for choosing correct intersection
            startPositionAtT0: new Coord(forceStart.x, forceStart.y), // because force.start is mutable and we don't want to create any conflict in logic
            
            // Angle data
            frameOfReference: force.frameOfReference,
            relativeAngle: force.calculateRelativeAngle(),
            absoluteAngleAtT0: force.angle
        };
    }

    /**
     * Compute force at timestep using circle-circle intersection
     * 
     * @param forceMeta - Cached force metadata
     * @param positionMap - Joint positions at this timestep
     * @param linkAngleAtT - Link angle at timestep (radians) - only for when user picks "Local" frame forces // it's rare
     * @param previousForceStart - Force start from previous timestep (for continuity)
     * @returns Force data at this timestep
     */
    private computeForceAtTimestep(
        forceMeta: ForceMeta,
        positionMap: Map<number, Coord>,
        linkAngleAtT: number,  // radians
        previousForceStart?: Coord  // For choosing correct intersection
    ): ForceAtTimestep | undefined {
        // Calculate start position for the next force -----------------
        // Get reference joint positions at this timestep
        const joint1Pos = positionMap.get(forceMeta.referenceJoint1Id);
        const joint2Pos = positionMap.get(forceMeta.referenceJoint2Id);

        if (!joint1Pos || !joint2Pos) {
            throw new Error(`Reference joints NOT FOUND in positionMap for force ${forceMeta.forceId}`);
        }

        // Find intersection of two circles:
        // Circle 1: centered at joint1, radius = distanceFromJoint1
        // Circle 2: centered at joint2, radius = distanceFromJoint2
        const intersections = this.circleCircleIntersection(
            joint1Pos,
            forceMeta.distanceFromJoint1,
            joint2Pos,
            forceMeta.distanceFromJoint2
        );

        // if so solution
        if (intersections.length === 0) {
            console.warn(`No intersection found for force ${forceMeta.forceId} at this timestep`);
            return undefined;
        }    

        let forceStart: Coord;

        if (intersections.length === 1) {
            // Only one intersection
            forceStart = intersections[0];
        } else {
            // Two intersections - choose the one closer to previousForceStart position
            const referencePosition = previousForceStart || forceMeta.startPositionAtT0; // fall-back to startPositionAtT0 (happen only at t = 0 where it doesn't have any previous)
            
            const dist1 = this.distanceBetweenCoords(referencePosition, intersections[0]);
            const dist2 = this.distanceBetweenCoords(referencePosition, intersections[1]);
            
            forceStart = dist1 <= dist2 ? intersections[0] : intersections[1];
        }

        // Calculate Force Angle at This Timestep ---------
        let forceAngleDegrees: number;
        
        if (forceMeta.frameOfReference === ForceFrame.Local) {
            // Local frame: force rotates with link
            const linkAngleDegrees = linkAngleAtT * (180 / Math.PI);
            forceAngleDegrees = linkAngleDegrees + forceMeta.relativeAngle;
        } else {
            // Global frame: force maintains absolute direction
            forceAngleDegrees = forceMeta.absoluteAngleAtT0;
        }
        
        // Calculate Force Components Fx, Fy-----------
        
        const forceAngleRadians = forceAngleDegrees * (Math.PI / 180);
        const fx = forceMeta.magnitude * Math.cos(forceAngleRadians);
        const fy = forceMeta.magnitude * Math.sin(forceAngleRadians);
        
        return {
            start: forceStart,
            fx: fx,
            fy: fy,
            magnitude: forceMeta.magnitude,
            angleAtTimestep: forceAngleDegrees
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

    // =============================== END FORCE related functions =====================================



    private buildRigidBodyEquationsAtTimestep(
        rigidBody: RigidBody,
        submechIndex: number,
        inputJoint: Joint,
        variableList: string[],
        positionMap: Map<number, Coord>,
        COMAtT: Coord, // center of mass at timestep 
        time: number,
        cachedForcesMeta?: ForceMeta[], // some link doen't have any force
        previousForcesMap?: Map<number, ForceAtTimestep>
    ): { equations: EquilibriumEquation[], forcesAtT: Map<number, ForceAtTimestep> } {
        const equations: EquilibriumEquation[] = [];
        const joints = rigidBody.getJoints(); // we call this function just to extract the id of each Joint

        // Calculate CoM at this timestep using positions from positionMap
        const mass = rigidBody.mass;
        
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
        // Get forces transformed to this timestep using cached metadata
        const forcesAtT = this.getAllForcesAtTimestepForOneRigidBody(rigidBody, positionMap, cachedForcesMeta, previousForcesMap);

        // console.log('At timestep: ', time,' with forces', forcesAtT);

        // Add "applied forces" at this timestep. Applied forces are force that being applied by hand or something on the link (push, pull...).
        if (forcesAtT.size > 0) { // if we have any applied force on the link
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
        
        return {equations, forcesAtT};
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
            const pivotJointFound = positionMap.get(pivotJoint.id);

            if(!pivotJointFound) {
                throw new Error(`Pivot joint ${pivotConvention.jointId} not found in the positionMap.`);
            }

            return pivotJointFound;
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

        // // Print matrix for debugging
        // console.log('Coefficient Matrix [A]:');
        // A.forEach((row, i) => {
        //     console.log(`  [${row.map(v => v.toFixed(3).padStart(8)).join(', ')}]`);
        // });
        // console.log('Constant Vector {B}:');
        // console.log(`  [${b.map(v => v.toFixed(3).padStart(8)).join(', ')}]`);

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

    // ================================ START CENTER OF MASS related functions ======================================
    // This section is about how to find Center of Mass for each Link/Compound Link when the linkages animate.
    
    // // ------------ SOLUTION 1: MATRIX ROTATION ------------------
    // // NOTE from MQP 25-26 team: 
    // // You can skip this solution 1 and jump right into Solotion 2 below if you're just trying to understand the working code.
    // // We don't prefer to use this solution 1 to find center of mass because it causes some errors in calculation, we use circle intersections instead. BUT, professor Pradeep told us to keep the code of this just in case we need to use it in the future.
    // // Please UNCOMMENT if you need it.

    // // calculate center of mass at time-step.
    // private getCenterOfMassAtTimestepRotationMatrix(
    //     rigidBody: RigidBody,
    //     positionMap: Map<number, Coord>
    // ): Coord | undefined {
    //     if (rigidBody instanceof Link) {
    //         return this.calculateLinkCOMAtTimestepRotationMatrix(rigidBody, positionMap);
    //     } else if (rigidBody instanceof CompoundLink) {
    //         return this.calculateCompoundLinkCOMAtTimestepRotationMatrix(rigidBody, positionMap);
    //     }
        
    //     return rigidBody.centerOfMass;
    // }

    // // calculate link's CoM
    // private calculateLinkCOMAtTimestepRotationMatrix(
    //     link: Link,
    //     positionMap: Map<number, Coord>
    // ): Coord | undefined {
    //     const joints = link.getJoints();

    //     if (joints.length < 2) {
    //         return undefined;
    //     }

    //     return this.transformCOMUsingRotationMatrix(link, positionMap);
    // }

    // // Compute: new center of mass poition in new frame at timestep t, using rigid body transformation
    // // Read this in report MQP 25-26
    // private transformCOMUsingRotationMatrix (
    //     rigidBody: RigidBody,
    //     positionMap: Map<number, Coord>
    // ): Coord | undefined {
    //     const joints = rigidBody.getJoints();

    //     if (joints.length < 2) {
    //         return rigidBody.centerOfMass;
    //     }

    //     // Reference points: use any two joints at t = 0
    //     const joint1 = joints[0];
    //     const joint2 = joints[1];

    //     // Coordinates from those joints above and COM, I use 'A' and 'B' to represent for coordinates of Joint1 and Joint2 above.
    //     const A = joint1.coords;
    //     const B = joint2.coords;
    //     const COM = rigidBody.centerOfMass; // center of mass at t = 0 (initial)

    //     // New points at new frame (at t > 0)  
    //     const A_prime = positionMap.get(joint1.id) ?? A;
    //     const B_prime = positionMap.get(joint2.id) ?? B;

    //     // compute vector
    //     const u = B.subtract(A); // original orientation vector
    //     const v = B_prime.subtract(A_prime); // new orientation vector

    //     // compute vector magnitude
    //     const u_magnitude = Math.sqrt(u.x * u.x + u.y * u.y);
    //     const v_magnitude = Math.sqrt(v.x * v.x + v.y * v.y);

    //     if (u_magnitude < 1e-10 || v_magnitude < 1e-10) {
    //         console.warn('Joints too close together for rotation matrix calculation');
    //         return rigidBody.centerOfMass;
    //     }


    //     // normalize vector
    //     const u_norm = new Coord(u.x / u_magnitude, u.y / u_magnitude);
    //     const v_norm = new Coord(v.x / v_magnitude, v.y / v_magnitude);

    //     // Compute rotation matrix components
    //     // c = cos(theta) = dot(u, v) / (|u| |v|) = (u_norm) (v_norm)
    //     // s = sin(theta) = cross(u, v) / (|u| |v|) = (u_norm) x (v_norm)
    //     const c = u_norm.x * v_norm.x + u_norm.y * v_norm.y;  // dot product
    //     const s = u_norm.x * v_norm.y - u_norm.y * v_norm.x;  // cross product (2D)

    //     // Rotation matrix R = [[c, -s],
    //     //                      [s,  c]]
    //     // To calculate new COM': COM' = A' + R(COM - A)
        
    //     // First, calculate the relative distance from center of mass to A which is (COM - A) from the formula above
    //     const COM_rel = COM.subtract(A);

    //     // Next, Apply rotation matrix: R * (COM - A) =  R * COM_rel
    //     const rotated_x = c * COM_rel.x - s * COM_rel.y;
    //     const rotated_y = s * COM_rel.x + c * COM_rel.y;

    //     // Finally, calculate new position of center of mass, COM' = A' + R(COM - A)
    //     const COM_prime = new Coord (
    //         A_prime.x + rotated_x,
    //         A_prime.y + rotated_y
    //     )

    //     return COM_prime;
    // }

    // // Calculate compoundLink's COM
    // // This is a placeholder and NEVER BEEN DONE
    // private calculateCompoundLinkCOMAtTimestepRotationMatrix(
    //     compoundLink: CompoundLink,
    //     positionMap: Map<number, Coord>
    // ): Coord {
    //     // THIS HAS NEVER BEEN DONE, this feature will be for welded-link (compound link) in the future
    //     return new Coord(0,0)
    // }
    // // ------------------ END Solution 1 -----------------------------

    
    //-------------- SOLUTION 2: CIRCLE INTERSECTIONS ----------------
    // NOTE from MQP 25-26: 
    // You can ask professor Pradeep for some videos to understand the Circle Intersection techniques to solve Mechanical Engineering problems.   
    private getCOMAtTimestepUsingCircleIntersection(
        rigidBody: RigidBody,
        positionMap: Map<number, Coord>,
        previousCOMMap: Map<number, Coord>
    ): Coord | undefined {
        if (rigidBody instanceof Link) { // if a rigid is a Link
            const lastCOM = previousCOMMap.get(rigidBody.id);
            if (lastCOM) {
                return this.calculateLinkCOMAtTimestepUsingCircleIntersection(rigidBody, positionMap, lastCOM);
            } else { // fall back
                console.log('previous center of mass in getCOMAtTimestepUsingCircleIntersection() in statics-analysis.service.ts is undefinied')
            }         
        } else if (rigidBody instanceof CompoundLink) { // if a rigid is a CompoundLink
            return this.calculateCompoundLinkCOMAtTimestepCircleIntersection(rigidBody, positionMap);
        }
        
        return rigidBody.centerOfMass;
    }

    // Calculate compoundLink's COM
    // This is a placeholder and NEVER BEEN DONE
    private calculateCompoundLinkCOMAtTimestepCircleIntersection(
        compoundLink: CompoundLink,
        positionMap: Map<number, Coord>
    ): Coord {
        // THIS HAS NEVER BEEN DONE, this feature will be for welded-link (compound link) in the future
        return new Coord(0,0)
    }

    // calculate COM for a link at a timestep
    private calculateLinkCOMAtTimestepUsingCircleIntersection(
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
    // ----------- END Solution 2 -------------------------------

    // ============================= END Center Of Mass Related Functions =================================
}   