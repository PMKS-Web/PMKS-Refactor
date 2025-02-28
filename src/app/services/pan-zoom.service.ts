import { Injectable } from '@angular/core';
import { Coord } from '../model/coord';


export interface ZoomPan {
    viewBoxX: number;
    viewBoxY: number;
    viewBoxWidth: number;
    viewBoxHeight: number;
    windowWidth: number;
    windowHeight: number;
    currentZoom: number;
    zoomScale: number;
}


@Injectable({
    providedIn: 'root'
})
export class PanZoomService{

    private zoomPan: ZoomPan;

constructor() {
    this.zoomPan = {
        viewBoxX: -(window.innerWidth),
        viewBoxY: -(window.innerHeight),
        viewBoxWidth: window.innerWidth*2,
        viewBoxHeight: window.innerHeight*2,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        currentZoom: 2.00,
        zoomScale: 1.020
    }

}

public _onMouseScrollWheel(event: WheelEvent){
    event.stopPropagation();

    let zoomDirection: number = event.deltaY;
    let zoomLeftFraction: number = event.offsetX / this.zoomPan.windowWidth;
    let zoomTopFraction: number = event.offsetY / this.zoomPan.windowHeight;
    let oldViewBoxWidth: number = this.zoomPan.viewBoxWidth;
    let oldViewBoxHeight: number = this.zoomPan.viewBoxHeight;

    if(zoomDirection > 0){

        this.zoomPan.currentZoom *= this.zoomPan.zoomScale;
        this.zoomPan.viewBoxWidth = this.zoomPan.windowWidth * this.zoomPan.currentZoom;
        this.zoomPan.viewBoxHeight = this.zoomPan.windowHeight * this.zoomPan.currentZoom;

        this.zoomPan.viewBoxX -=((this.zoomPan.viewBoxWidth - oldViewBoxWidth) * zoomLeftFraction);
        this.zoomPan.viewBoxY -=((this.zoomPan.viewBoxHeight - oldViewBoxHeight) * zoomTopFraction);
    }else{

        this.zoomPan.currentZoom /= this.zoomPan.zoomScale;
        this.zoomPan.viewBoxWidth = this.zoomPan.windowWidth * this.zoomPan.currentZoom;
        this.zoomPan.viewBoxHeight = this.zoomPan.windowHeight * this.zoomPan.currentZoom;

        this.zoomPan.viewBoxX += ((this.zoomPan.viewBoxWidth - oldViewBoxWidth) * -zoomLeftFraction);
        this.zoomPan.viewBoxY += ((this.zoomPan.viewBoxHeight - oldViewBoxHeight) * -zoomTopFraction);
    }
}

public _onSVGDrag(dragOffset: Coord){
    this.zoomPan.viewBoxX -= dragOffset.x * this.zoomPan.currentZoom;
    this.zoomPan.viewBoxY -= dragOffset.y * this.zoomPan.currentZoom;

}

public _onWindowResize(event: UIEvent){
    event.stopPropagation();

    this.zoomPan.windowWidth = window.innerWidth;
    this.zoomPan.windowHeight = window.innerHeight;
    this.zoomPan.viewBoxWidth = this.zoomPan.windowWidth * this.zoomPan.currentZoom;
    this.zoomPan.viewBoxHeight = this.zoomPan.windowHeight * this.zoomPan.currentZoom;
}


public getViewBox():string{

    return this.zoomPan.viewBoxX.toString() + " "
        +  this.zoomPan.viewBoxY.toString() + " "
        +  this.zoomPan.viewBoxWidth.toString() + " "
        +  this.zoomPan.viewBoxHeight.toString() + " ";
}
public getZoomPan(): ZoomPan{
    return this.zoomPan;

}

}
