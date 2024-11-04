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

  cursorPosition: string = "";
  onMouseMove(e: MouseEvent) {
    let mouseCoords = this.interactionService.getMousePos();
    this.cursorPosition = " " + mouseCoords.model.x.toFixed(2) + " " + mouseCoords.model.y.toFixed(2);
  }

}
