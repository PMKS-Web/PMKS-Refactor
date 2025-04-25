export interface Action {
  type: string;
  jointId?: number;
  jointData?: JointSnapshot;
  linksData?: LinkSnapshot[];
  extraJointsData?: JointSnapshot[];
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
  coords: { x: number; y: number; };
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
