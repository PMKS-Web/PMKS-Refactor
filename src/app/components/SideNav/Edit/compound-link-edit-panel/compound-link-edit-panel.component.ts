import { Component } from '@angular/core';
import { Link } from 'src/app/model/link';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';
import { Joint } from 'src/app/model/joint';
import { ColorService } from 'src/app/services/color.service';
import { CompoundLinkInteractor } from "src/app/controllers/compound-link-interactor";
import { CompoundLink } from "src/app/model/compound-link";

@Component({
  selector: 'app-compound-link-edit-panel',
  templateUrl: './compound-link-edit-panel.component.html',
  styleUrls: ['./compound-link-edit-panel.component.scss'],
})
export class CompoundLinkEditPanelComponent {

  // Tracks which UI sections are expanded
  sectionExpanded: { [key: string]: boolean } = {
    LBasic: true,
    LVisual: false,
    LComponent: false,
    LMass: true,
    LCompound: true,
    FBasic: true,
    FVisual: false,
  };

  isLocked = false;
  isEditingTitle: boolean = false;
  selectedIndex: number = this.getColorIndex();
  referenceJoint: Joint | undefined;
  uniqueJoints: Set<Joint> = this.getUniqueJoints();

  constructor(private stateService: StateService, private interactionService: InteractionService, private colorService: ColorService) {}

  // Helper to get the selected object cast as a compound link
  getSelectedObject(): CompoundLink {
    let compoundLink = this.interactionService.getSelectedObject() as CompoundLinkInteractor;
    return compoundLink.compoundLink as CompoundLink;
  }

  // Returns a list of all sublinks connected to the compound link
  getAllConnectedLinks(): IterableIterator<Link> {
    let compoundLink = this.getSelectedObject();
    return compoundLink.links.values();
  }

  // Computes and returns the length of a sublink
  getLinkLength(currentLink: Link): number {
    return currentLink.calculateLength()?.toFixed(4) as unknown as number;
  }

  // Computes and returns the angle of a sublink
  getLinkAngle(currentLink: Link): number {
    return currentLink.calculateAngle()?.toFixed(4) as unknown as number;
  }

  getLinkJoints(currentLink: Link): Map<number, Joint> {
    return currentLink.joints;
  }

  // Get list of all unique joints from all links
  getUniqueJoints(): Set<Joint> {
    let allUniqueJoints: Set<Joint> = new Set();
    for (let link of this.getAllConnectedLinks()) {
      for (let joint of link.joints.values()) {
        allUniqueJoints.add(joint);
      }
    }
    return allUniqueJoints;
  }

  // Returns the joints associated with a given sublink
  getLinkComponents(currentLink: Link): IterableIterator<Joint> {
    return this.getLinkJoints(currentLink).values();
  }

  // Returns the compound link's name
  getCompoundLinkName(): string {
    return this.getSelectedObject().name;
  }

  // Returns the lock state of the compound link
  getCompoundLinkLockState(): boolean {
    return this.getSelectedObject().lock;
  }

  // Updates the compound link's name and exits edit mode
  setCompoundLinkName(newName: string) {
    this.getSelectedObject().name = newName;
    this.isEditingTitle = false;
  }

  // Toggles whether the compound link is locked/unlocked
  updateCompoundLinkLock(): void {
    this.isLocked = !this.isLocked;
    this.getSelectedObject().lock = this.isLocked;
  }

  // Sets the reference joint for distance/angle calculations
  onReferenceJointSelected(joint: Joint) {
    this.referenceJoint = joint;
    console.log('Selected Joint:', this.referenceJoint);
  }

  // Gets distance from reference joint to center of mass
  getReferenceJointDist(): number {
    let refJointCoord = this.referenceJoint?.coords;
    let xDiff = 0;
    let yDiff = 0;

    if (refJointCoord) {
      xDiff = refJointCoord.x - this.getSelectedObject().centerOfMass.x;
      yDiff = refJointCoord.y - this.getSelectedObject().centerOfMass.y;
    }

    return this.roundToFour(Math.sqrt((xDiff * xDiff) + (yDiff * yDiff)));
  }

  // Gets angle from reference joint to center of mass
  getReferenceJointAngle(): number {
    let refJointCoord = this.referenceJoint?.coords;
    let vectorX = 0;
    let vectorY = 0;

    if (refJointCoord) {
      vectorX = this.getSelectedObject().centerOfMass.x - refJointCoord.x;
      vectorY = this.getSelectedObject().centerOfMass.y - refJointCoord.y;
    }

    const angleInRadians = Math.atan2(vectorY, vectorX);
    let angleInDegrees = angleInRadians * (180 / Math.PI);

    if (angleInDegrees > 180) {
      angleInDegrees -= 360;
    } else if (angleInDegrees < -180) {
      angleInDegrees += 360;
    }

    return this.roundToFour(angleInDegrees);
  }

  // Sets new angle from reference joint to center of mass
  setReferenceJointAngle() {}

  // Sets new distance from reference joint to center of mass
  setReferenceJointDist() {}

  // Deletes the selected compound link
  deleteCompoundLink() {
    this.stateService.getMechanism().removeCompoundLink(this.getSelectedObject());
    this.interactionService.deselectObject();
  }

  onTitleBlockClick(event: MouseEvent): void {
    const clickedElement = event.target as HTMLElement;
    if (clickedElement && clickedElement.classList.contains('edit-svg')) {
      this.isEditingTitle = true;
    }
  }

  // Rounds a number to 3 decimal places
  roundToThree(round:number): number{
    return parseFloat(round.toFixed(3));
  }

  // Rounds a number to 4 decimal places
  roundToFour(round: number): number {
    return round.toFixed(4) as unknown as number;
  }

  // Gets available color options
  getColors(): string[] {
    return this.colorService.getLinkColorOptions();
  }

  // Gets index of the current link's color in the color palette
  getColorIndex(): number {
    return this.colorService.getLinkColorIndex(this.getSelectedObject().id);
  }

  // Sets the color of the compound link
  setLinkColor(newColor: number) {
    this.getSelectedObject().setColor(newColor);
    this.selectedIndex = newColor;
  }
}
