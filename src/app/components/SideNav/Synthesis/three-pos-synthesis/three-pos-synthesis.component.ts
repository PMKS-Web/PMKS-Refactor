import { Component, Input, OnInit, OnChanges, Output, EventEmitter, numberAttribute } from '@angular/core';
import { Interactor } from 'src/app/controllers/interactor';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { Link } from 'src/app/model/link';
import { Mechanism } from 'src/app/model/mechanism';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';
import { Joint } from 'src/app/model/joint';
import { ColorService } from 'src/app/services/color.service';
import { FormControl, FormGroup } from "@angular/forms";
import { LinkComponent } from 'src/app/components/Grid/link/link.component';
import { Coord } from 'src/app/model/coord';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChangeDetectorRef } from '@angular/core';




export class AppModule { }

@Component({
    selector: 'three-pos-synthesis',
    templateUrl: './three-pos-synthesis.component.html',
    styleUrls: ['./three-pos-synthesis.component.scss'],

})
export class ThreePosSynthesis{

    /*  THE POSITION VALUES ARE ALL HARD CODED BECAUSE THE BACKEND ISN'T SET UP
        ALL OF THESE FUNCTIONS SHOULD BE WRITTEN IN THE BACK END AND CALLED TO ON THE FRONT END */

    sectionExpanded: { [key: string]: boolean } = {
        Basic: false,
      };
    @Input() disabled: boolean=false;
    @Input() tooltip: string = '';
    @Input() input1Value: number=0;
    @Input() label1: string ="Length";
    @Output() input1Change: EventEmitter<number> = new EventEmitter<number>();
    // handle the enter key being pressed and updating the values of the input blocks
    onEnterKeyInput1() {this.input1Change.emit(this.input1Value);}
    onBlurInput1() {this.input1Change.emit(this.input1Value);}
    buttonLabel: string = 'Generate Four-Bar';
    reference: string = "Center";
    positions: number[] = [];
    couplerLength: number = 2;
    //stores position values
    pos1X: number = 0;
    pos1Y: number = 0;
    pos1Angle: number = 0;
    pos1Specified: boolean = false;
    pos2X: number = 0;
    pos2Y: number = 0;
    pos2Angle: number = 0;
    pos2Specified: boolean = false;
    pos3X: number = 0;
    pos3Y: number = 0;
    pos3Angle: number = 0;
    pos3Specified: boolean = false;
    position1: Link|null = null;
    position2: Link|null = null;
    position3: Link|null = null;
    fourBarGenerated: boolean = false;
    sixBarGenerated: boolean = false;
    coord1A = new Coord(this.pos1X - this.couplerLength/2, this.pos1Y);
    coord2A = new Coord(this.pos1X + this.couplerLength/2, this.pos1Y);
    coord1B = new Coord(this.pos2X - this.couplerLength/2, this.pos2Y);
    coord2B = new Coord(this.pos2X + this.couplerLength/2, this.pos2Y);
    coord1C = new Coord(this.pos3X - this.couplerLength/2, this.pos3Y);
    coord2C = new Coord(this.pos3X + this.couplerLength/2, this.pos3Y);
    private mechanism: Mechanism;

    constructor(private stateService: StateService, private interactionService: InteractionService, private colorService: ColorService, private cdr: ChangeDetectorRef){
      this.mechanism = this.stateService.getMechanism();
    }

setReference(r: string) {
    this.reference = r;
}

getReference(): string{
    return this.reference;
}

specifyPosition(index: number){
    if(index===1) {
      this.pos1Specified = true;
      this.mechanism.addLink(this.coord1A, this.coord2A);
      const links = this.mechanism.getArrayOfLinks();
      this.position1 = links[links.length - 1];
    }
    else if(index===2) {
      this.pos2Specified = true;
      this.mechanism.addLink(this.coord1B, this.coord2B);
      const links = this.mechanism.getArrayOfLinks();
      this.position1 = links[links.length - 1];
    }
    else if(index===3) {
      this.pos3Specified = true;
      this.mechanism.addLink(this.coord1C, this.coord2C);
      const links = this.mechanism.getArrayOfLinks();
      this.position1 = links[links.length - 1];
    }
}

resetPos(pos: number){
    if(pos==1){
        this.pos1Angle=0;
        this.pos1X=0;
        this.pos1Y=0;
    }
    else if(pos==2){
        this.pos2Angle=0;
        this.pos2X=0;
        this.pos2Y=0;
    }
    else {
        this.pos3Angle=0;
        this.pos3X=0;
        this.pos3Y=0;
    }
}

isFourBarGenerated(): boolean {
    return this.fourBarGenerated;
}

isSixBarGenerated(): boolean {
    return this.sixBarGenerated;
  }
  getLastJoint(joints: IterableIterator<Joint>): Joint | undefined{
    let lastJoint: Joint | undefined;
    for (const joint of joints) {
      lastJoint = joint;
    }
    if (lastJoint !== undefined) {
      return lastJoint;
    }
    else
      return undefined;
  }
generateFourBar(){
  let listOfLinks = this.mechanism.getArrayOfLinks();
  console.log(listOfLinks);
  let len;
  let i;
  for (i = 0, len = listOfLinks.length; i < len; i++) {
    let linkId = listOfLinks[i].id;
    console.log(linkId);
    this.mechanism.removeLink(linkId);
    console.log("LIST OF LINKS AFTER DELETION:");
    console.log(this.mechanism.getArrayOfLinks());
  }

  this.fourBarGenerated = !this.fourBarGenerated;
  this.cdr.detectChanges();
  let joint1 = this.coord1A;
  let joint2 = this.coord2A;
  let joint3 = this.coord1C;
  let joint4 = this.coord2C;

  this.mechanism.addLink(joint1, joint2);

  let joints = this.mechanism.getJoints(); //makes a list of all the joints in the mechanism
  let lastJoint= this.getLastJoint(joints);
  if (lastJoint !== undefined) {
    this.mechanism.addLinkToJoint(lastJoint.id, joint3);
  }

  joints=this.mechanism.getJoints(); //updates list of all joints
  lastJoint= this.getLastJoint(joints);
  if (lastJoint !== undefined) {
    this.mechanism.addLinkToJoint(lastJoint.id, joint4);
  }

  //adds the grounded joints and input
  joints=this.mechanism.getJoints();
  for (const joint of joints) {
    if(joint.id===6){
      joint.addGround();
      joint.addInput();
    }
    if(joint.id===9){
      joint.addGround();
    }
  }

  console.log(this.mechanism);
}

generateSixBar() {
  this.sixBarGenerated = !this.sixBarGenerated;
  /*if (this.buttonLabel === 'Generate Four-Bar') {
    this.buttonLabel = 'Clear Four-Bar';
  } else {
    this.buttonLabel = 'Generate Four-Bar';
  }
  */
  this.cdr.detectChanges();
}

//clearSixBar() {
    //this.sixBarGenerated = false;
  //}
//Find way to center/length equidistant on each side of x/y position
setCouplerLength(x: number){
  this.couplerLength = x;
  if(this.reference === "Center") {
    if (this.position1){
      this.position1.setLength(this.couplerLength, this.position1.getJoints()[0]);
      //Call function to center?
    }
    if (this.position2){
      this.position2.setLength(this.couplerLength, this.position2.getJoints()[0]);
    }
    if (this.position3){
      this.position3.setLength(this.couplerLength, this.position3.getJoints()[0]);
    }
  }
  else if (this.reference === "Back"){
    if (this.position1){
      this.position1.setLength(this.couplerLength, this.position1.getJoints()[0]);
    }
    if (this.position2){
      this.position2.setLength(this.couplerLength, this.position2.getJoints()[0]);
    }
    if (this.position3){
      this.position3.setLength(this.couplerLength, this.position3.getJoints()[0]);
    }
  }
  else {
    if (this.position1){
      this.position1.setLength(this.couplerLength, this.position1.getJoints()[1]);
    }
    if (this.position2){
      this.position2.setLength(this.couplerLength, this.position2.getJoints()[1]);
    }
    if (this.position3){
      this.position3.setLength(this.couplerLength, this.position3.getJoints()[1]);
    }
  }
}
//Check on interactions when angles are weird
setPosXCoord(x: number, posNum: number) {
  if (posNum === 1) {
    this.pos1X = x;
    const backJoint = this.position1!.getJoints()[0];
    const frontJoint = this.position1!.getJoints()[1];
    if (this.reference === "Center") {
      //harder
    }
    else if (this.reference === "Back") {
      backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
      frontJoint.setCoordinates(new Coord(x+this.couplerLength, frontJoint.coords.y));
    }
    else {
      frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
      backJoint.setCoordinates(new Coord(x-this.couplerLength, backJoint.coords.y));
    }
  }
  else if (posNum === 2) {
    this.pos2X = x;
    const backJoint = this.position2!.getJoints()[0];
    const frontJoint = this.position2!.getJoints()[1];
    if (this.reference === "Center") {
      //harder
    }
    else if (this.reference === "Back") {
      backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
      frontJoint.setCoordinates(new Coord(x+this.couplerLength, frontJoint.coords.y));
    }
    else {
      frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
      backJoint.setCoordinates(new Coord(x-this.couplerLength, backJoint.coords.y));
    }
  }
  else if (posNum === 3) {
      this.pos3X = x;
    const backJoint = this.position3!.getJoints()[0];
    const frontJoint = this.position3!.getJoints()[1];
    if (this.reference === "Center") {
      //harder
    }
    else if (this.reference === "Back") {
      backJoint.setCoordinates(new Coord(x, backJoint.coords.y));
      frontJoint.setCoordinates(new Coord(x+this.couplerLength, frontJoint.coords.y));
    }
    else {
      frontJoint.setCoordinates(new Coord(x, frontJoint.coords.y));
      backJoint.setCoordinates(new Coord(x-this.couplerLength, backJoint.coords.y));
    }
  }
}

setPosYCoord(y: number, posNum: number){

  if(posNum === 1){
    this.pos1Y = y;
    const backJoint = this.position1!.getJoints()[0];
    const frontJoint = this.position1!.getJoints()[1];
    if (this.reference === "Center") {
      //harder
    }
    else if (this.reference === "Back") {
      backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
      frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
      //call setangleto?
    }
    else {
      frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
      backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
    }
  }
  else if(posNum === 2){
    const backJoint = this.position2!.getJoints()[0];
    const frontJoint = this.position2!.getJoints()[1];
    if (this.reference === "Center") {
      //harder
    }
    else if (this.reference === "Back") {
      backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
      frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y+this.couplerLength));
    }
    else {
      frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
      backJoint.setCoordinates(new Coord(backJoint.coords.x, y+this.couplerLength));
    }
  }
  else if (posNum === 3){
    this.pos3Y = y;
    const backJoint = this.position3!.getJoints()[0];
    const frontJoint = this.position3!.getJoints()[1];
    if (this.reference === "Center") {
      //harder
    }
    else if (this.reference === "Back") {
      backJoint.setCoordinates(new Coord(backJoint.coords.x, y));
      frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y+this.couplerLength));
    }
    else {
      frontJoint.setCoordinates(new Coord(frontJoint.coords.x, y));
      backJoint.setCoordinates(new Coord(backJoint.coords.x, y+this.couplerLength));
    }
  }
}

setPositionAngle(x: number, posNum: number){

  if(posNum === 1){
    this.pos1Angle = x;

  }
  else if(posNum === 2){
    this.pos2Angle = x;

  }
  else if (posNum === 3){
    this.pos3Angle = x;

  }
}

getPosXCoord(posNum: number): number{
    if(posNum==1)
        return this.pos1X;
    else if(posNum==2)
        return this.pos2X;
    else
        return this.pos3X;
}

getPosYCoord(posNum: number): number{
    if(posNum==1)
        return this.pos1Y;
    else if(posNum==2)
        return this.pos2Y;
    else
        return this.pos3Y;
}

getPosAngle(posNum: number): number{
    if(posNum==1)
        return this.pos1Angle;
    else if(posNum==2)
        return this.pos2Angle;
    else
        return this.pos3Angle;
}


isPositionDefined(index: number): boolean {
    if(index==1){
        return this.pos1Specified;
    }
    if(index==2)
        return this.pos2Specified
    if(index==3)
        return this.pos3Specified;
    return false;
}

getFirstUndefinedPosition(): number{
    if(!this.pos1Specified){
        return 1;
    }
    if(!this.pos2Specified){
        return 2;}
    if(!this.pos3Specified){
        return 3;}
    return 0;
}

  deletePosition(index: number) {
    if (index === 1) {
      this.pos1Specified = false;
    } else if (index === 2) {
      this.pos2Specified = false;
    } else if (index === 3) {
      this.pos3Specified = false;
    }

    // Remove all links if the four-bar has been generated
    if (this.fourBarGenerated) {
      let listOfLinks = this.mechanism.getArrayOfLinks();
      console.log(listOfLinks);
      let len;
      let i;
      for (i = 0, len = listOfLinks.length; i < len; i++) {
        let linkId = listOfLinks[i].id;
        console.log(linkId);
        this.mechanism.removeLink(linkId);
        console.log("LIST OF LINKS AFTER DELETION:");
        console.log(this.mechanism.getArrayOfLinks());
      }
      this.fourBarGenerated = false;
    }
  }

allPositionsDefined(): boolean {
    if(this.pos1Specified && this.pos2Specified && this.pos3Specified)
        return true;
    else
        return false;
}

  removeAllPositions() {
    // Remove all links regardless of whether the four-bar has been generated
    let listOfLinks = this.mechanism.getArrayOfLinks();
    console.log(listOfLinks);
    let len;
    let i;
    for (i = 0, len = listOfLinks.length; i < len; i++) {
      let linkId = listOfLinks[i].id;
      console.log(linkId);
      this.mechanism.removeLink(linkId);
      console.log("LIST OF LINKS AFTER DELETION:");
      console.log(this.mechanism.getArrayOfLinks());
    }

    // Reset positions
    for (let i = 1; i <= 3; i++) {
      this.deletePosition(i);
      this.resetPos(i);
    }

    // Reset flags
    this.fourBarGenerated = false;
    this.sixBarGenerated = false;
  }
}
