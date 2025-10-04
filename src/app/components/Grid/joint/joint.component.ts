import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { Joint, JointType } from 'src/app/model/joint';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { Interactor } from 'src/app/controllers/interactor';
import { JointInteractor } from 'src/app/controllers/joint-interactor';
import { StateService } from 'src/app/services/state.service';
import { InteractionService } from 'src/app/services/interaction.service';
import { ClickCapture, ClickCaptureID } from 'src/app/controllers/click-capture/click-capture';
import { CreateLinkFromJointCapture } from 'src/app/controllers/click-capture/create-link-from-joint-capture';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import {Subscription} from "rxjs";
import { NotificationService } from 'src/app/services/notification.service';
import { AnimationService } from 'src/app/services/animation.service';

import { UndoRedoService } from 'src/app/services/undo-redo.service';
@Component({
  selector: '[app-joint]',
  templateUrl: './joint.component.html',
  styleUrls: ['./joint.component.css']
})
export class JointComponent extends AbstractInteractiveComponent {

  @Input() joint!: Joint;
  showIDLabelsSubscription: Subscription = new Subscription();
  showIDLabels: boolean = false;
  override ngOnInit(): void {
    this.showIDLabelsSubscription = this.stateService.showIDLabels$.subscribe((show) => { this.showIDLabels = show; });
    super.ngOnInit();
  }
  override ngOnDestroy(): void {
    this.showIDLabelsSubscription.unsubscribe();
  }

  constructor(public override interactionService: InteractionService,
    private stateService: StateService,
    private undoRedoService: UndoRedoService,
    private unitConversionService: UnitConversionService,
    private notificationService: NotificationService,
    public override animationService: AnimationService
  ) {
    super(interactionService, animationService);
  }

  override registerInteractor(): Interactor {
    return new JointInteractor(this.joint, this.stateService, this.interactionService, this.notificationService, this.undoRedoService);
  }

  public getX(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.joint._coords).x;
  }

  public getY(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.joint._coords).y;
  }

  public getAngle(): number {
    return this.joint.angle ?? 0;
  }

  public getRadius(): number {
    if (this.joint.isHidden) return 0;
    else return 18;
  }

  public getColor(): string {
    if (this.joint.isReference){
      return '#000000';
    }
    if (this.getInteractor().isSelected && !this.joint.isReference) {
      return '#FFCA28'
    } else if(this.isHovered() && !this.joint.isReference){
      return '#FFECB3'
    }
    return '#FFF8E1';
  }

  getName():string {
    if (this.joint.isHidden) return "";
    else return this.joint.name;
  }
  getLocked():boolean {
    return this.joint.locked;
  }
  isWelded(){
    return this.joint.isWelded;
  }
  isGround(){
    return this.joint.isGrounded;
  }
  isInput(){
    return this.joint.isInput;
  }
  isPrismatic(){
    return this.joint.type == JointType.Prismatic;
  }
  isCCW(){
    return this.joint.inputSpeed >= 0;
  }
  isRef() {
    return this.joint.isReference;
  }

  getTranslation(): string{
    return "translate(" +
    this.unitConversionService.modelCoordToSVGCoord(this.joint._coords).x.toString() +
    " " +
    this.unitConversionService.modelCoordToSVGCoord(this.joint._coords).y.toString() +
    ") scale(0.6)";



  }

  public getStrokeWidth(): number {
    if (this.isCreateLinkCaptureAndHoveringOverThisJoint()) {
      return 2;
    }
    return 0;
  }

  // whether in create link click capture mode, and the mouse is hovering over this joint
  public isCreateLinkCaptureAndHoveringOverThisJoint(): boolean {
    if (this.interactionService.getClickCaptureID() === ClickCaptureID.CREATE_LINK_FROM_JOINT) {
      let capture = this.interactionService.getClickCapture() as CreateLinkFromJointCapture;
      return capture.getHoveringJoint() === this.joint;
    }
    return false;
  }
}
