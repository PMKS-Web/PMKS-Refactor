import { Component, OnDestroy, OnInit} from '@angular/core'
import { Interactor } from 'src/app/controllers/interactor';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { Link } from 'src/app/model/link';
import { Mechanism } from 'src/app/model/mechanism';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';
import { Joint } from 'src/app/model/joint';
import { ColorService } from 'src/app/services/color.service';
import { FormControl, FormGroup } from "@angular/forms";
import { LinkComponent } from '../../../Grid/link/link.component';
import { Coord } from 'src/app/model/coord';


@Component({
    selector: 'app-link-edit-panel',
    templateUrl: './link-edit-panel.component.html',
    styleUrls: ['./link-edit-panel.component.scss'],

})
export class LinkEditPanelComponent{

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
      //icon paths for dual button for addFracer and addForce
      public addTracerIconPath: string = "assets/icons/addTracer.svg";
      public addForceIconPath: string = "assets/icons/addForce.svg";


    constructor(private stateService: StateService, private interactionService: InteractionService, private colorService: ColorService){

    }

    //helper function to access current selected object (will always be a link here)
    getSelectedObject(): Link{
        let link = this.interactionService.getSelectedObject() as LinkInteractor;
        return link.getLink();
    }

    //helper function to access the mechanism
    getMechanism(): Mechanism {
      return this.stateService.getMechanism();
    }

    lockLink(): void {
        this.isLocked = !this.isLocked;
        console.log('Setting in link edit panel')
        this.getSelectedObject().locked = this.isLocked;
    }

  getLinkLength(): number {
    const length = this.getSelectedObject().calculateLength();
    if (length !== null && length !== undefined) {
      return Math.round(length * 100) / 10000;
    }
    return 0; // or handle null/undefined case as per your application logic
  }

  getLinkAngle(): number {
    const angle = this.getSelectedObject().calculateAngle();
    console.log(`Angle in degrees from calculateAngle: ${angle}`);
    if (angle !== null && angle !== undefined) {
      // Round to the nearest hundredth
      return Math.round(angle * 100) / 10000;
    }
    return 0; // Handle null/undefined case as per your application logic
  }

  getLinkJoints(): Map<number, Joint>{
        return this.getSelectedObject().joints;
    }

    //Returns the joints contained in a link.
    getLinkComponents(): Joint[]{
        return Array.from(this.getLinkJoints().values());
    }

    getLinkName(): string{
        return this.getSelectedObject().name;
    }

    setLinkLength(newLength: number): void{
      let refJoint = this.getSelectedObject().joints.get(0);
      for (const joint of this.getSelectedObject().joints.values()) {
        if (joint !== null && joint !== undefined) {
          refJoint = joint;
          break;
        }
      }
      if(refJoint) {
        console.log("Reference joint ID: " + refJoint.id)
        this.getSelectedObject().setLength(newLength, refJoint);
      }
    }

    setLinkAngle(newAngle: number): void{
      let refJoint = this.getSelectedObject().joints.get(0);
      for (const joint of this.getSelectedObject().joints.values()) {
        if (joint !== null && joint !== undefined) {
          refJoint = joint;
          break;
        }
      }
      if(refJoint) {
        this.getSelectedObject().setAngle(newAngle, refJoint);
      }
    }


    setLinkName(newName: string){
        this.getSelectedObject().name = newName;
        this.isEditingTitle=false;
    }

    //will create a tracer at the center of mass of the link
    addTracer(): void{
        let CoM = this.getSelectedObject().centerOfMass;
        let linkID = this.getSelectedObject().id;
        this.getMechanism().addJointToLink(linkID, CoM);
    }

    //deletes the link and calls deselectObject to close the panel
    deleteLink(){
        console.log("link " + this.getSelectedObject().id + " has been deleted")
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

    //helper function to quickly round to 4 decimals
    roundToFour(round:number): number{
        return Math.round(round * 1000) /1000;
    }

    getColors(): string[]{
        return this.colorService.getLinkColorOptions();
    }

    getColor(): string{
        return this.getSelectedObject().color;
    }

    getColorIndex(): number{
        return this.colorService.getLinkColorIndex(this.getSelectedObject().id);
    }

    setLinkColor(newColor: number){
        console.log(newColor);
        this.getSelectedObject().setColor(newColor);
        this.selectedIndex=newColor;
    }


}
