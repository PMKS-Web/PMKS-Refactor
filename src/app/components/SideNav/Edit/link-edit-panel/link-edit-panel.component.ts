import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { Link } from 'src/app/model/link';
import { Mechanism } from 'src/app/model/mechanism';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';
import { Joint } from 'src/app/model/joint';
import { ColorService } from 'src/app/services/color.service';
import { UndoRedoService } from 'src/app/services/undo-redo.service';
import { NotificationService } from 'src/app/services/notification.service';

import { LinkEditHoverService } from 'src/app/services/link-edit-hover.service';
import { PositionEditHoverService } from 'src/app/services/position-edit-hover.service';
import { Coord } from 'src/app/model/coord';

@Component({
  selector: 'app-link-edit-panel',
  templateUrl: './link-edit-panel.component.html',
  styleUrls: ['./link-edit-panel.component.scss'],
})
export class LinkEditPanelComponent implements OnDestroy, OnInit {
  //map of each of the variables that determine whether each collapsible subsection is open
  sectionExpanded: { [key: string]: boolean } = {
    LBasic: true,
    LVisual: false,
    LComponent: false,
    LMass: false,
    LCompound: true,
    FBasic: true,
    FVisual: false,
  };
  isEditingTitle: boolean = false;
  isLocked: boolean = this.getSelectedObject().locked;
  selectedIndex: number = this.getColorIndex();
  //icon paths for dual button for addTracer and addForce
  public addTracerIconPath: string = 'assets/icons/addTracer.svg';
  public addForceIconPath: string = 'assets/icons/addForce.svg';
  public pendingLinkLength?: number;
  public pendingLinkAngle?: number;
  /** Buffers for component edits */
  public pendingCompX: Record<number, number> = {};
  public pendingCompY: Record<number, number> = {};
  unitSuffix: string = 'cm';
  angleSuffix: string = 'º';

  unitSuffixSubscription: Subscription = new Subscription();
  angleSuffixSubscription: Subscription = new Subscription();

  _preventDualButtons: boolean = false;

  constructor(
    private stateService: StateService,
    private interactionService: InteractionService,
    private colorService: ColorService,
    private linkHoverService: LinkEditHoverService,
    private undoRedoService: UndoRedoService,
    private notificationService: NotificationService
  ) {
      this.stateService.getAnimationBarComponent().stoppedAnimating.subscribe((isStopped) => {
      this._preventDualButtons = !isStopped;
    })
  }
  
  ngOnInit(){
    //subscript to listen for unit suffix from stateService
    this.unitSuffixSubscription = this.stateService.globalUSuffixCurrent.subscribe((unitSuffix)=>{
      this.unitSuffix = unitSuffix;
    })

    //subscript to listen for angle suffix from stateService
    this.angleSuffixSubscription = this.stateService.globalASuffixCurrent.subscribe((angleSuffix)=>{
      this.angleSuffix = angleSuffix;
    })
  }
    
  ngOnDestroy() {
    this.unitSuffixSubscription.unsubscribe();
    this.angleSuffixSubscription.unsubscribe();
    this.linkHoverService.clearHover();
  }

  // Saves the new X value for a joint component
  confirmCompX(jointId: number): void {
    const raw = this.pendingCompX[jointId];
    if (raw == null) return;

    let canEdit = this.confirmCanEdit();
    if (!canEdit) {
      delete this.pendingCompX[jointId];
      return;
    }

    const joint = this.getLinkComponents().find((j) => j.id === jointId)!;
    const oldX = joint.coords.x;
    const newX = raw;
    if (Math.abs(oldX - newX) < 1e-6) {
      delete this.pendingCompX[jointId];
      return;
    }

    // record one undo entry
    this.undoRedoService.recordAction({
      type: 'setJoint',
      jointId: jointId,
      oldCoords: { x: oldX, y: joint.coords.y },
      newCoords: { x: newX, y: joint.coords.y },
    });

    // apply and notify
    joint.coords.x = newX;
    this.getMechanism().notifyChange();

    delete this.pendingCompX[jointId];
  }

  // Saves the new Y value for a joint component
  confirmCompY(jointId: number): void {
    const raw = this.pendingCompY[jointId];
    if (raw == null) return;

    let canEdit = this.confirmCanEdit();
    if (!canEdit) {
      delete this.pendingCompY[jointId];
      return;
    }

    const joint = this.getLinkComponents().find((j) => j.id === jointId)!;
    const oldY = joint.coords.y;
    const newY = raw;
    if (Math.abs(oldY - newY) < 1e-6) {
      delete this.pendingCompY[jointId];
      return;
    }

    this.undoRedoService.recordAction({
      type: 'setJoint',
      jointId: jointId,
      oldCoords: { x: joint.coords.x, y: oldY },
      newCoords: { x: joint.coords.x, y: newY },
    });

    joint.coords.y = newY;
    this.getMechanism().notifyChange();

    delete this.pendingCompY[jointId];
  }

  // Saves the new pending link length
  confirmLinkLength(): void {
    const raw = this.pendingLinkLength;
    if (raw == null) return;

    const link = this.getSelectedObject();
    const oldLen = this.getLinkLength();
    const newLen = raw;
    if (Math.abs(oldLen - newLen) < 1e-6) {
      this.pendingLinkLength = undefined;
      return;
    }

    let canEdit = this.confirmCanEdit();
    if (!canEdit) {
      this.pendingLinkLength = undefined;
      return;
    }

    // Record exactly one undo entry
    this.undoRedoService.recordAction({
      type: 'changeJointDistance',
      linkId: link.id,
      // Use whichever joint anchors your link-length
      jointId: link.joints.keys().next().value,
      oldDistance: oldLen,
      newDistance: newLen,
    });

    // Apply the change
    this.setLinkLength(newLen);
    this.getMechanism().notifyChange();

    this.pendingLinkLength = undefined;
  }

  // Saves the new pending link angle
  confirmLinkAngle(): void {
    let raw = this.pendingLinkAngle; 
    if (raw == null) return;

    if (this.angleSuffix === 'rad') { //need to convert the 'raw' into degrees if the current unit is 'rad', we have to convert it because the logic in backend only works with unit in degrees.
      raw = raw * 180 / Math.PI;
    }

    const link = this.getSelectedObject();
    const oldAng = this.getLinkAngle(); 
    const newAng = raw;
    if (Math.abs(oldAng - newAng) < 1e-6) {
      this.pendingLinkAngle = undefined;
      return;
    }

    let canEdit = this.confirmCanEdit();
    if (!canEdit) {
      this.pendingLinkAngle = undefined;
      return;
    }

    this.undoRedoService.recordAction({
      type: 'changeJointAngle',
      linkId: link.id,
      jointId: link.joints.keys().next().value,
      oldAngle: oldAng,
      newAngle: newAng,
    });

    this.setLinkAngle(newAng);
    this.getMechanism().notifyChange();
    this.pendingLinkAngle = undefined;
  }

  // Any function that will make changes to the link should call this.confirmCanEdit() first,
  // to make sure that the mechanism is not in a state of animation, before making changes.
  confirmCanEdit(): boolean {
    if (this._preventDualButtons) {
      this.notificationService.showWarning(
        'Cannot edit link while Animation is in play or paused state!'
      );
      return false;
    } else {
      return true;
    }
  }

  onLengthHover(isHovering: boolean) {
    this.linkHoverService.setLengthHover(
      isHovering,
      this.getSelectedObject().id
    );
  }

  onAngleHover(isHovering: boolean) {
    this.linkHoverService.setAngleHover(
      isHovering,
      this.getSelectedObject().id
    );
  }
  //helper function to access current selected object (will always be a link here)
  getSelectedObject(): Link {
    let link = this.interactionService.getSelectedObject() as LinkInteractor;
    return link.getLink();
  }

  //helper function to access the mechanism
  getMechanism(): Mechanism {
    return this.stateService.getMechanism();
  }

  // Toggles the lock state of the link
  lockLink(): void {
    let canEdit = this.confirmCanEdit();
    if (!canEdit) {
      return;
    }
    this.isLocked = !this.isLocked;
    this.getSelectedObject().locked = this.isLocked;
  }

  // Returns the length of the selected link
  getLinkLength(): number {
    const length = this.getSelectedObject().calculateLength();
    if (length !== null) {
      const x = length.toFixed(3);
      return parseFloat(x);
    }
    return 0;
  }

  //I think this is getting called continuously, should probably find a way to amend that
  getLinkAngle(): number {
    let angleInDegrees = this.getSelectedObject().calculateAngle();
    //console.log(`Angle in degrees from calculateAngle: ${angle}`);
    if (angleInDegrees !== null) {
      if (this.angleSuffix === 'º') { // Degree
        if (angleInDegrees < 0) {
          angleInDegrees += 360; // Normalize to be within [0, 360]
        }
        // Round to the nearest hundredth
        const x = angleInDegrees.toFixed(3)
        return parseFloat(x);
    } else if (this.angleSuffix === 'rad') { // Radians
        let angleInRadians = angleInDegrees * (Math.PI)/180;

        if (angleInRadians < 0) {
          angleInRadians += 2 * (Math.PI); // Normalize to be within [0, 2pi]
        }

        return parseFloat(angleInRadians.toFixed(3));
      }
    }
    return 0;
  }

  //Returns the joints attached to the selected link
  getLinkJoints(): Map<number, Joint> {
    return this.getSelectedObject().joints;
  }

  //Returns the joints contained in a link.
  getLinkComponents(): Joint[] {
    return Array.from(this.getLinkJoints().values());
  }

  //Returns the name of the selected Link
  getLinkName(): string {
    return this.getSelectedObject().name;
  }

  // Sets the length of the selected Link
  setLinkLength(newLength: number): void {
    let refJoint = this.getSelectedObject().joints.get(0);
    for (const joint of this.getSelectedObject().joints.values()) {
      if (joint !== null && joint !== undefined) {
        refJoint = joint;
        break;
      }
    }
    if (refJoint) {
      this.getSelectedObject().setLength(newLength, refJoint);
    }
  }

  setLinkAngle(newAngle: number): void {
    let refJoint = this.getSelectedObject().joints.get(0);
    for (const joint of this.getSelectedObject().joints.values()) {
      if (joint !== null && joint !== undefined) {
        refJoint = joint;
        break;
      }
    }
    if (refJoint) {
      this.getSelectedObject().setAngle(newAngle, refJoint);
    }
  }

  setLinkName(newName: string) {
    this.getSelectedObject().name = newName;
    this.isEditingTitle = false;
  }

  // called when a click on dual button has been prevented.
  // used to show a notification to the user
  dualButtonClickStopped(stopped: boolean) {
    if (stopped) {
      this.confirmCanEdit();
    }
  }

  //will create a tracer at the center of mass of the link
  addTracer(): void {
    /*if (this.btn1Disabled) {
      this.actionPrevented.emit(true);
      return;
    }*/

    let CoM = this.getSelectedObject().centerOfMass;
    let linkID = this.getSelectedObject().id;
    this.getMechanism().addJointToLink(linkID, CoM);
  }
  addForce(): void {
    /*if (this.btn2Disabled) {
      this.actionPrevented.emit(true);
      return;
    }*/

    let CoM = this.getSelectedObject().centerOfMass;
    let linkID = this.getSelectedObject().id;
    this.getMechanism().addForceToLink(
      linkID,
      CoM,
      CoM.subtract(new Coord(0, 1))
    );
    this.undoRedoService.recordAction({
      type: 'addForce',
      oldForce: this.getMechanism().getMostRecentForce().clone(),
    });
    console.log('hi');
  }

  //deletes the link and calls deselectObject to close the panel
  deleteLink() {
    let canEdit = this.confirmCanEdit();
    if (!canEdit) {
      return;
    }
    console.log('link ' + this.getSelectedObject().id + ' has been deleted');
    this.stateService.getMechanism().removeLink(this.getSelectedObject().id);
    this.interactionService.deselectObject();
  }

  //allows link name to be edited
  onTitleBlockClick(event: MouseEvent): void {
    const clickedElement = event.target as HTMLElement;
    // Check if the clicked element has the 'edit-svg' class, so we can enable editing
    if (clickedElement && clickedElement.classList.contains('edit-svg')) {
      console.log('Edit SVG clicked!');
      this.isEditingTitle = true;
    }
  }

  //helper function to quickly round to 3 decimals :)
  roundToThree(round: number): number {
    return parseFloat(round.toFixed(3));
  }

  // Returns available colors from the color palette
  getColors(): string[] {
    return this.colorService.getLinkColorOptions();
  }

  // Gets the color index of the link from the palette
  getColorIndex(): number {
    return this.colorService.getLinkColorIndex(this.getSelectedObject().id);
  }

  // Sets the color of the link to the selected index
  setLinkColor(newColor: number) {
    console.log(newColor);
    this.getSelectedObject().setColor(newColor);
    this.selectedIndex = newColor;
  }
}
