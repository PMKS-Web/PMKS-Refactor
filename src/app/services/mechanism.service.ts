//This file contains information on how to implement forces
//Once Forces are added we can remove many components to this

import { Injectable, Injector } from '@angular/core';
import { Joint, PrisJoint, RealJoint } from '../model/joint';
import { Link, RealLink } from '../model/link';
import { Force } from '../model/force';
import { Mechanism } from '../model/mechanism/mechanism';
import { InstantCenter } from '../model/instant-center';
import { GlobalUnit } from '../model/utils';
import { BehaviorSubject, connect, Subject } from 'rxjs';
import { GridUtilsService } from './grid-utils.service';
import { ActiveObjService } from './active-obj.service';
import { NewGridComponent } from '../component/new-grid/new-grid.component';
import { SettingsService } from './settings.service';
import { Coord } from '../model/coord';
import { SaveHistoryService } from './save-history.service';
import { NumberUnitParserService } from './number-unit-parser.service';
import { PositionSolver } from '../model/mechanism/position-solver';

@Injectable({
  providedIn: 'root',
})
export class MechanismService {
  public mechanismTimeStep: number = 0;
  public mechanismAnimationIncrement: number = 2;
  public joints: Joint[] = [];
  public links: Link[] = [];
  public forces: Force[] = [];
  public ics: InstantCenter[] = [];
  public mechanisms: Mechanism[] = [];
  public showPathHolder: boolean = true;

  // private moveModes: moveModes = moveModes;
  // private selectedJoint!: RealJoint;

  // This is the state of the mechanism
  // 0 is normal, no changes, no pending analysis
  // 1 is actively being dragged, no pending analysis, disable graphs
  // 2 is pending graph draws
  // 3 is pending analysis due to add or remove
  onMechUpdateState = new BehaviorSubject<number>(3);

  //The which timestep the mechanims is in
  onMechPositionChange = new Subject<number>();

  constructor(
    public gridUtils: GridUtilsService,
    public activeObjService: ActiveObjService,
    private injector: Injector,
    private settingsService: SettingsService,
    private nup: NumberUnitParserService
  ) {}

  // delete mechanism and reset

  updateMechanism(save: boolean = false) {
    console.log('update mechanism', save);
    // console.log(this.mechanisms[0]);
    //There are multiple mechanisms since there was a plan to support multiple mechanisms
    //You can treat this as a single mechanism for now at index 0
    this.mechanisms = [];
    // TODO: Determine logic later once everything else is determined
    let inputAngularVelocity = this.settingsService.inputSpeed.value;
    if (this.settingsService.isInputCW.value) {
      inputAngularVelocity = inputAngularVelocity * -1;
    }
    let unitStr = 'cm';
    switch (this.settingsService.globalUnit.value) {
      case GlobalUnit.ENGLISH:
        unitStr = 'cm';
        break;
      case GlobalUnit.METRIC:
        unitStr = 'cm';
        break;
      case GlobalUnit.NULL:
        unitStr = 'cm';
        break;
      case GlobalUnit.SI:
        unitStr = 'cm';
        break;
      default:
        break;
    }
    this.mechanisms.push(
      //This creates a new mechanism with the current state of the joints, links, forces, and ics
      //If the mechnaism is simulatable, it will generate loops and all future time steps
      new Mechanism(
        this.joints,
        this.links,
        this.forces,
        this.ics,
        this.settingsService.isForces.value,
        unitStr,
        inputAngularVelocity
      )
    );
    this.links.forEach((l) => {
      if (l instanceof RealLink) {
        if (l.isWelded) {
          //Call reCompute on each link in the subset
          l.subset.forEach((subLink) => {
            (subLink as RealLink).reComputeDPath();
          });
        }
        (l as RealLink).reComputeDPath();
      }
    });
    this.activeObjService.fakeUpdateSelectedObj();

    if (save) {
      this.save();
    }
  }

  save() {
    const saveHistoryService = this.injector.get(SaveHistoryService);
    saveHistoryService.save();
  }

  deleteForce() {
    const forceIndex = this.forces.findIndex(
      (f) => f.id === this.activeObjService.selectedForce.id
    );
    this.forces.splice(forceIndex, 1);
    this.updateMechanism(true);
  }

  changeForceDirection() {
    NewGridComponent.sendNotification('This feature is coming soon!');
    // this.activeObjService.selectedForce.arrowOutward =
    //   !this.activeObjService.selectedForce.arrowOutward;
    // if (this.activeObjService.selectedForce.arrowOutward) {
    //   this.activeObjService.selectedForce.forceArrow =
    //     this.activeObjService.selectedForce.createForceArrow(
    //       this.activeObjService.selectedForce.startCoord,
    //       this.activeObjService.selectedForce.endCoord
    //     );
    // } else {
    //   this.activeObjService.selectedForce.forceArrow =
    //     this.activeObjService.selectedForce.createForceArrow(
    //       this.activeObjService.selectedForce.endCoord,
    //       this.activeObjService.selectedForce.startCoord
    //     );
    // }
    // this.updateMechanism();
  }

  changeForceLocal() {
    this.activeObjService.selectedForce.local =
      !this.activeObjService.selectedForce.local;
    if (this.activeObjService.selectedForce.local) {
      this.activeObjService.selectedForce.stroke = 'blue';
      this.activeObjService.selectedForce.fill = 'blue';
    } else {
      this.activeObjService.selectedForce.stroke = 'black';
      this.activeObjService.selectedForce.fill = 'black';
    }
    this.updateMechanism(true);
  }

  createForceAtCOM() {
    let link = this.activeObjService.selectedLink;
    let com = link.CoM;
    let endPoint = new Coord(com.x + 1, com.y + 3);
    this.createForce(com, endPoint);
  }

  createForce(startCoord: Coord, endCoord: Coord) {
    // TODO: utilize dot product to find point that is closest to the line
    if (this.activeObjService.selectedLink.joints.length === 2) {
      const lineVector: Coord = new Coord(
        this.activeObjService.selectedLink.joints[0].x -
          this.activeObjService.selectedLink.joints[1].x,
        this.activeObjService.selectedLink.joints[0].y -
          this.activeObjService.selectedLink.joints[1].y
      );

      // Calculate the vector from the first point on the line to the given point
      const givenPointVector: Coord = new Coord(
        startCoord.x - this.activeObjService.selectedLink.joints[0].x,
        startCoord.y - this.activeObjService.selectedLink.joints[0].y
      );

      // Calculate the dot product of the line vector and the given point vector
      const dotProduct: number =
        givenPointVector.x * lineVector.x + givenPointVector.y * lineVector.y;

      // Calculate the length of the line vector squared
      const lineLengthSquared: number =
        lineVector.x * lineVector.x + lineVector.y * lineVector.y;

      // Calculate the parameter t for the projection onto the line
      const t: number = dotProduct / lineLengthSquared;

      // Calculate the projected point on the line
      startCoord.x =
        this.activeObjService.selectedLink.joints[0].x + t * lineVector.x;
      startCoord.y =
        this.activeObjService.selectedLink.joints[0].y + t * lineVector.y;
    }
    let maxNumber = 1;
    if (this.forces.length !== 0) {
      maxNumber =
        Math.max(...this.forces.map((f) => parseInt(f.id.replace(/\D/g, '')))) +
        1;
    }
    const force = new Force(
      'F' + maxNumber.toString(),
      this.activeObjService.selectedLink,
      startCoord,
      endCoord
    );
    this.activeObjService.selectedLink.forces.push(force);
    this.forces.push(force);
    PositionSolver.setUpSolvingForces(
      this.activeObjService.selectedLink.forces
    ); // needed to determine force position when dragging a joint
    // PositionSolver.setUpInitialJointLocations(this.selectedLink.joints);
  }
}
