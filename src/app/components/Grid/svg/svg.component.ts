import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { SvgInteractor } from 'src/app/controllers/svg-interactor';
import { ContextMenuOption, Interactor } from 'src/app/controllers/interactor';
import { InteractionService } from 'src/app/services/interaction.service';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { StateService } from 'src/app/services/state.service';
import { PanZoomService } from 'src/app/services/pan-zoom.service';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import {AnimationService} from "../../../services/animation.service";
import {Subscription} from "rxjs";
import { Mechanism } from 'src/app/model/mechanism';
import { Joint } from 'src/app/model/joint';

@Component({
  selector: 'app-svg',
  templateUrl: './svg.component.html',
  styleUrls: ['./svg.component.css']
})
export class SvgComponent extends AbstractInteractiveComponent {

  unitSubscription: Subscription = new Subscription();
  angleSubscription: Subscription = new Subscription();
  units: string = "Metric (cm)";
  angles: string = "Degree (º)";

  constructor(public override interactionService: InteractionService,
    private stateService: StateService, private panZoomService: PanZoomService, private unitConversionService: UnitConversionService,
              private animationService: AnimationService) {

    super(interactionService);
  }

  override async ngOnInit(): Promise<void> {
    this.unitSubscription = this.stateService.globalUnitsCurrent.subscribe((units) => {this.units = units;});
    this.angleSubscription = this.stateService.globalAnglesCurrent.subscribe((angles) => {this.angles = angles;});
    super.ngOnInit();
  }

  // handle keyboard events and send to interaction service
  @HostListener('window:resize', ['$event'])
  onWindowResize(event: UIEvent) {
      this.panZoomService._onWindowResize(event);
  }
  override registerInteractor(): Interactor {
    let interactor = new SvgInteractor(this.stateService,this.interactionService, this.panZoomService);

    interactor.onKeyDown$.subscribe((event) => {
      if (event.key === "s") {
      }
    });

    return interactor;
  }

  getViewBox(): string{
    return this.panZoomService.getViewBox();
  }


  invalidMechanism() {
    return this.animationService.isInvalid();
  }

  getDegrees() {
    //put in animation service? to get specific number of degrees.
    return "N/A"
  }

  cursorPosition: string = " x: 0.00, y: 0.00";
  onMouseMove(e: MouseEvent) {
    let mouseCoords = this.interactionService.getMousePos();
    this.cursorPosition = " x: " + mouseCoords.model.x.toFixed(2) + ", y: " + mouseCoords.model.y.toFixed(2);
  }

  swapInputAndGround() {
    const mechanism: Mechanism = this.stateService.getMechanism();
    const joints = mechanism.getJoints();

    let inputJoint: Joint | undefined;
    let groundJoint: Joint | undefined;

    for (const joint of joints) {
        if (joint.isInput) {
            inputJoint = joint;
        }
        if (joint.isGrounded) {
            groundJoint = joint;
        }
    }

    if (inputJoint && groundJoint) {
        console.log("Before Swap:");
        console.log("Input Joint:", inputJoint);
        console.log("Ground Joint:", groundJoint);

        // Swap input and ground states
        inputJoint.removeInput(); // Remove input from the current input joint
        console.log("After removeInput, Input Joint:", inputJoint); // Debugging log

        groundJoint.addInput();    // Set the ground joint as input
        groundJoint.removeGround(); // Remove ground from the new input joint
        inputJoint.addGround();     // Set the previous input joint as ground

        console.log("After Swap:");
        console.log("Input Joint:", inputJoint);
        console.log("Ground Joint:", groundJoint);
    } else {
        console.warn("Input or Ground Joint not found!");
    }
}

}
