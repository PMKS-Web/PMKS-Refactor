import { Position } from 'src/app/model/position';
import { Coord } from '../../../model/coord';
import { Force } from 'src/app/model/force';

//THE ACTION CLASS CONTAINS ANY POSSIBLE VALUE WE
//WOULD NEED TO UNDO A USER ACTION
export interface Action {
  type: string;
  linkId?: number;

  jointId?: number;
  oldCoords?: { x: number; y: number };
  newCoords?: { x: number; y: number };

  jointData?: JointSnapshot;
  extraJointsData?: JointSnapshot[];

  oldPosition?: Position;
  oldPositionArray?: Position[];

  linkData?: LinkSnapshot;
  linkLockData?: LinkLockSnapshot;
  linkMoveData?: LinkMoveSnapshot;
  linkTracerData?: LinkTracerSnapshot;
  linkForceData?: LinkForceSnapshot;

  oldJointPositions?: Array<{
    jointId: number;
    coords: { x: number; y: number };
  }>;
  newJointPositions?: Array<{
    jointId: number;
    coords: { x: number; y: number };
  }>;

  linksData?: LinkSnapshot[];
  parentLinkId?: number;
  start?: Coord;
  end?: Coord;
  attachJointId?: number;

  newLinkId?: number;
  newJointIds?: number[];
  oldForce?: Force;
  newForce?: Force;
  oldDistance?: number;
  newDistance?: number;
  oldAngle?: number;
  newAngle?: number;
}

export interface LinkSnapshot {
  id: number;
  jointIds: number[];
  name: string;
  mass: number;
  angle: number;
  locked: boolean;
  color: string;
}

export interface JointSnapshot {
  id: number;
  coords: { x: number; y: number };
  name: string;
  type: number;
  angle: number;
  isGrounded: boolean;
  isInput: boolean;
  inputSpeed: number;
  isWelded: boolean;
  locked: boolean;
  isHidden: boolean;
  isReference: boolean;
}

export interface LinkLockSnapshot {
  linkId: number;
}

export interface LinkMoveSnapshot {
  linkId: number;
  oldJointPositions: Array<{
    jointId: number;
    coords: { x: number; y: number };
  }>;
  newJointPositions: Array<{
    jointId: number;
    coords: { x: number; y: number };
  }>;
}

export interface LinkTracerSnapshot {
  linkId: number;
  jointId: number;
  coords: { x: number; y: number };
}

export interface LinkForceSnapshot {
  linkId: number;
  forceId: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
}
