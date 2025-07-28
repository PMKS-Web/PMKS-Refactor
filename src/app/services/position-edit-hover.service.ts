import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
export interface PositionHoverState {
  isHoveringLength: boolean;
  isHoveringAngle: boolean;
  positionId?: number;
}
@Injectable({
  providedIn: 'root',
})
export class PositionEditHoverService {
  constructor() {}

  private hoverState = new BehaviorSubject<PositionHoverState>({
    isHoveringLength: false,
    isHoveringAngle: false,
  });

  hoverState$ = this.hoverState.asObservable();

  setLengthHover(isHovering: boolean, positionId?: number) {
    this.hoverState.next({
      ...this.hoverState.value,
      isHoveringLength: isHovering,
      positionId: positionId,
    });
    console.log('hiii ' + isHovering);
  }

  setAngleHover(isHovering: boolean, positionId?: number) {
    this.hoverState.next({
      ...this.hoverState.value,
      isHoveringAngle: isHovering,
      positionId,
    });
  }

  clearHover() {
    this.hoverState.next({
      isHoveringLength: false,
      isHoveringAngle: false,
    });
  }
}
