import { Component } from '@angular/core';
import { Action } from 'rxjs/internal/scheduler/Action';
import { ForceInteractor } from 'src/app/controllers/force-interactor';
import { Coord } from 'src/app/model/coord';
import { Force, ForceFrame } from 'src/app/model/force';
import { Joint } from 'src/app/model/joint';
import { Link } from 'src/app/model/link';
import { Position } from 'src/app/model/position';

import { ColorService } from 'src/app/services/color.service';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';
import { UndoRedoService } from 'src/app/services/undo-redo.service';

@Component({
  selector: 'app-force-edit-panel',
  standalone: false,
  templateUrl: './force-edit-panel.component.html',
  styleUrl: './force-edit-panel.component.scss',
})
export class ForceEditPanelComponent {
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
  selectedIndex: number = this.getSelectedObject().getColorIndex();
  //icon paths for dual button for addFracer and addForce
  public addTracerIconPath: string = 'assets/icons/addTracer.svg';
  public addForceIconPath: string = 'assets/icons/addForce.svg';
  public pendingForceMagnitude?: number;
  public pendingForceAngle?: number;
  /** Buffers for component edits */
  public pendingForceX?: number;
  public pendingForceY?: number;

  public pendingPosX?: number;
  public pendingPosY?: number;
  units: string = 'cm';
  angles: string = 'º';
  isGlobalCoordinates: boolean = true;
  constructor(
    private stateService: StateService,
    private interactionService: InteractionService,
    private colorService: ColorService,
    private undoRedoService: UndoRedoService
  ) {}

  //helper function to access current selected object (will always be a link here)
  getSelectedObject(): Force {
    let link = this.interactionService.getSelectedObject() as ForceInteractor;
    return link.getForce();
  }
  getColorIndex(): number {
    return this.selectedIndex;
  }
  updateCoordinateSystem() {
    const thisForce = this.getSelectedObject();
    thisForce.frameOfReference = this.isGlobalCoordinates
      ? ForceFrame.Global
      : ForceFrame.Local;
  }
  //Returns the name of the selected Link
  getForceName(): string {
    return this.getSelectedObject().name;
  }
  setForceName(newName: string) {
    this.getSelectedObject().name = newName;
    this.isEditingTitle = false;
  }
  deleteForce() {
    console.log('force ' + this.getSelectedObject().id + ' has been deleted');
    this.stateService.getMechanism().removeForce(this.getSelectedObject().id);
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
  getForceMagnitude(): number {
    const magnitude = this.getSelectedObject().magnitude;
    if (magnitude !== null) {
      const x = magnitude.toFixed(3);
      return parseFloat(x);
    }
    return 0;
  }
  getForceAngle(): number {
    const angle = this.getSelectedObject().angle;
    if (angle !== null) {
      const x = angle.toFixed(3);
      return parseFloat(x);
    }
    return 0;
  }
  confirmForceMagnitude(): void {
    const raw = this.pendingForceMagnitude;
    if (raw == null) return;
    const oldLen = this.getForceMagnitude();
    const newLen = raw;
    if (Math.abs(oldLen - newLen) < 1e-6) {
      this.pendingForceMagnitude = undefined;
      return;
    }
    // Record exactly one undo entry
    this.undoRedoService.recordAction({
      type: 'changeForceMagnitude',
      linkId: this.getSelectedObject().id,
      // Use whichever joint anchors your link-length
      jointId: this.getSelectedObject().parentLink.joints.keys().next().value,
      oldDistance: oldLen,
      newDistance: newLen,
    });

    // Apply the change
    this.setForceMagnitude(newLen);
    this.stateService.getMechanism().notifyChange();

    this.pendingForceMagnitude = undefined;
  }

  confirmForceAngle(): void {
    const newLen = this.pendingForceAngle;
    if (newLen == null) return;
    const oldLen = this.getForceAngle();
    if (Math.abs(oldLen - newLen) < 1e-6) {
      this.pendingForceMagnitude = undefined;
      return;
    }
    this.undoRedoService.recordAction({
      type: 'changeForceAngle',
      linkId: this.getSelectedObject().id,
      jointId: this.getSelectedObject().parentLink.joints.keys().next().value,
      oldDistance: oldLen,
      newDistance: newLen,
    });
    const force = this.getSelectedObject();
    force.angle = newLen;
    force.updateFromAngle();
    this.stateService.getMechanism().notifyChange();

    this.pendingForceMagnitude = undefined;
  }
  confirmForceX(): void {
    const newLen = this.pendingForceX;
    const oldLen = this.getSelectedObject().calculateXComp();
    if (newLen == null || Math.abs(oldLen - newLen) < 1e-6) return;
    this.undoRedoService.recordAction({
      type: 'changeForceX',
      linkId: this.getSelectedObject().id,
      jointId: this.getSelectedObject().parentLink.joints.keys().next().value,
      oldDistance: oldLen,
      newDistance: newLen,
    });
    this.getSelectedObject().setXComp(newLen);
    this.stateService.getMechanism().notifyChange();
    this.pendingForceMagnitude = undefined;
  }
  confirmForceY(): void {
    const newLen = this.pendingForceY;
    const oldLen = this.getSelectedObject().calculateYComp();
    if (newLen == null || Math.abs(oldLen - newLen) < 1e-6) return;
    this.undoRedoService.recordAction({
      type: 'changeForceY',
      linkId: this.getSelectedObject().id,
      jointId: this.getSelectedObject().parentLink.joints.keys().next().value,
      oldDistance: oldLen,
      newDistance: newLen,
    });
    this.getSelectedObject().setYComp(newLen);
    this.stateService.getMechanism().notifyChange();
    this.pendingForceMagnitude = undefined;
  }

  confirmPosX(): void {
    const newLen = this.pendingPosX;
    const oldLen = this.getSelectedObject().start.x;
    if (newLen == null || Math.abs(oldLen - newLen) < 1e-6) return;
    this.undoRedoService.recordAction({
      type: 'changeForcePosX',
      linkId: this.getSelectedObject().id,
      jointId: this.getSelectedObject().parentLink.joints.keys().next().value,
      oldDistance: oldLen,
      newDistance: newLen,
    });
    this.getSelectedObject().start = new Coord( newLen, this.getSelectedObject().start.y);
    this.stateService.getMechanism().notifyChange();
    this.pendingPosX = undefined;
  }
  confirmPosY(): void {
    const newLen = this.pendingPosY
    const oldLen = this.getSelectedObject().start.y;
    if (newLen == null || Math.abs(oldLen - newLen) < 1e-6) return;
    this.undoRedoService.recordAction({
      type: 'changeForcePosY',
      linkId: this.getSelectedObject().id,
      jointId: this.getSelectedObject().parentLink.joints.keys().next().value,
      oldDistance: oldLen,
      newDistance: newLen,
    });
    this.getSelectedObject().start = new Coord( this.getSelectedObject().start.x, newLen);
    this.stateService.getMechanism().notifyChange();
    this.pendingPosY = undefined;
  }

  //place holders
  setForceMagnitude(magnitude: number): void {
    const force = this.getSelectedObject();
    force.magnitude = magnitude;
    force.updateFromAngle();
  }
  getColors(): string[] {
    return this.colorService.getLinkColorOptions();
  }
  setForceColor(newColor: number) {
    this.getSelectedObject().setColor(newColor);
    this.selectedIndex = newColor;
  }
  getForceX() {
    return this.getSelectedObject().calculateXComp().toFixed(3);
  }
  getForceY() {
    return this.getSelectedObject().calculateYComp().toFixed(3);
  }
  getPosX() {
    return this.getSelectedObject().start.x.toFixed(3);
  }
  getPosY() {
    return this.getSelectedObject().start.y.toFixed(3);
  }
}
