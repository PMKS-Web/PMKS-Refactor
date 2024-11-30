import { Component, Input } from '@angular/core';
import { Position } from 'src/app/model/position';
import { Joint } from 'src/app/model/joint';
import { Coord } from 'src/app/model/coord';
import { StateService } from 'src/app/services/state.service';
import { Interactor } from 'src/app/controllers/interactor';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { InteractionService } from 'src/app/services/interaction.service';
import { PositionInteractor } from 'src/app/controllers/position-interactor';
import { ColorService } from 'src/app/services/color.service';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { UnitConversionService } from "src/app/services/unit-conversion.service";

@Component({
  selector: '[app-position]',
  templateUrl: './position.component.html',
  styleUrls: ['./position.component.css']
})
export class PositionComponent extends AbstractInteractiveComponent {

  @Input() position!: Position;
  @Input() isHidden: boolean = false;

  constructor(
    public override interactionService: InteractionService,
    private stateService: StateService,
    private colorService: ColorService,
    private svgPathService: SVGPathService,
    private unitConversionService: UnitConversionService
  ) {
    super(interactionService);
  }

  override registerInteractor(): Interactor {
    return new PositionInteractor(this.position, this.stateService, this.interactionService);
  }

  getColor(): string {
    return this.position.color;
  }

  getLocked(): boolean {
    return this.position.locked;
  }

  getCOMX(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.position.centerOfMass).x;
  }

  getCOMY(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.position.centerOfMass).y;
  }
  getStrokeColor(): string {
    if (this.getInteractor().isSelected) {
      return '#FFCA28';
    } else if (this.isHovered()) {
      return '#FFECB3';
    }

    return this.position.color; // Default color
  }

  getLength(): string {
    if (this.isHidden) return "";
    else return this.position.length.toString();
  }

  getName():string {
    if (this.isHidden) return "";
    else return this.position.name + "\nAngle: " + this.position.angle;
  }

  getDrawnPath(): string {
    if (this.isHidden) {
      const hiddenJoints = this.position.joints.values()
      for (let joint of hiddenJoints) {
        joint.hidden = true;
      }
      return "";
    }
    else {
      const unhiddenJoints = this.position.getJoints();
      for (let i = 0; i < unhiddenJoints.length-1; i++) {
        unhiddenJoints[i].hidden = false;
      }
      if (this.position.refPoint === "Center") {
        unhiddenJoints[unhiddenJoints.length-1].hidden = false;
      }
    }
    const radius: number = 30;
    const joints = this.position.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length-1; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    return this.svgPathService.getSinglePosDrawnPath(allCoords, radius);
  }

  getLengthSVG(): string {
    const joints = this.position.getJoints();
    const allCoords: Coord[] = [];

    for (let i = 0; i < joints.length-1; i++) {
      let coord: Coord = joints[i]._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

    return this.svgPathService.calculateLengthSVGPath(allCoords[0], allCoords[1]);
  }

}
