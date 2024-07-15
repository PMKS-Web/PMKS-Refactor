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
    fourBarGenerated: boolean = false;
    sixBarGenerated: boolean = false;

    constructor(private stateService: StateService, private interactionService: InteractionService, private colorService: ColorService, private cdr: ChangeDetectorRef){
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
  this.fourBarGenerated = !this.fourBarGenerated;
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
