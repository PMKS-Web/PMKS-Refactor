import { Component } from '@angular/core';
import { ForceInteractor } from 'src/app/controllers/force-interactor';
import { Coord } from 'src/app/model/coord';
import { Force } from 'src/app/model/force';
import { Joint } from 'src/app/model/joint';
import { Link } from 'src/app/model/link';

import { ColorService } from 'src/app/services/color.service';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';

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
  public pendingForceX: number = 0;
  public pendingForceY: number = 0;
  units: string = 'cm';
  angles: string = 'º';
  isGlobalCoordinates: boolean = true;
  constructor(
    private stateService: StateService,
    private interactionService: InteractionService,
    private colorService: ColorService
  ) {}

  //helper function to access current selected object (will always be a link here)
  getSelectedObject(): Force {
    let link = this.interactionService.getSelectedObject() as ForceInteractor;
    return link.getForce();
  }
  getColorIndex(): number {
    return this.selectedIndex;
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
    this.stateService.recordAction({
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
    const raw = this.pendingForceAngle;
    if (raw == null) return;
    const oldLen = this.getForceAngle();
    const newLen = raw;
    if (Math.abs(oldLen - newLen) < 1e-6) {
      this.pendingForceMagnitude = undefined;
      return;
    }
    // Record exactly one undo entry
    this.stateService.recordAction({
      type: 'changeForceAngle',
      linkId: this.getSelectedObject().id,
      jointId: this.getSelectedObject().parentLink.joints.keys().next().value,
      oldDistance: oldLen,
      newDistance: newLen,
    });

    // Apply the change
    this.getSelectedObject().angle = newLen;
    this.stateService.getMechanism().notifyChange();

    this.pendingForceMagnitude = undefined;
  }
  confirmForceX(): void {
    const newLen = this.pendingForceX;
    const oldLen = this.getSelectedObject().calculateXComp();
    if (newLen == null || Math.abs(oldLen - newLen)) return;
    this.stateService.recordAction({
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
    if (newLen == null || Math.abs(oldLen - newLen)) return;
    this.stateService.recordAction({
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

  //place holders
  setForceMagnitude(magnitude: number): void {
    this.getSelectedObject().magnitude = magnitude;
  }
  getColors(): string[] {
    return this.colorService.getLinkColorOptions();
  }
  setForceColor(newColor: number) {
    this.getSelectedObject().setColor(newColor);
    this.selectedIndex = newColor;
  }
  //round to 3 decimals :-)
  roundToThree(round: number): number {
    return parseFloat(round.toFixed(3));
  }
  getForceX() {
    return this.getSelectedObject().calculateXComp();
  }
  getForceY() {
    return this.getSelectedObject().calculateYComp();
  }
}
