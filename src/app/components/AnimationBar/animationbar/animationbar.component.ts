import {Component, HostListener, Input} from '@angular/core'
import {CompoundLinkInteractor} from 'src/app/controllers/compound-link-interactor';
import {JointInteractor} from 'src/app/controllers/joint-interactor';
import {LinkInteractor} from 'src/app/controllers/link-interactor';
import {AnimationService} from 'src/app/services/animation.service';
import {InteractionService} from 'src/app/services/interaction.service';
//import { MatSnackBar } from '@angular/material/snack-bar';
import {JointComponent} from 'src/app/components/Grid/joint/joint.component'
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import {join} from "@angular/compiler-cli";
import {Coord} from "../../../model/coord";
import {PanZoomService} from "../../../services/pan-zoom.service";
import {SvgComponent} from "../../Grid/svg/svg.component";

@Component({
  selector: 'app-animation-bar',
  templateUrl: './animationbar.component.html',
  styleUrls: [ './animationbar.component.scss'],
})
export class AnimationBarComponent {

  private isAnimating: boolean = false;
  private isPausedAnimating: boolean = true;
  constructor(public interactionService: InteractionService, private animationService: AnimationService) {

  }

  @Input() cursorPosition: string = "";

  invalidMechanism() {
    return this.animationService.isInvalid();
  }

  getDegrees() {
    //put in animation service? to get specific number of degrees.
    return "N/A"
  }

  controlAnimation(state: string) {
    switch (state) {
      case 'pause':
        this.animationService.animateMechanisms(false);
        this.isAnimating = true;
        this.isPausedAnimating = true;
        break;
      case 'play':
        this.animationService.animateMechanisms(true);
        this.isAnimating = true;
        this.isPausedAnimating = false;
        //for some reason this doesn't work
        // if (this.interactionService.isDragging){
        //   this.snackBar.open("Cannot edit while animation is playing", '', {
        //     panelClass: 'my-custom-snackbar',
        //     horizontalPosition: 'center',
        //     verticalPosition: 'top',
        //     duration: 4000,
        //   });
        // }
        break;
      case 'stop':
        this.animationService.reset();
        this.isAnimating = false;
        this.isPausedAnimating = true;
        break;
    }
  }
  getIsAnimating():boolean{
    return this.isAnimating;
  }
  getIsPausedAnimating():boolean{
    return this.isPausedAnimating;
  }
  sendNotification(text: string) {
    console.log(text)
  }
  getMechanismIndex():number{
    let obj = this.interactionService.getSelectedObject();
    let index = -1;
    if(obj == undefined){
      return -1;
    }
    switch (obj.constructor.name){
      case 'JointInteractor':
        let jInteractor = obj as JointInteractor;
        index = this.animationService.getSubMechanismIndex(jInteractor.joint.id);
        break;
      case 'LinkInteractor':
        let lInteractor = obj as LinkInteractor;
        index = this.animationService.getSubMechanismIndex(lInteractor.link.getJoints()[0].id);
        break;
      case 'CompoundLinkInteractor':
        let cInteractor = obj as CompoundLinkInteractor;
        index = this.animationService.getSubMechanismIndex(cInteractor.compoundLink.getJoints()[0].id);
        break;
      case 'ForceInteractor':
        return -1
        break;
    }
    return index;
  }




}
