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
    couplerLength: number = 5;
    //stores position values
    pos1X: number = 0;
    pos1Y: number = 1;
    pos1Angle: number = 0;
    pos1Specified: boolean = false;
    pos2X: number = -3;
    pos2Y: number = 1;
    pos2Angle: number = 0;
    pos2Specified: boolean = false;
    pos3X: number = 4;
    pos3Y: number = 5;
    pos3Angle: number = 0;
    pos3Specified: boolean = false;
    fourBarGenerated: boolean = false;
    sixBarGenerated: boolean = false;
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
      //Need special case for when x coords are 0
      const coord1A = new Coord(this.pos1X - 1, this.pos1Y);
      const coord2A = new Coord(this.pos1X + 1, this.pos1Y);
      this.mechanism.addLink(coord1A, coord2A);
    }
    else if(index===2) {
      this.pos2Specified = true;
      const coord1B = new Coord(this.pos2X - 1, this.pos2Y);
      const coord2B = new Coord(this.pos2X + 1, this.pos2Y);
      this.mechanism.addLink(coord1B, coord2B);
    }
    else if(index===3) {
      this.pos3Specified = true;
      const coord1C = new Coord(this.pos3X - 1, this.pos3Y);
      const coord2C = new Coord(this.pos3X + 1, this.pos3Y);
      this.mechanism.addLink(coord1C, coord2C);
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
  let joint1 = new Coord((this.pos1X + 1) / -2, this.pos1Y);
  let joint2 = new Coord((this.pos1X + 1) / 2, this.pos1Y);
  let joint3 = new Coord(this.pos3X  / 2, this.pos3Y);
  let joint4 = new Coord((this.pos3X + (this.pos3X/2)) , this.pos3Y);

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

setCouplerLength(x: number){

}

setPosXCoord(x: number, posNum: number){

}
setPosYCoord(x: number, posNum: number){
}

setPositionAngle(x: number, posNum: number){

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
