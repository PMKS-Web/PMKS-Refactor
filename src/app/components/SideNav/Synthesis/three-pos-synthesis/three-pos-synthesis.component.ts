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
    pos1Y: number = 3;
    pos1Angle: number = 0;
    pos1Specified: boolean = true;
    pos2X: number = 2;
    pos2Y: number = 3;
    pos2Angle: number = 0;
    pos2Specified: boolean = true;
    pos3X: number = 4;
    pos3Y: number = 0;
    pos3Angle: number = 0;
    pos3Specified: boolean = true;
    fourBarGenerated: boolean = false;
    sixBarGenerated: boolean = false;
    private mechanism: Mechanism;

    constructor(private stateService: StateService,
                private interactionService: InteractionService,
                private colorService: ColorService,
                private cdr: ChangeDetectorRef,

    ){
      this.mechanism = this.stateService.getMechanism();
    }

  ngOnInit() {
    // Make sure to trigger change detection when the component is initialized
    this.cdr.detectChanges();
  }

  getLastJoint(joints: IterableIterator<Joint>): Joint | undefined {
    let lastJoint: Joint | undefined;
    for (const joint of joints) {
      lastJoint = joint;
    }
    return lastJoint;
  }

setReference(r: string) {
    this.reference = r;
}

getReference(): string{
    return this.reference;
}

specifyPosition(index: number){
    if(index==1)
        this.pos1Specified=true;
    if(index==2)
        this.pos2Specified=true;
    if(index==3)
        this.pos3Specified=true;
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

generateFourBar(){

  console.log('Position 1:', this.pos1X, this.pos1Y);
  console.log('Position 2:', this.pos2X, this.pos2Y);
  console.log('Position 3:', this.pos3X, this.pos3Y);
  // If the four-bar is already generated, we need to clear it
  if (this.fourBarGenerated) {
    console.log('Clearing four-bar linkage');
    // Clear existing links from the mechanism
    let listOfLinks = Array.from(this.mechanism.getJoints());
    for (let link of listOfLinks) {
      this.mechanism.removeLink(link.id);
    }
    this.fourBarGenerated = false;
  }
  // If the four-bar is not generated, create it
  else {
    console.log('Generating four-bar linkage');
    console.log('Position 1:', this.pos1X, this.pos1Y);
    console.log('Position 2:', this.pos2X, this.pos2Y);
    console.log('Position 3:', this.pos3X, this.pos3Y);
    // // Toggle the state of fourBarGenerated
    // this.fourBarGenerated = !this.fourBarGenerated;
    // this.cdr.detectChanges(); // Trigger change detection to update the view


  // Define the coordinates for the four-bar linkage using the hardcoded values
  let joint1 = new Coord(this.pos1X, this.pos1Y);
  let joint2 = new Coord(this.pos2X, this.pos2Y);
  let joint3 = new Coord(this.pos3X, this.pos3Y);
  // Create the fourth joint based on a simple calculation
  let joint4 = new Coord(this.pos3X + (this.pos3X - this.pos2X), this.pos3Y);

  // Add the first link between joint1 and joint2
  this.mechanism.addLink(joint1, joint2);

  // Retrieve the last joint added and create the next link
  let joints = this.mechanism.getJoints();
  let lastJoint = this.getLastJoint(joints);
  if (lastJoint !== undefined) {
    // Add the second link from the last joint to joint3
    this.mechanism.addLinkToJoint(lastJoint.id, joint3);
  }

  // Update joints list and add the third link to joint4
  joints = this.mechanism.getJoints();
  lastJoint = this.getLastJoint(joints);
  if (lastJoint !== undefined) {
    this.mechanism.addLinkToJoint(lastJoint.id, joint4);
  }

  // Define ground and input for the joints
  joints = this.mechanism.getJoints();
  for (const joint of joints) {
    if (joint.id === 2) {  // Assuming joint1 is the fixed ground joint
      joint.addGround();
    }
    if (joint.id === 3) {  // Assuming joint2 is the input joint (the one that drives the mechanism)
      joint.addGround();
      joint.addInput();
    }
    if (joint.id === 4) {  // Assuming joint4 is another fixed ground joint
      joint.addGround();
    }
  }
    // Mark the four-bar as generated
    this.fourBarGenerated = true;
  }

  // Trigger change detection to update the view
  this.cdr.detectChanges();


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

setPosXCoord(value: number, posNum: number){
  if (posNum === 1) this.pos1X = value;
  else if (posNum === 2) this.pos2X = value;
  else if (posNum === 3) this.pos3X = value;

}
setPosYCoord(value: number, posNum: number){
  if (posNum === 1) this.pos1Y = value;
  else if (posNum === 2) this.pos2Y = value;
  else if (posNum === 3) this.pos3Y = value;
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

deletePosition(index: number){
    if(index==1)
        this.pos1Specified=false;
    if(index==2)
        this.pos2Specified=false;
    if(index==3)
        this.pos3Specified=false;

}

allPositionsDefined(): boolean {
    if(this.pos1Specified && this.pos2Specified && this.pos3Specified)
        return true;
    else
        return false;
}

removeAllPositions(){
    for(let i=1; i<=3; i++){
        this.deletePosition(i);
        this.resetPos(i)
    }
    this.fourBarGenerated=false;
    this.sixBarGenerated=false;
}
}

