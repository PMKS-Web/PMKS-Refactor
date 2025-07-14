import { Component } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { InteractionService } from 'src/app/services/interaction.service';
import { JointInteractor } from 'src/app/controllers/joint-interactor';
import { Mechanism } from 'src/app/model/mechanism';
import { Joint } from 'src/app/model/joint';
import { Link } from 'src/app/model/link';
import {
  LinkEditHoverService,
  LinkHoverState,
} from 'src/app/services/link-edit-hover.service';

@Component({
  selector: 'app-joint-edit-panel',
  templateUrl: './joint-edit-panel.component.html',
  styleUrls: ['./joint-edit-panel.component.scss'],
})
export class jointEditPanelComponent {
  graphExpanded: { [key: string]: boolean } = {
    basicBasic: true,
    basicVisual: false,
    advancedSettingsBasic: false,
    advancedSettingsVisual: false,
    distance: true,
  };
  isEditingTitle: boolean = false;
  units: string = 'cm';
  angles: string = 'º';
  constructor(
    private stateService: StateService,
    private interactorService: InteractionService,
    private linkHoverService: LinkEditHoverService
  ) {
    console.log('joint-edit-panel.constructor');
  }
  public pendingX?: number;
  public pendingY?: number;

  // Confirms and saves the X coordinate input
  confirmJointX(): void {
    const newX = this.pendingX;
    if (newX == null) return;

    const joint = this.getCurrentJoint();
    const oldX = this.getJointXCoord();
    const oldY = joint.coords.y; // grab the *current* Y too
    const newY = oldY; // Y stays the same in an X‑only edit

    if (Math.abs(oldX - newX) < 1e-6) {
      this.pendingX = undefined;
      return;
    }

    this.stateService.recordAction({
      type: 'setJoint',
      jointId: joint.id,
      oldCoords: { x: oldX, y: oldY },
      newCoords: { x: newX, y: newY },
    });

    this.setJointXCoord(newX);
    this.stateService.getMechanism().notifyChange();

    this.pendingX = undefined;
  }

  // Confirms and saves the Y coordinate input
  confirmJointY(): void {
    const newY = this.pendingY;
    if (newY == null) return;

    const joint = this.getCurrentJoint();
    const oldX = joint.coords.x; // X stays the same in a Y‑only edit
    const oldY = this.getJointYCoord();

    if (Math.abs(oldY - newY) < 1e-6) {
      this.pendingY = undefined;
      return;
    }

    this.stateService.recordAction({
      type: 'setJoint',
      jointId: joint.id,
      oldCoords: { x: oldX, y: oldY },
      newCoords: { x: oldX, y: newY },
    });

    this.setJointYCoord(newY);
    this.stateService.getMechanism().notifyChange();

    this.pendingY = undefined;
  }

  // Handles input of angle values when pressing Enter
  onAngleEnter(jointId: number, raw: string) {
    const newAngle = parseFloat(raw);
    if (isNaN(newAngle)) {
      return;
    }

    // figure out which link & compute oldAngle
    const current = this.getCurrentJoint();
    const link = Array.from(this.getLinksForJoint()).find((l) =>
      l.joints.has(jointId)
    )!;
    const other = link.joints.get(jointId)!;
    let oldAngle =
      (Math.atan2(
        other.coords.y - current.coords.y,
        other.coords.x - current.coords.x
      ) *
        180) /
      Math.PI;
    if (oldAngle < 0) oldAngle += 360;

    // only record if it really changed
    if (Math.abs(oldAngle - newAngle) < 1e-3) {
      return;
    }

    this.stateService.recordAction({
      type: 'changeJointAngle',
      linkId: link.id,
      jointId: current.id,
      oldAngle,
      newAngle,
    });

    link.setAngle(newAngle, current);
    this.getMechanism().notifyChange();
  }

  // Returns the mechanism state
  getMechanism(): Mechanism {
    return this.stateService.getMechanism();
  }

  // Returns the currently selected joint object
  getCurrentJoint() {
    let currentJointInteractor = this.interactorService.getSelectedObject();

    if (currentJointInteractor) {
      currentJointInteractor.draggable = !(
        currentJointInteractor as JointInteractor
      ).getJoint().locked;
    }
    return (currentJointInteractor as JointInteractor).getJoint();
  }

  // Returns the name of the current joint
  getJointName(): string {
    return this.getCurrentJoint().name;
  }

  // Gets the X coordinate of the joint
  getJointXCoord(): number {
    return this.getCurrentJoint().coords.x.toFixed(3) as unknown as number;
  }

  // Gets the Y coordinate of the joint
  getJointYCoord(): number {
    return this.getCurrentJoint().coords.y.toFixed(3) as unknown as number;
  }

  //Sets X coord
  setJointXCoord(xCoordInput: number): void {
    const joint = this.getCurrentJoint();
    const oldCoords = { x: joint.coords.x, y: joint.coords.y };
    const newCoords = { x: xCoordInput, y: oldCoords.y };
    if (newCoords.x !== oldCoords.x) {
      this.stateService.recordAction({
        type: 'setJoint',
        jointId: joint.id,
        oldCoords,
        newCoords,
      });
    }

    console.log(
      `Setting Joint ${this.getCurrentJoint().id}, X coord as ${xCoordInput}`
    );
    this.getMechanism().setXCoord(
      this.getCurrentJoint().id,
      parseFloat(xCoordInput.toFixed(3))
    );
  }

  //Sets Y coord
  setJointYCoord(yCoordInput: number): void {
    const joint = this.getCurrentJoint();
    const oldCoords = { x: joint.coords.x, y: joint.coords.y };
    const newCoords = { x: oldCoords.x, y: yCoordInput };

    if (newCoords.y !== oldCoords.y) {
      this.stateService.recordAction({
        type: 'setJoint',
        jointId: joint.id,
        oldCoords,
        newCoords,
      });
    }

    console.log(
      `Setting Joint ${this.getCurrentJoint().id}, Y coord as ${yCoordInput}`
    );
    this.getMechanism().setYCoord(
      this.getCurrentJoint().id,
      parseFloat(yCoordInput.toFixed(3))
    );
  }

  onTitleBlockClick(event: MouseEvent): void {
    console.log('Title clicked!');
    const clickedElement = event.target as HTMLElement;
    // Check if the clicked element has the 'edit-svg' class, so we can enable editing
    if (clickedElement && clickedElement.classList.contains('edit-svg')) {
      console.log('Edit SVG clicked!');
      this.isEditingTitle = true;
    }
  }

  // Updates the joint name and exits editing mode
  setJointName(newName: string) {
    console.log(
      'Here is the current name of the joint ',
      this.getCurrentJoint().name
    );
    this.getCurrentJoint().name = newName;
    console.log(
      'Here is the new name of the joint ',
      this.getCurrentJoint().name
    );
    this.isEditingTitle = false;
  }

  // Deletes the currently selected joint
  deleteJoint() {
    this.getMechanism().removeJoint(this.getCurrentJoint().id);
    this.interactorService.deselectObject();
  }

  // Returns whether the joint is locked
  getJointLockState(): boolean {
    return this.getCurrentJoint().locked;
  }

  // geteLinksForJoint and getConnectedJoints are both used to dynamically
  // view and modify the connected joints in a mechanism. Is sent to a loop of
  // dual input blocks in the HTML, that's created by looping through all of the
  // connected joints
  getLinksForJoint(): IterableIterator<Link> {
    return this.getMechanism()
      .getConnectedLinksForJoint(this.getCurrentJoint())
      .values();
  }

  // Changes the selected joints angel
  changeJointAngle(notCurrentJoint: number, newAngle: number): void {
    for (const link of this.getLinksForJoint()) {
      const jointIds = Array.from(link.joints.keys());
      if (!jointIds.includes(notCurrentJoint)) continue;

      const a = this.getCurrentJoint(),
        b = link.joints.get(notCurrentJoint)!;
      // compute old angle
      let oldAngle =
        (Math.atan2(b.coords.y - a.coords.y, b.coords.x - a.coords.x) * 180) /
        Math.PI;
      if (oldAngle < 0) oldAngle += 360;

      // only record if truly different
      if (Math.abs(oldAngle - newAngle) > 1e-6) {
        this.stateService.recordAction({
          type: 'changeJointAngle',
          linkId: link.id,
          jointId: a.id,
          oldAngle,
          newAngle,
        });

        // apply the change
        link.setAngle(newAngle, a);
        this.getMechanism().notifyChange();
      }

      break; // prevent any second iteration
    }
  }

  // Changes the selected joints distance
  changeJointDistance(notCurrentJoint: number, newDistance: number): void {
    for (const link of this.getLinksForJoint()) {
      const jointIds = Array.from(link.joints.keys());
      if (!jointIds.includes(notCurrentJoint)) continue;

      // compute old distance
      const a = this.getCurrentJoint(),
        b = link.joints.get(notCurrentJoint)!;
      const oldDistance = Math.hypot(
        b.coords.x - a.coords.x,
        b.coords.y - a.coords.y
      );

      // only record if it really changed
      if (Math.abs(oldDistance - newDistance) > 1e-6) {
        this.stateService.recordAction({
          type: 'changeJointDistance',
          linkId: link.id,
          jointId: a.id,
          oldDistance,
          newDistance,
        });

        // apply the change
        link.setLength(newDistance, a);
        this.getMechanism().notifyChange();
      }
      break;
    }
  }

  // Returns joints that are connected to the current joint
  getConnectedJoints(): Joint[] {
    const connectedLinks: Link[] = Array.from(this.getLinksForJoint());
    // console.log(allJoints);
    return connectedLinks.reduce((accumulator: Joint[], link: Link) => {
      const jointMap: Map<number, Joint> = link.joints;
      const joints: Joint[] = Array.from(jointMap.values());
      return accumulator.concat(joints);
    }, []);
  }

  // Calculates the distance from the current joint to a given joint
  getJointDistance(otherJoint: Joint): number {
    let currentJoint = this.getCurrentJoint();
    let xDiff = otherJoint.coords.x - currentJoint.coords.x;
    let yDiff = otherJoint.coords.y - currentJoint.coords.y;

    let hypotenuse = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
    return parseFloat(hypotenuse.toFixed(3));
  }

  // Calculates the angle from the current joint to a given joint
  getJointAngle(otherJoint: Joint): number {
    let currentJoint = this.getCurrentJoint();
    let xDiff = otherJoint.coords.x - currentJoint.coords.x;
    let yDiff = otherJoint.coords.y - currentJoint.coords.y;

    const angleInRadians = Math.atan2(yDiff, xDiff);
    let angleInDegrees = angleInRadians * (180 / Math.PI);

    // Normalize the angle to be within [0, 360] degrees
    if (angleInDegrees < 0) {
      angleInDegrees += 360;
    }

    return parseFloat(angleInDegrees.toFixed(3));
  }

  // Handles the toggle for grounding the joint
  handleToggleGroundChange(stateChange: boolean) {
    console.log('Toggle State Changed: ', stateChange);
    this.getCurrentJoint();
    if (stateChange) {
      this.getMechanism().addGround(this.getCurrentJoint().id);
    } else {
      this.getMechanism().removeGround(this.getCurrentJoint().id);
    }
  }

  // Handles the toggle for welding the joint
  handleToggleWeldChange(stateChange: boolean) {
    console.log('Toggle State Changed: ', stateChange);
    this.getCurrentJoint();
    if (stateChange) {
      this.getMechanism().addWeld(this.getCurrentJoint().id);
    } else {
      this.getMechanism().removeWeld(this.getCurrentJoint().id);
    }
  }

  // Handles the toggle for marking the joint as an input
  handleToggleInputChange(stateChange: boolean) {
    console.log('Toggle State Changed: ', stateChange);
    this.getCurrentJoint();
    if (stateChange) {
      this.getMechanism().addInput(this.getCurrentJoint().id);
    } else {
      this.getMechanism().removeInput(this.getCurrentJoint().id);
    }
  }

  // Determines whether welding should be shown for this joint
  canAddWeld(): boolean {
    return this.getMechanism().canAddWeld(this.getCurrentJoint());
  }

  // Determines whether input toggle should be shown for this joint
  canAddInput(): boolean {
    return this.getCurrentJoint().canAddInput();
  }
  onLengthHover(isHovering: boolean, otherJointId: number) {
    this.linkHoverService.setLengthHover(
      isHovering,
      this.getSharedLink(otherJointId)
    );
  }
  onAngleHover(isHovering: boolean, otherJointId: number) {
    this.linkHoverService.setAngleHover(
      isHovering,
      this.getSharedLink(otherJointId)
    );
  }
  getSharedLink(notCurrentJoint: number): number {
    for (const link of this.getLinksForJoint()) {
      const jointIds = Array.from(link.joints.keys());
      if (!jointIds.includes(notCurrentJoint)) continue;
      return link.id;
    }
    return -1;
  }
}
