import { Component, OnInit } from '@angular/core'
import { StateService } from "src/app/services/state.service";
import { InteractionService } from "src/app/services/interaction.service";
import { JointInteractor } from "src/app/controllers/joint-interactor"
import { Mechanism } from "src/app/model/mechanism";
import { Joint } from "src/app/model/joint";
import { Form, FormControl, FormGroup } from "@angular/forms";
import { Link } from "src/app/model/link";

interface Tab {
  selected: boolean,
  label: string,
  icon: string
}
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
  public weldIconPath: string = "assets/icons/weld.svg";
  public addInputIconPath: string = "assets/icons/addInput.svg";
  public rotateRightIconPath: string = "assets/icons/rotateRight.svg";
  public rotateLeftIconPath: string = "assets/icons/rotateLeft.svg";

  constructor(private stateService: StateService, private interactorService: InteractionService) {
    console.log("joint-edit-panel.constructor");

  }

  getMechanism(): Mechanism { return this.stateService.getMechanism(); }

  getCurrentJoint() {
    let currentJointInteractor = this.interactorService.getSelectedObject();

    // check the lock- disable dragging if the joint is locked, enable it if not
    if (currentJointInteractor) {
      if ((currentJointInteractor as JointInteractor).getJoint().locked) {
        console.log("Cannot drag current selected joint!")
        currentJointInteractor.draggable = false;
      }
      else { currentJointInteractor.draggable = true; }
    }
    return (currentJointInteractor as JointInteractor).getJoint();
  }


  getJointName(): string { return this.getCurrentJoint().name; }
  // get x coord and y coord return the number of the currently selected coord
  // set x and y are used in conjunction with the dual input blocks. by using
  // the mechanism's built in setXCoord function, we are able to update with no
  // errors
  getJointXCoord(): number {
    return Math.round(this.getCurrentJoint().coords.x * 100) / 100;
  }

  getJointYCoord(): number {
    return Math.round(this.getCurrentJoint().coords.y * 100) / 100;
  }


  setJointXCoord(xCoordInput: number): void {
    console.log(`Setting Joint ${this.getCurrentJoint().id}, X coord as ${xCoordInput}`);
    this.getMechanism().setXCoord(this.getCurrentJoint().id, xCoordInput);
  }
  setJointYCoord(yCoordInput: number): void {
    console.log(`Setting Joint ${this.getCurrentJoint().id}, X coord as ${yCoordInput}`);
    this.getMechanism().setYCoord(this.getCurrentJoint().id, yCoordInput as number);
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
  // TODO figure out where the joint names are displayed on screen and make it the name, not ID
  setJointName(newName: string) {
    console.log("Here is the current name of the joint ", this.getCurrentJoint().name);
    this.getCurrentJoint().name = newName;
    console.log("Here is the new name of the joint ", this.getCurrentJoint().name);
    this.isEditingTitle = false;
  }
  deleteJoint() {
    this.getMechanism().removeJoint(this.getCurrentJoint().id);
    this.interactorService.deselectObject();
  }



  getJointLockState(): boolean {
    return this.getCurrentJoint().locked;
  }

  // geteLinksForJoint and getConnectedJoints are both used to dynamically
  // view and modify the connected joints in a mechanism. Is sent to a loop of
  // dual input blocks in the HTML, that's created by looping through all of the
  // connected joints
  getLinksForJoint(): IterableIterator<Link> {
    return this.getMechanism().getConnectedLinksForJoint(this.getCurrentJoint()).values();
  }

  // Function utilized in conjunction with dual input blocks to change the angle of the current
  // joint (the first parameter) in relation to the second joint (the second parameter).
  changeJointAngle(notCurrentJoint: number, newAngle: number): void {
    for (const link of this.getLinksForJoint()) {
      const jointIds = Array.from(link.joints.keys());
      if (jointIds.includes(notCurrentJoint)) {
        link.setAngle(newAngle, this.getCurrentJoint());
      }
    }
  }

  // Function utilized in conjunction with dual input blocks to change the distance of the current
  // joint (the first parameter) in relation to the second joint (the second parameter).
  changeJointDistance(notCurrentJoint: number, newDistance: number): void {
    for (const link of this.getLinksForJoint()) {
      const jointIds = Array.from(link.joints.keys());
      if (jointIds.includes(notCurrentJoint)) {
        link.setLength(newDistance, this.getCurrentJoint());
      }
    }
  }

  getConnectedJoints(): Joint[] {
    const connectedLinks: Link[] = Array.from(this.getLinksForJoint());
    const allJoints: Joint[] = connectedLinks.reduce(
      (accumulator: Joint[], link: Link) => {
        const jointMap: Map<number, Joint> = link.joints;
        const joints: Joint[] = Array.from(jointMap.values());
        return accumulator.concat(joints);
      },
      []
    );
    // console.log(allJoints);
    return allJoints;
  }

  getJointDistance(otherJoint: Joint): number {
    let currentJoint = this.getCurrentJoint();
    let xDiff = otherJoint.coords.x - currentJoint.coords.x;
    let yDiff = otherJoint.coords.y - currentJoint.coords.y;

    let hypotenuse = Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));
    return Math.round(hypotenuse * 100) / 10000;
  }

  getJointAngle(otherJoint: Joint): number {
    let currentJoint = this.getCurrentJoint();
    let xDiff = otherJoint.coords.x - currentJoint.coords.x;
    let yDiff = otherJoint.coords.y - currentJoint.coords.y;

    const angleInRadians = Math.atan2(yDiff, xDiff);
    let angleInDegrees = angleInRadians * (180 / Math.PI);

    // Normalize the angle to be within [-180, 180] degrees
    if (angleInDegrees > 180) {
      angleInDegrees -= 360;
    } else if (angleInDegrees < -180) {
      angleInDegrees += 360;
    }

    return Math.round(angleInDegrees * 100) / 10000;
  }

  // handleToggleGroundChanged is used by the edit panel implementation of a toggle block
  // to accurately portray whether or not the toggle is selected for grounding.
  handleToggleGroundChange(stateChange: boolean) {
    console.log("Toggle State Changed: ", stateChange);
    const currentJoint = this.getCurrentJoint();
    if (stateChange) { this.getMechanism().addGround(this.getCurrentJoint().id); }
    else { this.getMechanism().removeGround(this.getCurrentJoint().id); }
  }

  // these values are passed into a tri button. these handle making and removing input.
  //        [btn1Disabled]="!getCurrentJoint().canAddInput() || getCurrentJoint().isInput"

  makeInputClockwise() { console.log("We would be making the input clockwise here"); }
  makeInputCounterClockwise() { console.log("We would be making the input counter clockwise here"); }


  // these values are passed into a tri button. these handle the welding and unwelding
  // of the current joint

  handleToggleWeldChange(stateChange: boolean) {
    console.log("Toggle State Changed: ", stateChange);
    const currentJoint = this.getCurrentJoint();
    if (stateChange) { this.getMechanism().addWeld(this.getCurrentJoint().id); }
    else { this.getMechanism().removeWeld(this.getCurrentJoint().id); }
  }

  handleToggleInputChange(stateChange: boolean) {
    console.log("Toggle State Changed: ", stateChange);
    const currentJoint = this.getCurrentJoint();
    if (stateChange) { this.getMechanism().addInput(this.getCurrentJoint().id); }
    else { this.getMechanism().removeInput(this.getCurrentJoint().id); }
  }



  getJointColor() { }
  setJointColor() { }

  canAddWeld(): boolean {
    return this.getMechanism().canAddWeld(this.getCurrentJoint());
  }

  canAddInput(): boolean {
    return this.getCurrentJoint().isGrounded;
  }

}
