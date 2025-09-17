import { Component, HostListener, Input, OnInit } from '@angular/core';
import { CompoundLinkInteractor } from 'src/app/controllers/compound-link-interactor';
import { JointInteractor } from 'src/app/controllers/joint-interactor';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { AnimationService } from 'src/app/services/animation.service';
import { InteractionService } from 'src/app/services/interaction.service';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { PositionSolverService } from 'src/app/services/kinematic-solver.service';
//import { MatSnackBar } from '@angular/material/snack-bar';
import { JointComponent } from 'src/app/components/Grid/joint/joint.component';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import { join } from '@angular/compiler-cli';
import { Coord } from '../../../model/coord';
import { PanZoomService } from '../../../services/pan-zoom.service';
import { Mechanism } from '../../../model/mechanism';
import { StateService } from 'src/app/services/state.service';
import { FormControl, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-animation-bar',
  templateUrl: './animationbar.component.html',
  styleUrls: ['./animationbar.component.scss'],
})
export class AnimationBarComponent implements OnInit {
  public sliderControl = new FormControl(0);
  public currentTimeStep = 0;

  constructor(
    public interactionService: InteractionService,
    private animationService: AnimationService,
    private positionSolver: PositionSolverService,
    private stateService: StateService,
    private panZoomService: PanZoomService // Inject PanZoomService
  ) {
    this.animationService.animationProgress$.subscribe((progress) => {
      if (!this.isDragging) {
        this.sliderValue = progress * 100;
      }
    });
    this.animationService.timeStep$.subscribe((timeStep) => {
      // rounds timeStep to the nearest hundredths place
      this.currentTimeStep = Math.round(timeStep * 1e2) / 1e2;
    })
  }

  zoomIn() {
    this.panZoomService.zoomIn();
  }

  zoomOut() {
    this.panZoomService.zoomOut();
  }
  getAnimationService() {
    return this.animationService;
  }

  resetView() {
    this.panZoomService.resetView();
  }
  showingIDLabels = false;
  showIDLabels() {
    this.showingIDLabels = !this.showingIDLabels;
    this.stateService.toggleShowIDLabels();
  }

  get currentIDLabelIcon() {
    return this.showingIDLabels
      ? './assets/icons/abc_cross.png'
      : './assets/icons/abc.png';
  }

  ngOnInit() {
    this.stateService.setAnimationBarComponent(this);
  }

  @Input() mechanism!: Mechanism;

  private isAnimating: boolean = false;
  private isPausedAnimating: boolean = true;
  public animationSpeed: number = 1;
  timelineMarkers: {
    position: number;
    type: 'clockwise' | 'counterclockwise';
    coords?: Coord;
  }[] = [];

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
        this.stateService
          .getMechanism()
          .populateTrajectories(this.positionSolver);

        setTimeout(() => {}, 100);
        this.isAnimating = true;
        this.isPausedAnimating = false;
        this.updateTimelineMarkers();
        break;
      case 'stop':
        this.animationService.reset();
        this.isAnimating = false;
        this.isPausedAnimating = true;
        this.sliderValue = 0;
        this.currentTimeStep = 0;
        this.stateService.getMechanism().clearTrajectories();
        //Clear the trajectories
        break;
    }
  }

  getIsAnimating(): boolean {
    return this.isAnimating;
  }
  getIsPausedAnimating(): boolean {
    return this.isPausedAnimating;
  }
  sendNotification(text: string) {
    console.log(text);
  }
  getMechanismIndex(): number {
    const obj = this.interactionService.getSelectedObject();
    if (!obj) {
      return 0;
    }

    let index = -1;

    switch (obj.constructor.name) {
      case 'JointInteractor':
        let jInteractor = obj as JointInteractor;
        index = this.animationService.getSubMechanismIndex(
          jInteractor.joint.id
        );
        break;
      case 'LinkInteractor':
        let lInteractor = obj as LinkInteractor;
        index = this.animationService.getSubMechanismIndex(
          lInteractor.link.getJoints()[0].id
        );
        break;
      case 'CompoundLinkInteractor':
        let cInteractor = obj as CompoundLinkInteractor;
        index = this.animationService.getSubMechanismIndex(
          cInteractor.compoundLink.getJoints()[0].id
        );
        break;
      case 'ForceInteractor':
        return -1;
        break;
    }
    return index;
  }

  public sliderValue = 0;
  public isDragging = false;

  onSliderInput(event: any): void {
    const inputElement = event.target as HTMLInputElement;
    const numericValue = parseFloat(inputElement.value);
    this.sliderValue = numericValue;
    const fraction = numericValue / 100;
    this.animationService.setAnimationProgress(fraction);
  }

  onSliderDragStart(): void {
    this.isDragging = true;
  }

  onSliderDragEnd(): void {
    this.isDragging = false;
  }

  toggleAnimationSpeed(): void {
    const speedOptions = [0.5, 1, 2];
    const index = speedOptions.indexOf(this.animationSpeed);
    this.animationSpeed = speedOptions[(index + 1) % speedOptions.length];
    this.animationService.setSpeedmultiplier(this.animationSpeed);
  }

  updateTimelineMarkers(): void {
    const mechanismIndex = this.getMechanismIndex();
    if (mechanismIndex === -1) {
      return;
    }

    const mechanismState =
      this.animationService.getAnimationState(mechanismIndex);
    if (!mechanismState) {
      return;
    }

    const changes = this.animationService.getDirectionChanges(mechanismState);

    const totalFrames = mechanismState.totalFrames ?? 1;
    this.timelineMarkers = [];

    const ccw = this.animationService.startDirectionCounterclockwise;

    // 1) Handle the "clockwise" change
    if (changes.clockwise !== undefined) {
      const frameIndex = changes.clockwise.frame;

      const rawFraction = frameIndex / (totalFrames - 1);
      const finalFraction = ccw ? rawFraction : 1 - rawFraction;
      const position = Math.min(Math.max(finalFraction * 100, 0), 100);

      const markerType = ccw ? 'clockwise' : 'counterclockwise';

      this.timelineMarkers.push({
        position,
        type: markerType,
        coords: changes.clockwise.position,
      });
    }

    // 2) Handle the "counterClockwise" change
    if (changes.counterClockwise !== undefined) {
      const frameIndex = changes.counterClockwise.frame;

      const rawFraction = frameIndex / (totalFrames - 1);
      const finalFraction = ccw ? rawFraction : 1 - rawFraction;
      const position = Math.min(Math.max(finalFraction * 100, 0), 100);

      const markerType = ccw ? 'counterclockwise' : 'clockwise';

      this.timelineMarkers.push({
        position,
        type: markerType,
        coords: changes.counterClockwise.position,
      });
    }

    console.log('Final timelineMarkers array:', this.timelineMarkers);
  }

  onTimeStepInput(event: any): void {
    const inputElement = event.target as HTMLInputElement;
    let numericValue = parseFloat(inputElement.value);
    //this.currentTimeStep = this.animationService.getClosestTimeStep(numericValue);
    numericValue = this.animationService.getClosestTimeStep(numericValue);
    const fraction = numericValue / this.animationService.maxTimeStep;
    this.sliderValue = Math.floor(fraction * 100);
    this.animationService.setAnimationProgress(fraction);
    this.currentTimeStep = Math.round(numericValue * 1e2) / 1e2;
  }
}
