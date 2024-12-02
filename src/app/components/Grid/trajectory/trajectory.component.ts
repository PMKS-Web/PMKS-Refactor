import { Component, Input } from '@angular/core';
import { Coord } from 'src/app/model/coord';
import { SVGPathService } from 'src/app/services/svg-path.service';
import { UnitConversionService } from 'src/app/services/unit-conversion.service';

@Component({
  selector: '[app-trajectory]',
  templateUrl: './trajectory.component.html',
  styleUrls: ['./trajectory.component.css']
})

export class TrajectoryComponent {
  @Input() trajectory!: Coord[];

  constructor(
    private svgPathService: SVGPathService,
    private unitConversionService: UnitConversionService
  ) {}

  getPath(): string {
    if (!this.trajectory || this.trajectory.length === 0) {
      return '';
    }
    const svgCoords = this.trajectory.map(coord =>
      this.unitConversionService.modelCoordToSVGCoord(coord)
    );
    return this.svgPathService.getTrajectoryDrawnPath(svgCoords, 2);
  }

  getStrokeColor(): string {
    return 'blue';
  }
}
