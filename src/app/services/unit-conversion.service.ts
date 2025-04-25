import { Injectable } from '@angular/core';
import { Coord } from '../model/coord';
import { ZoomPan } from './pan-zoom.service';

@Injectable({
    providedIn: 'root'
})
export class UnitConversionService{
    private MODEL_TO_SVG_SCALE = 200.000
    constructor(){}


    public offsetCoordToSVGCoord(mousePos: Coord, zoomPan: ZoomPan): Coord {
        let convertedX: number = 0;
        let convertedY: number = 0;
        return new Coord(convertedX,convertedY);
    }

    public mouseDeltaToModelDelta(mouseDelta: Coord, zoomPan: ZoomPan): Coord{
        let convertedDelta: Coord = new Coord(mouseDelta.x * zoomPan.currentZoom, mouseDelta.y * zoomPan.currentZoom);
        return convertedDelta;
    }


    public mouseCoordToModelCoord(mouseCoord: Coord, zoomPan: ZoomPan): Coord {
        let svgCoord = this.mouseCoordToSVGCoord(mouseCoord,zoomPan);
        let convertedX: number = svgCoord.x / this.MODEL_TO_SVG_SCALE;
        let convertedY: number = -svgCoord.y / this.MODEL_TO_SVG_SCALE;
        return new Coord(convertedX,convertedY);
    }

    public mouseCoordToSVGCoord(mouseCoord: Coord, zoomPan: ZoomPan): Coord {
        let convertedX: number = zoomPan.viewBoxX + mouseCoord.x * zoomPan.currentZoom;
        let convertedY: number = zoomPan.viewBoxY + mouseCoord.y * zoomPan.currentZoom;
        return new Coord(convertedX,convertedY);
    }
    public modelCoordToSVGCoord(modelCoord: Coord): Coord{
        let convertedX: number = modelCoord.x * this.MODEL_TO_SVG_SCALE;
        let convertedY: number = -modelCoord.y * this.MODEL_TO_SVG_SCALE;
        return new Coord(convertedX,convertedY);
    }

}
