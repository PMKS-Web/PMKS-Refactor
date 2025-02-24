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

    private animationStates: JointAnimationState[];
    private invaldMechanism: boolean;
    private animationProgressSource = new BehaviorSubject<number>(0);
    animationProgress$ = this.animationProgressSource.asObservable();

    constructor(private stateService: StateService, private positionSolver: PositionSolverService) {
        this.animationStates = new Array();
        this.invaldMechanism = true;
        this.positionSolver.getKinematicsObservable().subscribe(updatedPositions => {
            this.initializeAnimations();
        });
    }
    isInvalid(): boolean {
        return this.invaldMechanism;
    }

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
        this.invaldMechanism = this.animationStates.length == 0 ? true : false;
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
            if (state.currentFrameIndex == state.totalFrames - 1) {
                state.currentFrameIndex = 0;
            } else {
                state.currentFrameIndex++;
            }

            const progress = state.currentFrameIndex / (state.totalFrames - 1);
            this.updateProgress(progress);

            for (let jointIndex = 0; jointIndex < state.jointIDs.length; jointIndex++) {
                this.stateService.getMechanism()
                    .getJoint(state.jointIDs[jointIndex])
                    .setCoordinates(state.animationFrames[state.currentFrameIndex][jointIndex]);
            }

            setTimeout(() => {
                this.singleMechanismAnimation(state)
            }, Math.round((1000 * 60) / (state.inputSpeed * 360)));
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
                joint.setCoordinates(newPosition);
            }
        }

        this.updateProgress(progress);
    }
}