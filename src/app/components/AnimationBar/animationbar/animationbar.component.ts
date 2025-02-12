import {Component, HostListener, Input, OnInit} from '@angular/core'
import {CompoundLinkInteractor} from 'src/app/controllers/compound-link-interactor';
import {JointInteractor} from 'src/app/controllers/joint-interactor';
import {LinkInteractor} from 'src/app/controllers/link-interactor';
import {AnimationService} from 'src/app/services/animation.service';
import {InteractionService} from 'src/app/services/interaction.service';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { PositionSolverService } from 'src/app/services/kinematic-solver.service';
//import { MatSnackBar } from '@angular/material/snack-bar';
import {JointComponent} from 'src/app/components/Grid/joint/joint.component'
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import {join} from "@angular/compiler-cli";
import {Coord} from "../../../model/coord";
import {PanZoomService} from "../../../services/pan-zoom.service";
import {Mechanism} from "../../../model/mechanism";
import {StateService} from "src/app/services/state.service";

@Component({
  selector: 'app-animation-bar',
  templateUrl: './animationbar.component.html',
  styleUrls: [ './animationbar.component.scss'],
})
export class AnimationBarComponent implements OnInit{


  constructor(
    public interactionService: InteractionService,
    private animationService: AnimationService,
    private positionSolver: PositionSolverService,
    private stateService: StateService
  ) {
    this.animationService.animationProgress$.subscribe(progress => {

      this.sliderValue = progress * 100;
    });
  }

  ngOnInit() {
    this.stateService.setAnimationBarComponent(this);

  }


  @Input() mechanism!: Mechanism;

  private isAnimating: boolean = false;
  private isPausedAnimating: boolean = true;
  public animationSpeed: number = 1;
  timelineMarkers: { position: number; type: "clockwise" | "counterclockwise"; coords?: Coord }[] = [];
  sliderValue: number = 0;



  //BOTTOM BAR MOVED TO svg.component FOR CURSOR COORDINATE REASONS

  invalidMechanism() {
    return this.animationService.isInvalid();
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
        this.stateService.getMechanism().populateTrajectories(this.positionSolver);

        setTimeout(() => {
          this.updateTimelineMarkers();
        }, 100);
        //display the trajectories
        break;
      case 'stop':
        this.animationService.reset();
        this.isAnimating = false;
        this.isPausedAnimating = true;
        this.sliderValue = 0;
        this.stateService.getMechanism().clearTrajectories();
        //Clear the trajectories
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

  onSliderChange(value: number) {
    if (this.isAnimating && this.isPausedAnimating) {
      this.animationService.setAnimationProgress(value / 100);
    }
  }

  toggleAnimationSpeed(): void{
    const speedOptions = [0.5,1,2]
    const index = speedOptions.indexOf(this.animationSpeed);
    this.animationSpeed = speedOptions[(index+1) % speedOptions.length];

    this.animationService.setSpeedmultiplier(this.animationSpeed);
  }

  updateTimelineMarkers(): void {
    const mechanismIndex = this.getMechanismIndex();
    if (mechanismIndex === -1) {
      console.log("No valid mechanism index found, exiting...");
      return;
    }

    const mechanismState = this.animationService.getAnimationState(mechanismIndex);
    if (!mechanismState) {
      console.log("No mechanism state found, exiting...");
      return;
    }

    const changes = this.animationService.getDirectionChanges(mechanismState);

    const totalFrames = mechanismState.totalFrames ?? 1;
    console.log(`Total Frames in Animation: ${totalFrames}`);
    this.timelineMarkers = [];

    if (changes.clockwise !== undefined) {
      const frameIndex = changes.clockwise.frame;
      const position = Math.min(Math.max((frameIndex / totalFrames) * 100, 0), 100);
      console.log(`Clockwise at Frame ${changes.clockwise}: Position on Bar = ${position}%`);

      this.timelineMarkers.push({
        position,
        type: 'clockwise',
        coords: changes.clockwise.position  // Store exact coordinate
      });
    }

    if (changes.counterClockwise !== undefined) {
      const frameIndex = changes.counterClockwise.frame;
      const position = Math.min(Math.max((frameIndex / totalFrames) * 100, 0), 100);
      console.log(`CounterClockwise at Frame ${changes.counterClockwise}: Position on Bar = ${position}%`);

      this.timelineMarkers.push({
        position,
        type: 'counterclockwise',
        coords: changes.counterClockwise.position  // Store exact coordinate
      });
    }

    console.log("Final timelineMarkers array:", this.timelineMarkers);
  }

  logMarker(marker: any) {
    console.log("Rendering Marker:", marker);
    return true;
  }



}
