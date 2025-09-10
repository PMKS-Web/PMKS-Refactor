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
import { FormControl } from '@angular/forms';


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
    private stateService: StateService,
    private panZoomService: PanZoomService // Inject PanZoomService
  ) {
    this.animationService.animationProgress$.subscribe(progress => {
      if (!this.isDragging) {
        this.sliderValue = progress * 100;
      }
    });
  }

  zoomIn() {
    this.panZoomService.zoomIn();
  }

  zoomOut() {
    this.panZoomService.zoomOut();
  }

  resetView() {
    this.panZoomService.resetView();
  }

  showIDLabels() {
    this.stateService.toggleShowIDLabels();

        const mechanismIndex = this.getMechanismIndex();
        this.currentFrameIndex = this.animationService.getCurrentFrameIndex(mechanismIndex);
        this.animationService.emitCurrentFrameIndex(this.currentFrameIndex);

  }

  ngOnInit() {
    this.stateService.setAnimationBarComponent(this);

  }


  @Input() mechanism!: Mechanism;

  private isAnimating: boolean = false;
  private isPausedAnimating: boolean = true;
  public animationSpeed: number = 1;
  public currentFrameIndex: number = 0;
  timelineMarkers: { position: number; type: "clockwise" | "counterclockwise"; coords?: Coord }[] = [];



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
        this.updateTimelineMarkers();
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
        this.updateTimelineMarkers();
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
        return -2
        break;
    }
    console.log(index);
    return index;
  }

  public sliderValue = 0;
  public isDragging = false;

  onSliderInput(event: any): void {
    const inputElement = event.target as HTMLInputElement;
    const numericValue = parseFloat(inputElement.value);
    this.sliderValue = numericValue;
    let fraction = numericValue / 100;

    if (!this.animationService.startDirectionCounterclockwise) {
      fraction = 1 - fraction;
    }

    this.animationService.setAnimationProgress(fraction);
  }

  onSliderDragStart(): void {
    this.isDragging = true;
  }

  onSliderDragEnd(): void {
    this.isDragging = false;
  }

  toggleAnimationSpeed(): void{
    const speedOptions = [0.5,1,2]
    const index = speedOptions.indexOf(this.animationSpeed);
    this.animationSpeed = speedOptions[(index+1) % speedOptions.length];
    this.animationService.setSpeedmultiplier(this.animationSpeed);
  }

  updateTimelineMarkers(): void {
    const mech = this.animationService.getAnimationState(this.getMechanismIndex());
    if (!mech) return;

    const flips = this.animationService.getDirectionChanges(mech);

    const newMarkers = [];

    if (flips.clockwise) {
      newMarkers.push(this.createMarker(flips.clockwise.frame, flips.clockwise.position, 'clockwise'));
    }

    if (flips.counterClockwise) {
      newMarkers.push(this.createMarker(flips.counterClockwise.frame, flips.counterClockwise.position, 'counterclockwise'));
    }

    if (flips.clockwise2) {
      newMarkers.push(this.createMarker(flips.clockwise2.frame, flips.clockwise2.position, 'clockwise'));
    }

    if (flips.counterClockwise2) {
      newMarkers.push(this.createMarker(flips.counterClockwise2.frame, flips.counterClockwise2.position, 'counterclockwise'));
    }


    newMarkers.sort((a, b) => a.position - b.position);

    this.timelineMarkers = newMarkers;
  }

  private createMarker(frame: number, coord: Coord, type: 'clockwise'|'counterclockwise') {
    const raw = frame / (this.animationService.getAnimationState(this.getMechanismIndex())!.totalFrames - 1);
    return {
      position: raw * 100,
      type,
      coords: coord
    };
  }


}

