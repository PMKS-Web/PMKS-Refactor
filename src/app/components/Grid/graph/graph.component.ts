import {Component, HostListener} from '@angular/core';
import { ClickCapture, ClickCaptureID } from 'src/app/controllers/click-capture/click-capture';

import { Coord } from 'src/app/model/coord';
import { Link } from 'src/app/model/link';
import { Joint } from 'src/app/model/joint';
import { Force } from 'src/app/model/force';
import { Position } from "src/app/model/position";
import { Trajectory } from 'src/app/model/trajectory';
import { CompoundLink } from 'src/app/model/compound-link';
import { Mechanism } from 'src/app/model/mechanism';
import { InteractionService } from 'src/app/services/interaction.service';
import { StateService } from 'src/app/services/state.service';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import {Subscription} from "rxjs";

@Component({
  selector: '[app-graph]',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.css']
})
export class GraphComponent {

  panelSubscription: Subscription = new Subscription();
  panel: string = "Edit";
  positionDisplay = document.getElementsByClassName("Positions");
  hidePosition: boolean = false;

  constructor(private stateService: StateService, private interactorService: InteractionService,
              private unitConverter: UnitConversionService) {
    console.log("GraphComponent.constructor");
  }

  ngOnInit() {
    this.panelSubscription = this.stateService.globalActivePanelCurrent.subscribe((panel) => this.panelChanged(panel));
  }

  private panelChanged(panel: string) {
    /*let displayedPositions = this.positionDisplay[0].children;
    for (let i = 0; i < displayedPositions.length; i++) {
      if (panel === "Edit" || panel === "Analysis") {
        displayedPositions[i].setAttribute("hidden", "true");
      }
      else displayedPositions[i].removeAttribute("hidden");
    }*/
    this.hidePosition = panel === "Edit" || panel === "Analysis";
  }

  public getJoints(): Joint[] {
    return Array.from(this.stateService.getMechanism().getJoints());
  }

  public getPositions(): Position[] {
    return Array.from(this.stateService.getMechanism().getPositions());
  }

  public getTrajectories(): Trajectory[] {
    return Array.from(this.stateService.getMechanism().getTrajectories());
  }

  public getLinks(): Link[] {
    return Array.from(this.stateService.getMechanism().getIndependentLinks());
  }
  public getCompoundLinks(): CompoundLink[] {
    return Array.from(this.stateService.getMechanism().getCompoundLinks());
  }
  public getForces(): Force[] {
    return Array.from(this.stateService.getMechanism().getForces());
  }
//
public isCreatingComponent(): boolean{
  return this.interactorService.getClickCaptureID() !== undefined;
}




  public isCreateNewLinkFromGrid(): boolean {
    return this.interactorService.getClickCaptureID() === ClickCaptureID.CREATE_LINK_FROM_GRID;
  }
  public isCreateNewLinkFromJoint(): boolean {
    return this.interactorService.getClickCaptureID() === ClickCaptureID.CREATE_LINK_FROM_JOINT;
  }
  public isCreateNewLinkFromLink(): boolean {
    return this.interactorService.getClickCaptureID() === ClickCaptureID.CREATE_LINK_FROM_LINK;
  }
  public isCreateNewForceFromLink(): boolean {
    return this.interactorService.getClickCaptureID() === ClickCaptureID.CREATE_FORCE_FROM_LINK;
  }

  public getNewCompLineStart(): Coord {
    let capture = this.interactorService.getClickCapture()!;
    return this.unitConverter.modelCoordToSVGCoord(capture.getStartPos());
  }

  public getNewCompLineEnd(): Coord {
    return this.interactorService.getMousePos().svg;
  }
}
