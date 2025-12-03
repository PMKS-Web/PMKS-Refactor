import { Component, Input } from '@angular/core';
import { CompoundLink } from 'src/app/model/compound-link';
import { Coord } from 'src/app/model/coord';
import { StateService } from 'src/app/services/state.service';
import { Interactor } from 'src/app/controllers/interactor';
import { AbstractInteractiveComponent } from '../abstract-interactive/abstract-interactive.component';
import { InteractionService } from 'src/app/services/interaction.service';
import { CompoundLinkInteractor } from 'src/app/controllers/compound-link-interactor';
import { ColorService } from 'src/app/services/color.service';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';
import { NotificationService } from 'src/app/services/notification.service';

import { AnimationService } from 'src/app/services/animation.service';

@Component({
  selector: '[app-compound-link]',
  templateUrl: './compound-link.component.html',
  styleUrls: ['./compound-link.component.css']
})
export class CompoundLinkComponent extends AbstractInteractiveComponent {

  @Input() compoundLink!: CompoundLink;
  constructor(public override interactionService: InteractionService,
				private stateService: StateService,
				private colorService: ColorService,
				private svgPathService: SVGPathService,
        private unitConversionService: UnitConversionService,
        private notificationService: NotificationService,
        public override animationService: AnimationService
        ) {
    super(interactionService,animationService);
  }

  override registerInteractor(): Interactor {
    return new CompoundLinkInteractor(this.compoundLink, this.stateService, this.notificationService);
  }

  getColor():string{
	return this.colorService.getLinkColorFromID(this.compoundLink.id);
  }
	getCompoundDrawnPath(): string{
	const radius: number = 30;
  let allUniqueJointCoords: Set<Coord> = new Set();
  for(let link of this.compoundLink.links.values()){
    for(let joint of link.joints.values())
    allUniqueJointCoords.add(joint._coords);
  }
  let allCoordsAsArray: Coord[] = Array.from(allUniqueJointCoords,(coord,index) =>{
    return this.unitConversionService.modelCoordToSVGCoord(coord);
  });
    return this.svgPathService.calculateCompoundPath(this.compoundLink.links, allCoordsAsArray, radius);
	//return this.svgPathService.getSingleLinkDrawnPath(allCoordsAsArray, radius);
  }
  getStrokeColor(): string{
    if (this.getInteractor().isSelected) {
      return '#FFCA26'

    } else if(this.isHovered()){
      return '#ffecb2'
    }

    return this.colorService.getLinkColorFromID(this.compoundLink.id);
  }


  getSubLinksPaths(): string[]{
    const radius: number = 30;
    let subLinkPaths: string[] = [];

    this.compoundLink.links.forEach((link,id) =>{
      let subLinkCoords = Array.from(link.joints,([id,joint])=>{
        return this.unitConversionService.modelCoordToSVGCoord(joint._coords);
      });
      subLinkPaths.push(this.svgPathService.getSingleLinkDrawnPath(subLinkCoords,radius));
    });
    return subLinkPaths;
  }


  getLocked(): boolean{
    return this.compoundLink.lock;
  }
  getCOMX(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.compoundLink.centerOfMass).x;
  }
  getCOMY(): number {
    return this.unitConversionService.modelCoordToSVGCoord(this.compoundLink.centerOfMass).y;
  }
}
