import { Injectable } from '@angular/core';
import { StateService } from './state.service';
import { Coord } from '../model/coord';
import { PositionSolverService } from './kinematic-solver.service';
import { AnimationPositions } from './kinematic-solver.service';
import { BehaviorSubject } from 'rxjs';

export interface JointAnimationState {
  mechanismIndex: number;
  currentFrameIndex: number;
  totalFrames: number;
  isPaused: boolean;
  startingPositions: Coord[];
  jointIDs: number[];
  animationFrames: Coord[][];
  inputSpeed: number;
}

@Injectable({
  providedIn: 'root',
})
export class AnimationService {
  public startDirectionCounterclockwise: boolean = true;
  private animationStates: JointAnimationState[];
  private invaldMechanism: boolean;
  private animationProgressSource = new BehaviorSubject<number>(0);
  private speedMultiplier: number = 1;
  animationProgress$ = this.animationProgressSource.asObservable();

  // Initializes the AnimationService, sets up state array, and subscribes to kinematic updates.
  constructor(
    private stateService: StateService,
    private positionSolver: PositionSolverService
  ) {
    this.animationStates = [];
    this.invaldMechanism = true;
    this.positionSolver.getKinematicsObservable().subscribe(() => {
      this.initializeAnimations();
    });
  }

  private frameIndexSource = new BehaviorSubject<number>(0);
  public currentFrameIndex$ = this.frameIndexSource.asObservable();

  // Emits the current frame index to subscribers for synchronization with the animation timeline.
  emitCurrentFrameIndex(index: number) {
    this.frameIndexSource.next(index);
  }

  // Retrieves the JointAnimationState object for a given sub-mechanism index, if it exists.
  getAnimationState(index: number): JointAnimationState | undefined {
    {
      return this.animationStates[index];
    }
  }

  // Sets the playback speed multiplier for all ongoing animations.
  setSpeedmultiplier(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  // Returns whether the current mechanism is invalid (no animation states available).
  isInvalid(): boolean {
    return this.invaldMechanism;
  }

  // Initializes all animation states by extracting frame data from the PositionSolverService.
  initializeAnimations() {
    this.animationStates = [];
    let frames: AnimationPositions[] = this.positionSolver.getAnimationFrames();

    for (
      let subMechanismIndex = 0;
      subMechanismIndex < frames.length;
      subMechanismIndex++
    ) {
      //intialize animation states
      let mechanismIndex: number = subMechanismIndex,
        currentFrameIndex: number = 0,
        totalFrames: number = frames[subMechanismIndex].positions.length,
        isPaused: boolean = true,
        startingPositions: Coord[] = [],
        jointIDs: number[] = [],
        animationFrames: Coord[][] = frames[subMechanismIndex].positions,
        inputSpeed: number = this.stateService
          .getMechanism()
          .getJoint(
            frames[subMechanismIndex].correspondingJoints[0]
          ).inputSpeed;
      for (
        let jointIndex = 0;
        jointIndex < frames[subMechanismIndex].correspondingJoints.length;
        jointIndex++
      ) {
        startingPositions.push(
          frames[subMechanismIndex].positions[0][jointIndex]
        );
        jointIDs.push(
          frames[subMechanismIndex].correspondingJoints[jointIndex]
        );
      }
      this.animationStates.push({
        mechanismIndex: mechanismIndex,
        currentFrameIndex: currentFrameIndex,
        totalFrames: totalFrames,
        isPaused: isPaused,
        startingPositions: startingPositions,
        jointIDs: jointIDs,
        animationFrames: animationFrames,
        inputSpeed: inputSpeed,
      });
    }

    this.invaldMechanism = this.animationStates.length == 0;
  }

  // Starts or pauses animation for all sub-mechanisms based on the playPause flag.
  animateMechanisms(playPause: boolean) {
    if (!playPause) {
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

  // Recursively updates joint positions for a single mechanism’s animation frames.
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
          this.emitCurrentFrameIndex(state.currentFrameIndex);
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
        : 1 - rawProgress;

      // Send that to the timeline
      this.updateProgress(displayProgress);

      // Update each joint's position for this frame
      for (
        let jointIndex = 0;
        jointIndex < state.jointIDs.length;
        jointIndex++
      ) {
        this.stateService
          .getMechanism()
          .getJoint(state.jointIDs[jointIndex])
          .setCoordinates(
            state.animationFrames[state.currentFrameIndex][jointIndex]
          );
      }

      setTimeout(() => {
        this.singleMechanismAnimation(state);
      }, Math.round((1000 * 60) / (state.inputSpeed * 360 * this.speedMultiplier)));
    }
  }

  // Resets each mechanism’s joints to their starting positions and pauses the animation.
  reset() {
    for (let state of this.animationStates) {
      for (
        let jointIndex = 0;
        jointIndex < state.jointIDs.length;
        jointIndex++
      ) {
        this.stateService
          .getMechanism()
          .getJoint(state.jointIDs[jointIndex])
          .setCoordinates(state.startingPositions[jointIndex]);
      }
      state.isPaused = true;
      state.currentFrameIndex = 0;
    }
    this.emitCurrentFrameIndex(0);
  }

  // Finds and returns the sub-mechanism index that contains the specified joint ID, or –1 if not found.
  getSubMechanismIndex(jointID: number): number {
    for (let state of this.animationStates) {
      if (state.jointIDs.indexOf(jointID) != -1) {
        return this.animationStates.indexOf(state);
      }
    }
    return -1;
  }
  // Sends the normalized animation progress value (0–1) to subscribers.
  updateProgress(progress: number) {
    this.animationProgressSource.next(progress);
  }

  // Sets joint positions to correspond to a specific normalized progress value across all frames.
  setAnimationProgress(progress: number) {
    if (progress < 0 || progress > 1) {
      return;
    }

    for (let state of this.animationStates) {
      const frameIndex = Math.floor(progress * (state.totalFrames - 1));
      state.currentFrameIndex = frameIndex;

      for (
        let jointIndex = 0;
        jointIndex < state.jointIDs.length;
        jointIndex++
      ) {
        const joint = this.stateService
          .getMechanism()
          .getJoint(state.jointIDs[jointIndex]);
        const newPosition = state.animationFrames[frameIndex][jointIndex];

        //console.log(`Frame ${frameIndex}: Joint ${jointIndex} moving to `, newPosition);

        joint.setCoordinates(newPosition);
      }

      this.emitCurrentFrameIndex(frameIndex);
    }

    this.updateProgress(progress);
  }

  // Analyzes a JointAnimationState to identify direction changes (clockwise and counter-clockwise) in the trajectory.
  getDirectionChanges(state: JointAnimationState | undefined): {
    clockwise?: { frame: number; position: Coord };
    counterClockwise?: { frame: number; position: Coord };
    clockwise2?: { frame: number; position: Coord };
    counterClockwise2?: { frame: number; position: Coord };
  } {
    if (!state) return {};

    console.log('Animation state jointIDs:', state.jointIDs);
    state.jointIDs.forEach((id, index) => {
      const joint = this.stateService.getMechanism().getJoint(id);
      console.log(
        `Joint index ${index} with ID ${id}: isInput =`,
        joint ? joint.isInput : 'Not found'
      );
    });

    let inputIndex = state.jointIDs.findIndex((jointId) => {
      const joint = this.stateService.getMechanism().getJoint(jointId);
      return joint && joint.isInput;
    });
    if (inputIndex < 0) {
      console.warn('No joint marked as input found. Defaulting to index 0.');
      inputIndex = 0;
    }

    const inputJointId = state.jointIDs[inputIndex];
    const inputJoint = this.stateService.getMechanism().getJoint(inputJointId);

    let adjacentIndex: number | undefined = undefined;
    if (inputJoint) {
      const connectedLinks = this.stateService
        .getMechanism()
        .getConnectedLinksForJoint(inputJoint);
      console.log('Connected links for input joint:', connectedLinks);
      if (connectedLinks.length > 0) {
        // Choose the first connected link.
        const link = connectedLinks[0];
        const jointsOnLink = link.getJoints();
        // Find the joint on this link that is NOT the input joint.
        const otherJoint = jointsOnLink.find((j) => j.id !== inputJoint.id);
        if (otherJoint) {
          // Find the index of this other joint in the state.jointIDs array.
          adjacentIndex = state.jointIDs.findIndex(
            (id) => id === otherJoint.id
          );
          if (adjacentIndex === -1) {
            console.warn(
              'Other joint not found in state.jointIDs. Defaulting to inputIndex.'
            );
            adjacentIndex = inputIndex;
          }
        } else {
          console.warn(
            'No other joint found on the connected link. Defaulting to inputIndex.'
          );
          adjacentIndex = inputIndex;
        }
      } else {
        console.warn(
          'No connected links for input joint. Defaulting to inputIndex.'
        );
        adjacentIndex = inputIndex;
      }
    } else {
      console.warn(
        'Input joint not found in mechanism. Defaulting to index 0.'
      );
      adjacentIndex = 0;
    }

    console.log(
      'Using joint index',
      adjacentIndex,
      'for trajectory calculation.'
    );

    if (state.animationFrames.some((frame) => frame.length <= adjacentIndex)) {
      console.error(
        `Some frames do not have an index ${adjacentIndex}. Check your animationFrames data!`
      );
      return {};
    }

    const trajectory: Coord[] = state.animationFrames.map(
      (frame) => frame[adjacentIndex]
    );
    console.log(
      'Computed trajectory using joint index',
      adjacentIndex,
      ':',
      trajectory
    );

    let clockwise: { frame: number; position: Coord } | undefined;
    let counterClockwise: { frame: number; position: Coord } | undefined;
    let clockwise2: { frame: number; position: Coord } | undefined;
    let counterClockwise2: { frame: number; position: Coord } | undefined;

    for (let i = 1; i < trajectory.length - 1; i++) {
      const lastFrame = trajectory[i - 1];
      const thisFrame = trajectory[i];
      const nextFrame = trajectory[i + 1];

      if (this.detectDirectionChange(lastFrame, thisFrame, nextFrame)) {
        if (this.startDirectionCounterclockwise) {
          if (!clockwise) {
            clockwise = { frame: i, position: thisFrame };
          } else if (!counterClockwise) {
            counterClockwise = { frame: i, position: thisFrame };
          } else if (!clockwise2) {
            clockwise2 = { frame: i, position: thisFrame };
          } else if (!counterClockwise2) {
            counterClockwise2 = { frame: i, position: thisFrame };
          }
        } else {
          if (!counterClockwise) {
            counterClockwise = { frame: i, position: thisFrame };
          } else if (!clockwise) {
            clockwise = { frame: i, position: thisFrame };
          } else if (!counterClockwise2) {
            counterClockwise2 = { frame: i, position: thisFrame };
          } else if (!clockwise2) {
            clockwise2 = { frame: i, position: thisFrame };
          }
        }
      }
    }

    return { clockwise, counterClockwise, clockwise2, counterClockwise2 };
  }

  // Detects whether the movement direction has reversed via velocity sign changes between three consecutive coordinates.
  detectDirectionChange(last: Coord, current: Coord, next: Coord): boolean {
    const xVelocityBefore = current.x - last.x;
    const xVelocityAfter = next.x - current.x;
    const yVelocityBefore = current.y - last.y;
    const yVelocityAfter = next.y - current.y;
    return (
      xVelocityBefore * xVelocityAfter < 0 &&
      yVelocityBefore * yVelocityAfter < 0
    );
  }

  public get isAnimating(): boolean {
    return this.animationStates.some(s => !s.isPaused);
  }

  public currentDegreesOfFreedom(): number {
    return this.positionSolver.getDegrees();
  }



}
