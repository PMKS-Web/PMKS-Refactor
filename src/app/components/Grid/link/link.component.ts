import { Component, Input } from '@angular/core';
import { Link } from 'src/app/model/link';
import { Joint } from 'src/app/model/joint';
import { Coord } from 'src/app/model/coord';
import { Mechanism } from 'src/app/model/mechanism';
import { StateService } from 'src/app/services/state.service';
import { Interactor } from 'src/app/controllers/interactor';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { InteractionService } from 'src/app/services/interaction.service';
import { LinkInteractor } from 'src/app/controllers/link-interactor';
import { ColorService } from 'src/app/services/color.service';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { UnitConversionService } from "src/app/services/unit-conversion.service";

@Component({
  selector: '[app-link]',
  templateUrl: './link.component.html',
  styleUrls: ['./link.component.css']
})
export class LinkComponent extends AbstractInteractiveComponent {

  @Input() link!: Link;
  constructor(public override interactionService: InteractionService,
				private stateService: StateService,
				private colorService: ColorService,
				private svgPathService: SVGPathService,
        private unitConversionService: UnitConversionService) {
    super(interactionService);
  }

  override registerInteractor(): Interactor {
    return new LinkInteractor(this.link, this.stateService, this.interactionService);
  }

  getColor():string{
	return this.link.color;
  }
  getLocked(): boolean{
    return this.link.locked;
  }

  getCOMX(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.link.centerOfMass).x;
  }
  getCOMY(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.link.centerOfMass).y;
  }

  getStrokeColor(): string{
    if (this.getInteractor().isSelected) {
      return '#FFCA28'

    } else if(this.isHovered()){
      return '#FFECB3'
    }

    return this.link.color;

  }

  getName():string {
    return this.link.name + "\nLength: " + this.link.length + "\nAngle: " + this.link.angle;
  }

	getDrawnPath(): string{
	let radius: number = 30;
  //convert all joint coordinates from to position in model to position on screen
  let joints: IterableIterator<Joint> = this.link.joints.values();
  let allCoords: Coord[] = [];
    for(let joint of joints){
      let coord: Coord = joint._coords;
      coord = this.unitConversionService.modelCoordToSVGCoord(coord);
      allCoords.push(coord);
    }

	return this.svgPathService.getSingleLinkDrawnPath(allCoords, radius);
  }
}
