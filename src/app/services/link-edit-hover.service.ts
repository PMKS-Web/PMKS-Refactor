import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
export interface LinkHoverState {
  isHoveringLength: boolean;
  isHoveringAngle: boolean;
  linkId?: string;
}
@Injectable({
  providedIn: 'root',
})
export class LinkEditHoverService {
  constructor() {}

  private hoverState = new BehaviorSubject<LinkHoverState>({
    isHoveringLength: false,
    isHoveringAngle: false,
  });

  hoverState$ = this.hoverState.asObservable();

  setLengthHover(isHovering: boolean, linkId?: string) {
    this.hoverState.next({
      ...this.hoverState.value,
      isHoveringLength: isHovering,
      linkId,
    });
  }

  setAngleHover(isHovering: boolean, linkId?: string) {
    this.hoverState.next({
      ...this.hoverState.value,
      isHoveringAngle: isHovering,
      linkId,
    });
  }

  clearHover() {
    this.hoverState.next({
      isHoveringLength: false,
      isHoveringAngle: false,
    });
  }
}
