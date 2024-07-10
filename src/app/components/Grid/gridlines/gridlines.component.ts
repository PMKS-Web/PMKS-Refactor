import { Component } from '@angular/core';

import { PanZoomService, ZoomPan } from 'src/app/services/pan-zoom.service';

@Component({
  selector: '[gridlines]',
  templateUrl: './gridlines.component.html',
  styleUrls: ['./gridlines.component.css']
})
export class GridLinesComponent  {
  private DEFAULT_CELL_SCALE: number = 200;
  constructor(private panZoomService: PanZoomService) {
    console.log("GridLines.constructor");
  }

  getLines(majorMinor: boolean, horizontalVertical: boolean): {lines: {line: number, label:number}[]} {
    //setup returnn variable and get canvas state
    let lines: {line: number, label:number}[] = [];
    let zoomPan: ZoomPan = this.panZoomService.getZoomPan();

    //setup variables reliant on flags
    let cellSize: number = majorMinor ? this.getCellSize(zoomPan.currentZoom): this.getCellSize(zoomPan.currentZoom)/4;
    let viewBoxMin: number = horizontalVertical ? zoomPan.viewBoxY : zoomPan.viewBoxX;
    let viewBoxMax: number = horizontalVertical ? viewBoxMin + zoomPan.viewBoxHeight: viewBoxMin + zoomPan.viewBoxWidth;
    let labelInc: number = horizontalVertical ? -cellSize / this.DEFAULT_CELL_SCALE: cellSize/this.DEFAULT_CELL_SCALE;

    //calculate line locations and labels
    let currentLine = Math.floor(viewBoxMin / cellSize) * cellSize;
    let currentLabel = Math.floor(viewBoxMin / cellSize) * labelInc;
    while (currentLine < viewBoxMax) {
      if (Math.abs(currentLine) < 0.000001) {
        currentLine += cellSize;
        currentLabel += labelInc;
        continue;
      }
      lines.push({line:currentLine, label:(Math.round(currentLabel * 100000) / 100000)});
      currentLine += cellSize;
      currentLabel+=labelInc;
    }

    return {lines};
  }

  private getCellSize(zoomScale: number):number{
    let factorsOfTen: number = zoomScale >=1 ? (Math.log10(zoomScale)) : (-Math.log10(1 / zoomScale));
    let scaleLevel: number = zoomScale >=1 ? factorsOfTen % 1: 1-(-factorsOfTen % 1);
    let label: number =  scaleLevel < Math.log10(2) ? 1 : scaleLevel < Math.log10(4) ? 2 : 4;
    let cellSize = Math.pow(10, Math.floor(factorsOfTen)) * label * this.DEFAULT_CELL_SCALE;
    return cellSize;
  }

  getZoomPan(): ZoomPan{
    return this.panZoomService.getZoomPan();
  }

}
