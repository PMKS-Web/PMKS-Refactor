import { Component, Input } from '@angular/core';
import { Link } from 'src/app/model/link';
import { Joint } from 'src/app/model/joint';
import { Coord } from 'src/app/model/coord';
import { Mechanism } from 'src/app/model/mechanism';
import { StateService } from 'src/app/services/state.service';
import { Interactor } from 'src/app/interactions/interactor';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { InteractionService } from 'src/app/services/interaction.service';
import { LinkInteractor } from 'src/app/interactions/link-interactor';
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
	return this.colorService.getLinkColorFromID(this.link.id);
  }
  getStrokeColor(): string{
    if (this.getInteractor().isSelected) {
      return '#FFCA26'
      
    } else if(this.isHovered()){
      return '#ffecb2'
    }

    return this.colorService.getLinkColorFromID(this.link.id);

  }


	getDrawnPath(): string{
	let radius: number = 15;
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
