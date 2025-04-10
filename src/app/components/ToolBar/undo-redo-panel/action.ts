export interface Action {
  type: string;
  jointId?: number;

  jointData?: {
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
  };

}
