import { Injectable } from '@angular/core';
import { StateService } from './state.service';
import { Joint, JointType } from '../model/joint';
import { Link, RigidBody } from '../model/link';
import { Coord } from '../model/coord';
import { PositionSolverService } from './kinematic-solver.service';
import { Mechanism } from '../model/mechanism';
import { AnimationPositions } from './kinematic-solver.service';
import { BehaviorSubject } from 'rxjs';

export interface JointAnimationState {
    mechanismIndex: number,
    currentFrameIndex: number,
    totalFrames: number,
    isPaused: boolean,
    startingPositions: Coord[],
    jointIDs: number[],
    animationFrames: Coord[][],
    inputSpeed: number,
}



@Injectable({
    providedIn: 'root'
})
export class AnimationService {


    public startDirectionCounterclockwise: boolean = true;
    private animationStates: JointAnimationState[];
    private invaldMechanism: boolean;
    private animationProgressSource = new BehaviorSubject<number>(0);
    private speedMultiplier: number = 1;
    animationProgress$ = this.animationProgressSource.asObservable();

    constructor(private stateService: StateService, private positionSolver: PositionSolverService) {
        this.animationStates = new Array();
        this.invaldMechanism = true;
        this.positionSolver.getKinematicsObservable().subscribe(updatedPositions => {
            this.initializeAnimations();
        });
    }

  getAnimationState(index: number): JointAnimationState | undefined {{
    return this.animationStates[index];
  }}

  setSpeedmultiplier(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  isInvalid(): boolean {
        return this.invaldMechanism;}

    initializeAnimations() {
        this.animationStates = new Array();
        let frames: AnimationPositions[] = this.positionSolver.getAnimationFrames();

        for (let subMechanismIndex = 0; subMechanismIndex < frames.length; subMechanismIndex++) {
            //intialize animation states
            let mechanismIndex: number = subMechanismIndex,
                currentFrameIndex: number = 0,
                totalFrames: number = frames[subMechanismIndex].positions.length,
                isPaused: boolean = true,
                startingPositions: Coord[] = new Array(),
                jointIDs: number[] = new Array(),
                animationFrames: Coord[][] = frames[subMechanismIndex].positions,
                inputSpeed: number = this.stateService.getMechanism().getJoint(frames[subMechanismIndex].correspondingJoints[0]).inputSpeed;
            for (let jointIndex = 0; jointIndex < frames[subMechanismIndex].correspondingJoints.length; jointIndex++) {
                startingPositions.push(frames[subMechanismIndex].positions[0][jointIndex]);
                jointIDs.push(frames[subMechanismIndex].correspondingJoints[jointIndex]);
            }
            this.animationStates.push({
                mechanismIndex: mechanismIndex,
                currentFrameIndex: currentFrameIndex,
                totalFrames: totalFrames,
                isPaused: isPaused,
                startingPositions: startingPositions,
                jointIDs: jointIDs,
                animationFrames: animationFrames,
                inputSpeed: inputSpeed
            })
        }
        this.invaldMechanism = this.animationStates.length == 0;
        this.stateService.getAnimationBarComponent()?.updateTimelineMarkers();
    }
    animateMechanisms(playPause: boolean) {
        if (playPause == false) {
            for (let state of this.animationStates) {
                state.isPaused = true;
            }
        } else {
            for (let state of this.animationStates) {
                state.isPaused = false;
                this.singleMechanismAnimation(state);
            }
        }
    }
  singleMechanismAnimation(state: JointAnimationState) {
    if (state.isPaused) {
      return;
    } else {
      // Move the frame index forward or backward
      if (this.startDirectionCounterclockwise) {
        if (state.currentFrameIndex === state.totalFrames - 1) {
          state.currentFrameIndex = 0;
        } else {
          state.currentFrameIndex++;
        }
      } else {
        if (state.currentFrameIndex === 0) {
          state.currentFrameIndex = state.totalFrames - 1;
        } else {
          state.currentFrameIndex--;
        }
      }

      // Calculate raw progress from 0..1
      const rawProgress = state.currentFrameIndex / (state.totalFrames - 1);

      // If clockwise, invert so bar goes 0..1 left to right
      const displayProgress = this.startDirectionCounterclockwise
        ? rawProgress
        : (1 - rawProgress);

      // Send that to the timeline
      this.updateProgress(displayProgress);

      // Update each joint's position for this frame
      for (let jointIndex = 0; jointIndex < state.jointIDs.length; jointIndex++) {
        this.stateService.getMechanism()
          .getJoint(state.jointIDs[jointIndex])
          .setCoordinates(state.animationFrames[state.currentFrameIndex][jointIndex]);
      }

      setTimeout(() => {
        this.singleMechanismAnimation(state);
      }, Math.round((1000 * 60) / (state.inputSpeed * 360 * this.speedMultiplier)));
    }
  }

  reset() {
        for (let state of this.animationStates) {
            for (let jointIndex = 0; jointIndex < state.jointIDs.length; jointIndex++) {
                this.stateService.getMechanism().getJoint(state.jointIDs[jointIndex]).setCoordinates(state.startingPositions[jointIndex]);
            }
            state.isPaused = true;
            state.currentFrameIndex = 0;
        }
    }
    getSubMechanismIndex(jointID: number): number{
        for(let state of this.animationStates){
            if(state.jointIDs.indexOf(jointID) != -1){
                return this.animationStates.indexOf(state);
            }
        }
        return -1;
    }
    getCurrentTime(mechanismIndex: number){
        let animationState = this.animationStates[mechanismIndex];
        return (60 / (animationState.inputSpeed * 360)) * animationState.currentFrameIndex;

    }
    setCurrentTime(timeInSeconds: number, mechanismIndex: number){
        let animationState = this.animationStates[mechanismIndex];
        let frame = Math.round(timeInSeconds / (60 / (animationState.inputSpeed * 360)));
        while(frame > animationState.totalFrames){
            frame -= animationState.totalFrames;
        }
        while(frame < 0){
            frame += animationState.totalFrames
        }
        animationState.currentFrameIndex = frame;
    }
    updateProgress(progress: number) {
        this.animationProgressSource.next(progress);
    }
    setAnimationProgress(progress: number) {
        if (progress < 0 || progress > 1) {
            return;
        }

        for (let state of this.animationStates) {
            const frameIndex = Math.floor(progress * (state.totalFrames - 1));
            state.currentFrameIndex = frameIndex;

            for (let jointIndex = 0; jointIndex < state.jointIDs.length; jointIndex++) {
                const joint = this.stateService.getMechanism().getJoint(state.jointIDs[jointIndex]);
                const newPosition = state.animationFrames[frameIndex][jointIndex];

              //console.log(`Frame ${frameIndex}: Joint ${jointIndex} moving to `, newPosition);

                joint.setCoordinates(newPosition);
            }
        }

        this.updateProgress(progress);

    }

  nogetDirectionChanges(state: JointAnimationState | undefined): { clockwise?: { frame: number, position: Coord }, counterClockwise?: { frame: number, position: Coord } } {
    if (!state) return {};
    let clockwise: { frame: number, position: Coord } | undefined = undefined;
    let counterClockwise: { frame: number, position: Coord } | undefined = undefined;
    const trajectory: Coord[] = state.animationFrames.map(frame => frame[2]);

    for (let i = 1; i < trajectory.length - 1; i++) {
      const lastFrame = trajectory[i - 1];
      const thisFrame = trajectory[i];
      const nextFrame = trajectory[i + 1];

      const isDirectionChange = this.detectDirectionChange(lastFrame, thisFrame, nextFrame);
      if (isDirectionChange) {
        if (this.startDirectionCounterclockwise) {
          if (!clockwise) {
            clockwise = { frame: i, position: thisFrame };
          } else if (!counterClockwise) {
            counterClockwise = { frame: i, position: thisFrame };
          }
        } else {
          if (!counterClockwise) {
            counterClockwise = { frame: i, position: thisFrame };
          } else if (!clockwise) {
            clockwise = { frame: i, position: thisFrame };
          }
        }
      }
    }
    return { clockwise, counterClockwise };
  }

  getDirectionChanges(state: JointAnimationState | undefined): {
    clockwise?: { frame: number, position: Coord },
    counterClockwise?: { frame: number, position: Coord }
  } {
    if (!state) return {};

    // Log joint IDs and check their isInput status.
    console.log("Animation state jointIDs:", state.jointIDs);
    state.jointIDs.forEach((id, index) => {
      const joint = this.stateService.getMechanism().getJoint(id);
      console.log(`Joint index ${index} with ID ${id}: isInput =`, joint ? joint.isInput : "Not found");
    });

    let inputIndex = state.jointIDs.findIndex(jointId => {
      const joint = this.stateService.getMechanism().getJoint(jointId);
      return joint && joint.isInput === true;
    });
    if (inputIndex < 0) {
      console.warn("No joint marked as input found. Defaulting to index 0.");
      inputIndex = 0;
    }

    const inputJointId = state.jointIDs[inputIndex];
    const inputJoint = this.stateService.getMechanism().getJoint(inputJointId);

    let adjacentIndex: number | undefined = undefined;
    if (inputJoint) {
      const connectedLinks = this.stateService.getMechanism().getConnectedLinksForJoint(inputJoint);
      console.log("Connected links for input joint:", connectedLinks);
      if (connectedLinks.length > 0) {
        // Choose the first connected link.
        const link = connectedLinks[0];
        const jointsOnLink = link.getJoints();
        // Find the joint on this link that is NOT the input joint.
        const otherJoint = jointsOnLink.find(j => j.id !== inputJoint.id);
        if (otherJoint) {
          // Find the index of this "other" joint in the state.jointIDs array.
          adjacentIndex = state.jointIDs.findIndex(id => id === otherJoint.id);
          if (adjacentIndex === -1) {
            console.warn("Other joint not found in state.jointIDs. Defaulting to inputIndex.");
            adjacentIndex = inputIndex;
          }
        } else {
          console.warn("No other joint found on the connected link. Defaulting to inputIndex.");
          adjacentIndex = inputIndex;
        }
      } else {
        console.warn("No connected links for input joint. Defaulting to inputIndex.");
        adjacentIndex = inputIndex;
      }
    } else {
      console.warn("Input joint not found in mechanism. Defaulting to index 0.");
      adjacentIndex = 0;
    }

    console.log("Using joint index", adjacentIndex, "for trajectory calculation.");

    if (state.animationFrames.some(frame => frame.length <= adjacentIndex)) {
      console.error(`Some frames do not have an index ${adjacentIndex}. Check your animationFrames data!`);
      return {};
    }

    const trajectory: Coord[] = state.animationFrames.map(frame => frame[adjacentIndex]);
    console.log("Computed trajectory using joint index", adjacentIndex, ":", trajectory);

    let clockwise: { frame: number, position: Coord } | undefined = undefined;
    let counterClockwise: { frame: number, position: Coord } | undefined = undefined;

    for (let i = 1; i < trajectory.length - 1; i++) {
      const lastFrame = trajectory[i - 1];
      const thisFrame = trajectory[i];
      const nextFrame = trajectory[i + 1];

      const isDirectionChange = this.detectDirectionChange(lastFrame, thisFrame, nextFrame);
      if (isDirectionChange) {
        if (this.startDirectionCounterclockwise) {
          if (!clockwise) {
            clockwise = { frame: i, position: thisFrame };
            console.log("Detected clockwise change at frame", i, thisFrame);
          } else if (!counterClockwise) {
            counterClockwise = { frame: i, position: thisFrame };
            console.log("Detected counterclockwise change at frame", i, thisFrame);
          }
        } else {
          if (!counterClockwise) {
            counterClockwise = { frame: i, position: thisFrame };
            console.log("Detected counterclockwise change at frame", i, thisFrame);
          } else if (!clockwise) {
            clockwise = { frame: i, position: thisFrame };
            console.log("Detected clockwise change at frame", i, thisFrame);
          }
        }
      }
    }

    return { clockwise, counterClockwise };
  }



  detectDirectionChange(last: Coord, current: Coord, next: Coord): boolean {
    const xVelocityBefore = current.x - last.x;
    const xVelocityAfter = next.x - current.x;
    const yVelocityBefore = current.y - last.y;
    const yVelocityAfter = next.y - current.y;
    return (xVelocityBefore * xVelocityAfter < 0) && (yVelocityBefore * yVelocityAfter < 0);
  }


}
