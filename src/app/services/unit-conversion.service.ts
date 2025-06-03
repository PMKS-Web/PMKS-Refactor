import { Injectable } from '@angular/core';
import { Coord } from '../model/coord';
import { ZoomPan } from './pan-zoom.service';

@Injectable({
    providedIn: 'root'
})
export class UnitConversionService{
    private MODEL_TO_SVG_SCALE = 200.000
    constructor(){}

  // Converts mouse coordinates in screen space to model coordinates using the current zoom and pan.
  public mouseCoordToModelCoord(mouseCoord: Coord, zoomPan: ZoomPan): Coord {
        let svgCoord = this.mouseCoordToSVGCoord(mouseCoord,zoomPan);
        let convertedX: number = svgCoord.x / this.MODEL_TO_SVG_SCALE;
        let convertedY: number = -svgCoord.y / this.MODEL_TO_SVG_SCALE;
        return new Coord(convertedX,convertedY);
  }

  // Converts mouse coordinates in screen space to SVG coordinates based on zoom and pan values.
  public mouseCoordToSVGCoord(mouseCoord: Coord, zoomPan: ZoomPan): Coord {
      let convertedX: number = zoomPan.viewBoxX + mouseCoord.x * zoomPan.currentZoom;
      let convertedY: number = zoomPan.viewBoxY + mouseCoord.y * zoomPan.currentZoom;
      return new Coord(convertedX,convertedY);
  }

  // Converts model coordinates to SVG coordinates by applying the defined scale factor.
  public modelCoordToSVGCoord(modelCoord: Coord): Coord{
      let convertedX: number = modelCoord.x * this.MODEL_TO_SVG_SCALE;
      let convertedY: number = -modelCoord.y * this.MODEL_TO_SVG_SCALE;
      return new Coord(convertedX,convertedY);
  }

}
